import { Router } from 'express';
import { BoxTypeController } from './box-type.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();
router.use(requireAuth as any);

router.get('/', BoxTypeController.list as any);
router.post('/', BoxTypeController.create as any);
router.put('/:id', BoxTypeController.update as any);
router.delete('/:id', BoxTypeController.delete as any);

export default router;
