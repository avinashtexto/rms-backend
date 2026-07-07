import { Router } from 'express';
import { StorageController } from './storage.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

// Rooms
router.get('/warehouses/:warehouseId/rooms', requirePermission('warehouse:view') as any, StorageController.listRooms as any);
router.post('/warehouses/:warehouseId/rooms', requirePermission('warehouse:manage') as any, StorageController.createRoom as any);
router.put('/rooms/:roomId', requirePermission('warehouse:manage') as any, StorageController.updateRoom as any);

// Racks
router.get('/rooms/:roomId/racks', requirePermission('warehouse:view') as any, StorageController.listRacks as any);
router.post('/rooms/:roomId/racks', requirePermission('warehouse:manage') as any, StorageController.createRack as any);
router.put('/racks/:rackId', requirePermission('warehouse:manage') as any, StorageController.updateRack as any);

// Shelves
router.get('/racks/:rackId/shelves', requirePermission('warehouse:view') as any, StorageController.listShelves as any);
router.post('/racks/:rackId/shelves', requirePermission('warehouse:manage') as any, StorageController.createShelf as any);
router.put('/shelves/:shelfId', requirePermission('warehouse:manage') as any, StorageController.updateShelf as any);

// Locations
router.get('/shelves/:shelfId/locations', requirePermission('warehouse:view') as any, StorageController.listLocations as any);
router.post('/shelves/:shelfId/locations', requirePermission('warehouse:manage') as any, StorageController.createLocation as any);
router.put('/locations/:locationId', requirePermission('warehouse:manage') as any, StorageController.updateLocation as any);

// Barcode lookup
router.get('/locations/barcode/:barcode', requirePermission('warehouse:view') as any, StorageController.resolveBarcode as any);

export default router;
