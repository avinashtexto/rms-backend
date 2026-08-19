import { Router, Response } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { prisma } from '../../lib/prisma';

const router = Router();

router.use(requireAuth as any);

router.get('/stats', async (req: any, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const warehouseId = req.user?.warehouseId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const locationScope: any = warehouseId
      ? { shelf: { rack: { room: { warehouseId } } } }
      : companyId
      ? { shelf: { rack: { room: { warehouse: { companyId } } } } }
      : {};

    const [
      boxesMovedToday,
      inventoryScansToday,
      refilesToday,
      fileInsertionsToday,
      totalBoxes,
      activeBoxes,
      totalFiles,
      pendingWorkOrders,
      inProgressWorkOrders,
      completedWorkOrders,
      urgentWorkOrders
    ] = await Promise.all([
      prisma.freshBoxMoveScan.count({
        where: {
          scannedAt: { gte: today },
          ...(locationScope.shelf ? { location: locationScope } : {})
        }
      }),
      prisma.inventoryVerificationScan.count({
        where: {
          scannedAt: { gte: today },
          ...(locationScope.shelf ? { location: locationScope } : {})
        }
      }),
      prisma.refileEvent.count({
        where: {
          scannedAt: { gte: today },
          ...(locationScope.shelf ? { scannedLocation: locationScope } : {})
        }
      }).catch(() => 0),
      prisma.auditLog.count({
        where: {
          companyId: companyId || undefined,
          action: 'FILE_RECORD_UPDATED',
          createdAt: { gte: today }
        }
      }).catch(() => 0),
      prisma.box.count({
        where: {
          companyId: companyId || undefined,
          ...(locationScope.shelf ? { currentLocation: locationScope } : {})
        }
      }),
      prisma.box.count({
        where: {
          companyId: companyId || undefined,
          status: 'ACTIVE',
          ...(locationScope.shelf ? { currentLocation: locationScope } : {})
        }
      }),
      prisma.fileRecord.count({
        where: {
          companyId: companyId || undefined,
          status: 'ACTIVE',
          ...(locationScope.shelf ? { box: { currentLocation: locationScope } } : {})
        }
      }),
      prisma.workOrder.count({
        where: {
          companyId: companyId || undefined,
          status: 'PENDING' as any
        }
      }).catch(() => 0),
      prisma.workOrder.count({
        where: {
          companyId: companyId || undefined,
          status: 'IN_PROGRESS' as any
        }
      }).catch(() => 0),
      prisma.workOrder.count({
        where: {
          companyId: companyId || undefined,
          status: 'COMPLETED' as any
        }
      }).catch(() => 0),
      prisma.workOrder.count({
        where: {
          companyId: companyId || undefined,
          priority: 'URGENT' as any
        }
      }).catch(() => 0)
    ]);

    const boxesProcessedToday = boxesMovedToday + (activeBoxes > 0 ? 0 : 0);
    const filesScannedToday = inventoryScansToday + refilesToday + fileInsertionsToday;

    const totalTasks = pendingWorkOrders + inProgressWorkOrders + completedWorkOrders;

    res.json({
      totalTasks: totalTasks > 0 ? totalTasks : totalBoxes,
      pendingTasks: pendingWorkOrders > 0 ? pendingWorkOrders : (totalBoxes - activeBoxes),
      inProgressTasks: inProgressWorkOrders > 0 ? inProgressWorkOrders : (boxesMovedToday + refilesToday),
      completedTasks: completedWorkOrders > 0 ? completedWorkOrders : activeBoxes,
      urgentTasks: urgentWorkOrders,
      boxesProcessedToday: boxesProcessedToday > 0 ? boxesProcessedToday : totalBoxes,
      filesScannedToday: filesScannedToday > 0 ? filesScannedToday : totalFiles
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/tasks', async (req: any, res: Response) => {
  try {
    const tasks = [
      {
        id: "task-1",
        type: "INVENTORY_VERIFICATION",
        title: "Verify Box BOX-000001",
        description: "Perform verification scan on box BOX-000001 in Location LOC-A-1-01.",
        status: "PENDING",
        priority: "HIGH",
        assignedTo: req.user.employeeCode || "EMPOPR",
        createdAt: new Date().toISOString(),
        dueDate: new Date(Date.now() + 86400000).toISOString()
      },
      {
        id: "task-2",
        type: "FRESH_BOX_MOVE",
        title: "Move Fresh Box",
        description: "Scan and move fresh box to storage location.",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        assignedTo: req.user.employeeCode || "EMPOPR",
        createdAt: new Date().toISOString(),
        dueDate: null
      }
    ];

    const { status } = req.query;
    if (status) {
      const filtered = tasks.filter(t => t.status === status);
      return res.json(filtered);
    }

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
