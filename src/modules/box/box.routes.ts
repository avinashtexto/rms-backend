import { Router } from 'express';
import { BoxController } from './box.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

// Global Search
router.get('/search', requirePermission('box:view') as any, BoxController.search as any);

// Resolve Barcode
router.get('/boxes/barcode/:barcode', requirePermission('box:view') as any, BoxController.resolveBoxBarcode as any);
router.get('/files/barcode/:barcode', requirePermission('file:view') as any, BoxController.resolveFileBarcode as any);

// Boxes CRUD
router.get('/boxes', requirePermission('box:view') as any, BoxController.listBoxes as any);
router.get('/boxes/:boxId', requirePermission('box:view') as any, BoxController.getBoxById as any);
router.post('/boxes', requirePermission('box:manage') as any, BoxController.createBox as any);
router.put('/boxes/:boxId', requirePermission('box:manage') as any, BoxController.updateBox as any);
router.delete('/boxes/:boxId', requirePermission('box:manage') as any, BoxController.deleteBox as any);

// File Records nested under boxes
router.get('/boxes/:boxId/files', requirePermission('file:view') as any, BoxController.listFilesByBox as any);
router.post('/boxes/:boxId/files', requirePermission('file:manage') as any, BoxController.createFileRecord as any);

// File Record modifications
router.put('/files/:fileRecordId', requirePermission('file:manage') as any, BoxController.updateFileRecord as any);

export default router;
