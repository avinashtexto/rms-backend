import { Router } from 'express';
import { FileTypeController } from './file-type.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();
router.use(requireAuth as any);

router.get('/', FileTypeController.list as any);
router.post('/', FileTypeController.create as any);
router.put('/:id', FileTypeController.update as any);
router.delete('/:id', FileTypeController.delete as any);

export default router;
