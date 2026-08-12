import { Router } from 'express';
import { RackTemplateController } from './rack-template.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', RackTemplateController.list as any);
router.post('/', RackTemplateController.create as any);
router.put('/:id', RackTemplateController.update as any);
router.delete('/:id', RackTemplateController.delete as any);
router.post('/apply', RackTemplateController.apply as any);

export default router;
