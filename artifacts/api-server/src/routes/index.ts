import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nichanueRouter from "./nichanue";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nichanueRouter);

export default router;
