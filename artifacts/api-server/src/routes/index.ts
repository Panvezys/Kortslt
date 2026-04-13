import { Router, type IRouter } from "express";
import healthRouter from "./health";
import courtsRouter from "./courts";
import bookingsRouter from "./bookings";
import paymentsRouter from "./payments";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(courtsRouter);
router.use(bookingsRouter);
router.use(paymentsRouter);
router.use(statsRouter);

export default router;
