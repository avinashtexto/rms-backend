import { Router } from 'express';
import { FileRecordController } from './fileRecord.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('file:view') as any, FileRecordController.listFileRecords as any);
router.post('/bulk-generate', requirePermission('file:manage') as any, FileRecordController.bulkGenerate as any);
router.post('/bulk-action', requirePermission('file:manage') as any, FileRecordController.bulkAction as any);
router.post('/bulk-import', requirePermission('file:manage') as any, FileRecordController.bulkImport as any);
router.get('/:fileRecordId', requirePermission('file:view') as any, FileRecordController.getFileRecord as any);
router.post('/', requirePermission('file:manage') as any, FileRecordController.createFileRecord as any);
router.put('/:fileRecordId', requirePermission('file:manage') as any, FileRecordController.updateFileRecord as any);
router.delete('/:fileRecordId', requirePermission('file:manage') as any, FileRecordController.deleteFileRecord as any);

export default router;
