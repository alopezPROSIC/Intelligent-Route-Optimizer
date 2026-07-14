import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import quotesRouter from "./quotes";
import clientsRouter from "./clients";
import vehiclesRouter from "./vehicles";
import equipmentRouter from "./equipment";
import driversRouter from "./drivers";
import branchesRouter from "./branches";
import servicesRouter from "./services";
import routesOptimizationRouter from "./routes_optimization";
import reportsRouter from "./reports";
import sheetsRouter from "./sheets";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// ─── PUBLIC routes (no auth required) ────────────────────────────────────────
router.use(healthRouter);
router.use(authRouter);
router.use(quotesRouter);   // cotizador endpoints are public
// The first two service endpoints (today + pending-collection) are partially public,
// but handled internally in servicesRouter with selective requireAuth

// ─── PROTECTED routes (auth required) ────────────────────────────────────────
// Apply requireAuth once here instead of repeating it in every sub-router
router.use(requireAuth as any);
router.use(clientsRouter);
router.use(vehiclesRouter);
router.use(equipmentRouter);
router.use(driversRouter);
router.use(branchesRouter);
router.use(servicesRouter);
router.use(routesOptimizationRouter);
router.use(reportsRouter);
router.use(sheetsRouter);

export default router;
