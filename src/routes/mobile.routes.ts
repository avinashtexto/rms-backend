import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import splashRoutes from '../modules/splash/splash.routes';
import freshBoxMoveRoutes from '../modules/workflow/fresh-box-move.routes';
import inventoryVerifyRoutes from '../modules/workflow/inventory-verify.routes';
import refileRoutes from '../modules/workflow/refile.routes';
import custodyMoveRoutes from '../modules/workflow/custody-move.routes';
import syncRoutes from '../modules/sync/sync.routes';
import gpsRoutes from '../modules/gps/gps.routes';
import notificationRoutes from '../modules/notification/notification.routes';
import boxRoutes from '../modules/box/box.routes';
import storageRoutes from '../modules/storage/storage.routes';

const mobileRouter = Router();

// Mount mobile-specific route groups
mobileRouter.use('/auth', authRoutes);
mobileRouter.use('/splash', splashRoutes);
mobileRouter.use('/workflows/fresh-box-move', freshBoxMoveRoutes);
mobileRouter.use('/workflows/inventory-verify', inventoryVerifyRoutes);
mobileRouter.use('/workflows/refile', refileRoutes);
mobileRouter.use('/workflows/custody', custodyMoveRoutes);
mobileRouter.use('/sync', syncRoutes);
mobileRouter.use('/gps', gpsRoutes);
mobileRouter.use('/notifications', notificationRoutes);

// Shared/root-level modules (these expose barcode lookups like '/boxes/barcode/:barcode', etc.)
mobileRouter.use('/', boxRoutes);
mobileRouter.use('/', storageRoutes);

export default mobileRouter;
