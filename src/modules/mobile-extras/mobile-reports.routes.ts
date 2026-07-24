import { Router, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { AuthenticatedRequest } from '../auth/auth.types';
import { prisma } from '../../lib/prisma';

/**
 * Mobile reports endpoints (ReportsApiService).
 *
 *   GET /reports?type=                 -> List<ReportDto>
 *   GET /reports/activity-history?limit=  -> List<ActivityHistoryDto>   (real, from AuditLog)
 *   GET /reports/:id/download          -> String (download URL)
 *
 * The admin reports module is job-based (`/generate`, `/jobs/:id`) with a
 * different shape and is not on the mobile surface, so these are provided
 * separately. `activity-history` is backed by the real immutable AuditLog;
 * the report list is empty until a mobile-shaped Report model exists.
 */
const router = Router();

router.use(requireAuth as any);

function auditEntityRef(log: any): { entityType: string; entityId: string } {
  if (log.boxId) return { entityType: 'Box', entityId: log.boxId };
  if (log.fileRecordId) return { entityType: 'FileRecord', entityId: log.fileRecordId };
  if (log.locationId) return { entityType: 'Location', entityId: log.locationId };
  if (log.warehouseId) return { entityType: 'Warehouse', entityId: log.warehouseId };
  if (log.branchId) return { entityType: 'Branch', entityId: log.branchId };
  return { entityType: 'System', entityId: log.id };
}

// GET /reports?type=
router.get('/reports', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // No mobile-shaped Report model yet; return an empty list rather than 404.
    res.status(200).json({ success: true, data: [] });
  } catch (error) {
    next(error);
  }
});

// GET /reports/activity-history?limit=
router.get('/reports/activity-history', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const rawLimit = parseInt((req.query.limit as string) || '50', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;

    const logs = await prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    const data = logs.map((log) => {
      const ref = auditEntityRef(log);
      return {
        id: log.id,
        action: String(log.action),
        entityType: ref.entityType,
        entityId: ref.entityId,
        description: `${String(log.action)} on ${ref.entityType}`,
        performedBy: log.userId,
        performedAt: log.createdAt,
        metadata: null as Record<string, string> | null
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// GET /reports/:id/download
router.get('/reports/:id/download', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    // Return a resolvable URL string; no generated report files exist on mobile yet.
    res.status(200).json({ success: true, data: `/api/v1/mobile/reports/${id}/download` });
  } catch (error) {
    next(error);
  }
});

export default router;
