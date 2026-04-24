import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import staffRouter from "./staff";
import clientsRouter from "./clients";
import tasksRouter from "./tasks";
import attendanceRouter from "./attendance";
import workLogsRouter from "./workLogs";
import invoicesRouter from "./invoices";
import notificationsRouter from "./notifications";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import firmProfileRouter from "./firmProfile";
import { attachUser } from "../lib/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(attachUser);
router.use(staffRouter);
router.use(clientsRouter);
router.use(tasksRouter);
router.use(attendanceRouter);
router.use(workLogsRouter);
router.use(invoicesRouter);
router.use(notificationsRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(firmProfileRouter);

export default router;
