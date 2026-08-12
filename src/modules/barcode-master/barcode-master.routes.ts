import { Router } from 'express';
import { BarcodeMasterController } from './barcode-master.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

// Dashboard Statistics
router.get('/stats', requirePermission('settings:view') as any, BarcodeMasterController.getDashboardStats as any);

// Scanning / Validation API
router.post('/validate', BarcodeMasterController.validateBarcode as any);
router.get('/search', BarcodeMasterController.search as any);

// Bulk Operations
router.post('/generate', requirePermission('settings:manage') as any, BarcodeMasterController.bulkGenerate as any);
router.post('/import', requirePermission('settings:manage') as any, BarcodeMasterController.importBarcodes as any);
router.get('/export', requirePermission('settings:view') as any, BarcodeMasterController.exportBarcodes as any);
router.post('/print', requirePermission('settings:view') as any, BarcodeMasterController.printBarcodes as any);
router.post('/bulk-action', requirePermission('settings:manage') as any, BarcodeMasterController.bulkAction as any);

// Standard CRUD Endpoints
router.get('/', requirePermission('settings:view') as any, BarcodeMasterController.list as any);
router.get('/:id', requirePermission('settings:view') as any, BarcodeMasterController.getById as any);
router.post('/', requirePermission('settings:manage') as any, BarcodeMasterController.create as any);
router.put('/:id', requirePermission('settings:manage') as any, BarcodeMasterController.update as any);
router.delete('/:id', requirePermission('settings:manage') as any, BarcodeMasterController.delete as any);

export default router;
