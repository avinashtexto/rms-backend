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
import departmentRoutes from '../modules/department/department.routes';
import roomRoutes from '../modules/room/room.routes';
import rackRoutes from '../modules/rack/rack.routes';
import shelfRoutes from '../modules/shelf/shelf.routes';
import locationRoutes from '../modules/location/location.routes';
import fileRecordRoutes from '../modules/fileRecord/fileRecord.routes';
import reasonCodeRoutes from '../modules/reasonCode/reasonCode.routes';
import dashboardRoutes from '../modules/dashboard/dashboard.routes';
import freshBoxMoveRoutes from '../modules/workflow/fresh-box-move.routes';
import inventoryVerifyRoutes from '../modules/workflow/inventory-verify.routes';
import refileRoutes from '../modules/workflow/refile.routes';
import custodyMoveRoutes from '../modules/workflow/custody-move.routes';

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
adminRouter.use('/departments', departmentRoutes);
adminRouter.use('/rooms', roomRoutes);
adminRouter.use('/racks', rackRoutes);
adminRouter.use('/shelves', shelfRoutes);
adminRouter.use('/locations', locationRoutes);
adminRouter.use('/file-records', fileRecordRoutes);
adminRouter.use('/reason-codes', reasonCodeRoutes);

// Dashboard (must be before root-level routes to avoid conflicts)
adminRouter.use('/dashboard', dashboardRoutes);

// Role & Permission management
adminRouter.use('/roles', roleRoutes);

// Workflows
adminRouter.use('/workflows/fresh-box-move', freshBoxMoveRoutes);
adminRouter.use('/workflows/inventory-verify', inventoryVerifyRoutes);
adminRouter.use('/workflows/refile', refileRoutes);
adminRouter.use('/workflows/custody-move', custodyMoveRoutes);

// Shared/root-level modules (storage, box, settings define their own sub-paths)
adminRouter.use('/', storageRoutes);
adminRouter.use('/', boxRoutes);
adminRouter.use('/', settingRoutes);

export default adminRouter;
