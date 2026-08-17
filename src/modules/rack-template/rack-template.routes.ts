import { Router } from 'express';
import { RackTemplateController } from './rack-template.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('rack-template:view') as any, RackTemplateController.list as any);
router.post('/', requirePermission('rack-template:create') as any, RackTemplateController.create as any);
router.post('/preview', requirePermission('rack-template:preview') as any, RackTemplateController.previewDraft as any);
router.post('/apply', requirePermission('rack-template:apply') as any, RackTemplateController.applyLegacy as any);

router.get('/:id', requirePermission('rack-template:view') as any, RackTemplateController.getById as any);
router.put('/:id', requirePermission('rack-template:update') as any, RackTemplateController.update as any);
router.delete('/:id', requirePermission('rack-template:delete') as any, RackTemplateController.remove as any);
router.post('/:id/clone', requirePermission('rack-template:clone') as any, RackTemplateController.clone as any);
router.post('/:id/preview', requirePermission('rack-template:preview') as any, RackTemplateController.previewById as any);
router.post('/:id/apply', requirePermission('rack-template:apply') as any, RackTemplateController.apply as any);
router.patch('/:id/activate', requirePermission('rack-template:update') as any, RackTemplateController.activate as any);
router.patch('/:id/deactivate', requirePermission('rack-template:update') as any, RackTemplateController.deactivate as any);

export default router;
