import { Router, type IRouter } from "express";
import healthRouter from "./health";
import courtsRouter from "./courts";
import bookingsRouter from "./bookings";
import reviewsRouter from "./reviews";
import paymentsRouter from "./payments";
import statsRouter from "./stats";
import uploadRouter from "./upload";
import favoritesRouter from "./favorites";
import adminRouter from "./admin";
import blockedSlotsRouter from "./blocked-slots";

const router: IRouter = Router();

router.use(healthRouter);
router.use(courtsRouter);
router.use(blockedSlotsRouter);
router.use(bookingsRouter);
router.use(reviewsRouter);
router.use(paymentsRouter);
router.use(statsRouter);
router.use(uploadRouter);
router.use(favoritesRouter);
router.use(adminRouter);

export default router;
