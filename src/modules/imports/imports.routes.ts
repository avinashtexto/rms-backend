import { Router } from 'express';
import { ImportsController } from './imports.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.post(
  '/records',
  requirePermission('box:manage') as any,
  ImportsController.importRecords as any
);
router.post(
  '/segregation-plan',
  requirePermission('box:manage') as any,
  ImportsController.importSegregationPlan as any
);
router.get(
  '/segregation-plan',
  requirePermission('box:view') as any,
  ImportsController.listSegregationPlan as any
);

export default router;
