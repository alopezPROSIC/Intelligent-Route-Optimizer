import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import quotesRouter from "./quotes";
import equipmentPublicRouter from "./equipment_public";
import rentalsPublicRouter from "./rentals_public";
import clientsRouter from "./clients";
import vehiclesRouter from "./vehicles";
import equipmentRouter from "./equipment";
import driversRouter from "./drivers";
import branchesRouter from "./branches";
import servicesRouter from "./services";
import routesOptimizationRouter from "./routes_optimization";
import reportsRouter from "./reports";
import sheetsRouter from "./sheets";
import rentalsRouter from "./rentals";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// ─── PUBLIC routes ─────────────────────────────────────────────────────────────
router.use(healthRouter);
router.use(authRouter);
router.use(quotesRouter);
router.use(equipmentPublicRouter);
router.use(rentalsPublicRouter);   // validate-identity, create-payment-intent, confirm

// ─── PROTECTED routes ──────────────────────────────────────────────────────────
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
router.use(rentalsRouter);         // GET /rentals, review management

export default router;
