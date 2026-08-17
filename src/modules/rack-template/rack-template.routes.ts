import { Router } from 'express';
import { RackTemplateController } from './rack-template.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { blockForWarehouseManager, enforceWarehouseScope } from '../../middleware/warehouse-scope.middleware';

const router = Router();

router.use(requireAuth as any);
router.use(enforceWarehouseScope as any);

// Warehouse Managers & Company/Super Admins can VIEW, PREVIEW, and APPLY templates
router.get('/', requirePermission('rack-template:view') as any, RackTemplateController.list as any);
router.get('/:id', requirePermission('rack-template:view') as any, RackTemplateController.getById as any);
router.post('/preview', requirePermission('rack-template:preview') as any, RackTemplateController.previewDraft as any);
router.post('/:id/preview', requirePermission('rack-template:preview') as any, RackTemplateController.previewById as any);
router.post('/apply', requirePermission('rack-template:apply') as any, RackTemplateController.applyLegacy as any);
router.post('/:id/apply', requirePermission('rack-template:apply') as any, RackTemplateController.apply as any);

// Only Company Admin & Super Admin can CREATE, UPDATE, DELETE, CLONE, or CHANGE STATUS of company templates
router.post('/', blockForWarehouseManager as any, requirePermission('rack-template:create') as any, RackTemplateController.create as any);
router.put('/:id', blockForWarehouseManager as any, requirePermission('rack-template:update') as any, RackTemplateController.update as any);
router.delete('/:id', blockForWarehouseManager as any, requirePermission('rack-template:delete') as any, RackTemplateController.remove as any);
router.post('/:id/clone', blockForWarehouseManager as any, requirePermission('rack-template:clone') as any, RackTemplateController.clone as any);
router.patch('/:id/activate', blockForWarehouseManager as any, requirePermission('rack-template:update') as any, RackTemplateController.activate as any);
router.patch('/:id/deactivate', blockForWarehouseManager as any, requirePermission('rack-template:update') as any, RackTemplateController.deactivate as any);

export default router;
