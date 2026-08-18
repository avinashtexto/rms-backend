import { Router } from 'express';
import { VendorController } from './vendor.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();
router.use(requireAuth as any);

router.get('/', VendorController.list as any);
router.get('/:id', VendorController.getById as any);
router.post('/', VendorController.create as any);
router.put('/:id', VendorController.update as any);
router.patch('/:id', VendorController.update as any);
router.delete('/:id', VendorController.delete as any);

export default router;
