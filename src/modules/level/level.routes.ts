import { Router, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { enforceWarehouseScope } from '../../middleware/warehouse-scope.middleware';
import { AuthenticatedRequest } from '../auth/auth.types';
import { prisma } from '../../lib/prisma';
import { RackService } from '../rack/rack.service';

const router = Router();

router.use(requireAuth as any);
router.use(enforceWarehouseScope as any);

// GET /levels?rackId=...&warehouseId=...
router.get('/', requirePermission(['rack:view', 'storage:view']) as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';
    const rackId = req.query.rackId as string | undefined;
    const warehouseId = (isWarehouseManager
      ? req.user?.warehouseId
      : (req.query.warehouseId as string | undefined)) ?? undefined;

    const levels = await prisma.level.findMany({
      where: {
        ...(rackId ? { rackId } : {}),
        ...(warehouseId ? { rack: { room: { warehouseId } } } : {}),
        ...(req.user?.companyId && req.user.roleName !== 'SUPER_ADMIN'
          ? { rack: { room: { warehouse: { companyId: req.user.companyId } } } }
          : {})
      },
      include: {
        rack: {
          select: {
            id: true,
            name: true,
            code: true,
            roomId: true,
            room: {
              select: {
                id: true,
                name: true,
                code: true,
                warehouseId: true
              }
            }
          }
        },
        _count: {
          select: {
            locations: true
          }
        }
      },
      orderBy: { code: 'asc' }
    });

    res.status(200).json({ success: true, data: levels });
  } catch (err) {
    next(err);
  }
});

// GET /levels/:id
router.get('/:id', requirePermission(['rack:view', 'storage:view']) as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const levelId = req.params.id as string;
    const level = await prisma.level.findUnique({
      where: { id: levelId },
      include: {
        rack: {
          include: {
            room: {
              include: {
                warehouse: true
              }
            }
          }
        },
        locations: true
      }
    });

    if (!level) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Level not found' } });
    }

    res.status(200).json({ success: true, data: level });
  } catch (err) {
    next(err);
  }
});

// POST /levels { rackId, name, code }
router.post('/', requirePermission(['rack:manage', 'storage:manage']) as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { rackId, name, code } = req.body ?? {};
    if (!rackId || !name || !code) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'rackId, name, and code are required' }
      });
    }

    const level = await RackService.createLevel(String(rackId), String(name), String(code));
    res.status(201).json({ success: true, data: level });
  } catch (err) {
    next(err);
  }
});

// DELETE /levels/:id
router.delete('/:id', requirePermission(['rack:manage', 'storage:manage']) as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const levelId = req.params.id as string;
    const level = await prisma.level.findUnique({
      where: { id: levelId }
    });

    if (!level) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Level not found' } });
    }

    await RackService.deleteLevel(level.rackId, levelId);
    res.status(200).json({ success: true, message: 'Level deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
