import { Router } from 'express';
import { AuditController } from './audit.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('audit:view') as any, AuditController.listAuditLogs as any);
router.get('/:auditLogId', requirePermission('audit:view') as any, AuditController.getAuditLogById as any);

export default router;
