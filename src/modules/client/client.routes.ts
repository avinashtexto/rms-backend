import { Router } from 'express';
import { ClientController } from './client.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

// Clients
router.get('/', requirePermission('client:view') as any, ClientController.listClients as any);
router.get('/:id', requirePermission('client:view') as any, ClientController.getClientById as any);
router.post('/', requirePermission('client:manage') as any, ClientController.createClient as any);
router.put('/:id', requirePermission('client:manage') as any, ClientController.updateClient as any);
router.delete('/:id', requirePermission('client:manage') as any, ClientController.deleteClient as any);

// Departments
router.get('/:id/departments', requirePermission('client:view') as any, ClientController.listDepartments as any);
router.post('/:id/departments', requirePermission('client:manage') as any, ClientController.createDepartment as any);
router.put('/departments/:id', requirePermission('client:manage') as any, ClientController.updateDepartment as any);
router.delete('/departments/:id', requirePermission('client:manage') as any, ClientController.deleteDepartment as any);

export default router;
