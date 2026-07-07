import { Router } from 'express';
import { ClientController } from './client.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

// Clients
router.get('/', requirePermission('client:view') as any, ClientController.listClients as any);
router.post('/', requirePermission('client:manage') as any, ClientController.createClient as any);
router.put('/:clientId', requirePermission('client:manage') as any, ClientController.updateClient as any);
router.delete('/:clientId', requirePermission('client:manage') as any, ClientController.deleteClient as any);

// Departments
router.get('/:clientId/departments', requirePermission('client:view') as any, ClientController.listDepartments as any);
router.post('/:clientId/departments', requirePermission('client:manage') as any, ClientController.createDepartment as any);
router.put('/departments/:departmentId', requirePermission('client:manage') as any, ClientController.updateDepartment as any);
router.delete('/departments/:departmentId', requirePermission('client:manage') as any, ClientController.deleteDepartment as any);

export default router;
