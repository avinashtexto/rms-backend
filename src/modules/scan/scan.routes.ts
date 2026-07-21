import { Router } from 'express';
import { ScanController } from './scan.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

// Barcode lookup endpoint
router.get('/lookup', requirePermission('workflow:execute') as any, ScanController.lookupBarcode as any);

// Submit scan endpoint
router.post('/', requirePermission('workflow:execute') as any, ScanController.submitScan as any);

export default router;
