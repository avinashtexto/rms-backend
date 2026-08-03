import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { MetaController } from './users.controller';

const router = Router();

router.use(requireAuth as any);
router.get('/permissions', MetaController.getPermissions as any);

export default router;
