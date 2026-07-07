import { Router } from 'express';
import { RoleController } from './role.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

// Apply auth middleware to all routes in this router
router.use(requireAuth as any);

router.get('/roles', requirePermission('role:view') as any, RoleController.listRoles as any);
router.post('/roles', requirePermission('role:manage') as any, RoleController.createRole as any);
router.put('/roles/:roleId', requirePermission('role:manage') as any, RoleController.updateRole as any);

router.get('/permissions', requirePermission('permission:view') as any, RoleController.listPermissions as any);
router.put('/roles/:roleId/permissions', requirePermission('role:manage') as any, RoleController.assignPermissions as any);

export default router;
