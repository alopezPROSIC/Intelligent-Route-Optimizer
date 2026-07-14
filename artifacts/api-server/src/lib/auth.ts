import crypto from "crypto";

// Simple session store (in-memory; replace with Redis for production)
const sessions = new Map<string, { userId: number; expiresAt: number }>();

export function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { userId, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7 });
  return token;
}

export function getSessionUserId(token: string): number | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.userId;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

// Simple password hashing (use bcrypt in production)
export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "PROSIC_SALT_2024").digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}
