"""FastAPI reverse-proxy that wraps the Node.js/Express PROSIC api-server.

The Node process is spawned as a subprocess on internal port 5000, and every
/api/* request received on port 8001 is forwarded to it. This lets the standard
Emergent supervisor configuration (uvicorn on :8001) drive the actual Express
codebase living in /app/artifacts/api-server.
"""
from __future__ import annotations

import asyncio
import os
import signal
import subprocess
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

load_dotenv()

NODE_PORT = int(os.environ.get("NODE_API_PORT", "5000"))
NODE_URL = f"http://127.0.0.1:{NODE_PORT}"
API_SERVER_DIR = Path("/app/artifacts/api-server")

_node_proc: subprocess.Popen | None = None
_client: httpx.AsyncClient | None = None


async def _wait_ready(timeout: float = 30.0) -> bool:
    async with httpx.AsyncClient(timeout=1.5) as c:
        for _ in range(int(timeout * 2)):
            try:
                r = await c.get(f"{NODE_URL}/api/healthz")
                if r.status_code < 500:
                    return True
            except Exception:
                pass
            await asyncio.sleep(0.5)
    return False


def _spawn_node() -> subprocess.Popen:
    env = os.environ.copy()
    env["PORT"] = str(NODE_PORT)
    # Ensure Postgres URL/DB is available
    env.setdefault("NODE_ENV", "production")
    dist = API_SERVER_DIR / "dist" / "index.mjs"
    if not dist.exists():
        subprocess.run(["pnpm", "run", "build"], cwd=API_SERVER_DIR, check=True, env=env)
    return subprocess.Popen(
        ["node", "--enable-source-maps", str(dist)],
        cwd=str(API_SERVER_DIR),
        env=env,
        preexec_fn=os.setsid,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _node_proc, _client
    _node_proc = _spawn_node()
    _client = httpx.AsyncClient(base_url=NODE_URL, timeout=60.0)
    await _wait_ready()
    try:
        yield
    finally:
        if _client:
            await _client.aclose()
        if _node_proc and _node_proc.poll() is None:
            try:
                os.killpg(os.getpgid(_node_proc.pid), signal.SIGTERM)
            except Exception:
                _node_proc.terminate()


app = FastAPI(lifespan=lifespan)


@app.get("/api/_wrapper/healthz")
async def wrapper_healthz():
    return {"status": "wrapper-up", "node_url": NODE_URL}


HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
}


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy(path: str, request: Request):
    if _client is None:
        return JSONResponse({"error": "wrapper_not_ready"}, status_code=503)

    url = f"/api/{path}"
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP_HEADERS}
    try:
        upstream = await _client.request(
            request.method,
            url,
            params=dict(request.query_params),
            content=body,
            headers=headers,
        )
    except httpx.RequestError as e:
        return JSONResponse({"error": "upstream_unreachable", "detail": str(e)}, status_code=502)

    out_headers = {k: v for k, v in upstream.headers.items() if k.lower() not in HOP_HEADERS}
    return Response(content=upstream.content, status_code=upstream.status_code, headers=out_headers)
