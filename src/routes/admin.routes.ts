import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import roleRoutes from '../modules/role/role.routes';
import companyRoutes from '../modules/company/company.routes';
import warehouseRoutes from '../modules/warehouse/warehouse.routes';
import userRoutes from '../modules/user/user.routes';
import branchRoutes from '../modules/branch/branch.routes';
import siteRoutes from '../modules/site/site.routes';
import storageRoutes from '../modules/storage/storage.routes';
import clientRoutes from '../modules/client/client.routes';
import boxRoutes from '../modules/box/box.routes';
import deviceRoutes from '../modules/device/device.routes';
import gpsRoutes from '../modules/gps/gps.routes';
import reportRoutes from '../modules/report/report.routes';
import notificationRoutes from '../modules/notification/notification.routes';
import auditRoutes from '../modules/audit/audit.routes';
import settingRoutes from '../modules/setting/setting.routes';

const adminRouter = Router();

// Mount individual domain route groups
adminRouter.use('/auth', authRoutes);
adminRouter.use('/companies', companyRoutes);
adminRouter.use('/warehouses', warehouseRoutes);
adminRouter.use('/users', userRoutes);
adminRouter.use('/branches', branchRoutes);
adminRouter.use('/sites', siteRoutes);
adminRouter.use('/clients', clientRoutes);
adminRouter.use('/devices', deviceRoutes);
adminRouter.use('/gps', gpsRoutes);
adminRouter.use('/reports', reportRoutes);
adminRouter.use('/notifications', notificationRoutes);
adminRouter.use('/audit-logs', auditRoutes);

// Shared/root-level modules (these define subpaths on their Router)
adminRouter.use('/', roleRoutes);
adminRouter.use('/', storageRoutes);
adminRouter.use('/', boxRoutes);
adminRouter.use('/', settingRoutes);

export default adminRouter;
