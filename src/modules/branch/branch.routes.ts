import { Router } from 'express';
import { BranchController } from './branch.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('branch:view') as any, BranchController.listBranches as any);
router.get('/:id', requirePermission('branch:view') as any, BranchController.getBranchById as any);
router.post('/', requirePermission('branch:manage') as any, BranchController.createBranch as any);
router.put('/:id', requirePermission('branch:manage') as any, BranchController.updateBranch as any);
router.delete('/:id', requirePermission('branch:manage') as any, BranchController.deleteBranch as any);

export default router;
