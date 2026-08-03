import { Router } from 'express';
import { RecordsController } from './records.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/boxes', requirePermission('box:view') as any, RecordsController.listBoxes as any);
router.get(
  '/boxes/:id/timeline',
  requirePermission('box:view') as any,
  RecordsController.getBoxTimeline as any
);
router.get('/boxes/:id', requirePermission('box:view') as any, RecordsController.getBox as any);
router.patch('/boxes/:id', requirePermission('box:manage') as any, RecordsController.updateBox as any);

router.get('/files', requirePermission('file:view') as any, RecordsController.listFiles as any);
router.get(
  '/files/:id/timeline',
  requirePermission('file:view') as any,
  RecordsController.getFileTimeline as any
);
router.get('/files/:id', requirePermission('file:view') as any, RecordsController.getFile as any);
router.patch('/files/:id', requirePermission('file:manage') as any, RecordsController.updateFile as any);

export default router;
