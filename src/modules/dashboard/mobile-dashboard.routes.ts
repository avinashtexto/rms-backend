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
      }).catch(() => 0),
      prisma.inventoryVerificationScan.count({
        where: {
          scannedAt: { gte: today },
          ...(locationScope.shelf ? { box: { currentLocation: locationScope } } : {})
        }
      }).catch(() => 0),
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
      }).catch(() => 0),
      prisma.box.count({
        where: {
          companyId: companyId || undefined,
          status: 'ACTIVE',
          ...(locationScope.shelf ? { currentLocation: locationScope } : {})
        }
      }).catch(() => 0),
      prisma.fileRecord.count({
        where: {
          companyId: companyId || undefined,
          status: 'ACTIVE',
          ...(locationScope.shelf ? { box: { currentLocation: locationScope } } : {})
        }
      }).catch(() => 0),
      prisma.task.count({
        where: {
          companyId: companyId || undefined,
          assignedToId: req.user.id,
          status: 'ASSIGNED'
        }
      }).catch(() => 0),
      prisma.task.count({
        where: {
          companyId: companyId || undefined,
          assignedToId: req.user.id,
          status: 'IN_PROGRESS'
        }
      }).catch(() => 0),
      prisma.task.count({
        where: {
          companyId: companyId || undefined,
          assignedToId: req.user.id,
          status: 'COMPLETED'
        }
      }).catch(() => 0),
      prisma.task.count({
        where: {
          companyId: companyId || undefined,
          assignedToId: req.user.id,
          priority: 'URGENT'
        }
      }).catch(() => 0)
    ]);

    const boxesProcessedToday = boxesMovedToday + (activeBoxes > 0 ? 0 : 0);
    const filesScannedToday = inventoryScansToday + refilesToday + fileInsertionsToday;

    const totalTasks = pendingWorkOrders + inProgressWorkOrders + completedWorkOrders;

    res.json({
      success: true,
      data: {
        totalTasks: totalTasks > 0 ? totalTasks : totalBoxes,
        pendingTasks: pendingWorkOrders > 0 ? pendingWorkOrders : (totalBoxes - activeBoxes),
        inProgressTasks: inProgressWorkOrders > 0 ? inProgressWorkOrders : (boxesMovedToday + refilesToday),
        completedTasks: completedWorkOrders > 0 ? completedWorkOrders : activeBoxes,
        urgentTasks: urgentWorkOrders,
        boxesProcessedToday: boxesProcessedToday > 0 ? boxesProcessedToday : totalBoxes,
        filesScannedToday: filesScannedToday > 0 ? filesScannedToday : totalFiles
      }
    });
  } catch (error) {
    console.error('MOBILE DASHBOARD STATS ERROR:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: (error as Error).message } });
  }
});

router.get('/tasks', async (req: any, res: Response) => {
  try {
    const { status } = req.query;
    const whereClause: any = {
      companyId: req.user.companyId,
      assignedToId: req.user.id
    };

    if (status) {
      whereClause.status = status;
    } else {
      whereClause.status = { not: 'CANCELLED' };
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignedBy: { select: { id: true, fullName: true, employeeCode: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        box: { select: { id: true, barcode: true, description: true } },
        file: { select: { id: true, barcode: true, title: true } },
        sourceLocation: { select: { id: true, barcode: true, name: true } },
        destinationLocation: { select: { id: true, barcode: true, name: true } }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    const formatted = tasks.map((t) => ({
      id: t.id,
      taskNumber: t.taskNumber,
      type: t.taskType,
      title: t.title,
      description: t.description || '',
      status: t.status,
      priority: t.priority,
      assignedTo: req.user.fullName || req.user.employeeCode || 'Me',
      createdAt: t.createdAt.toISOString(),
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      boxBarcode: t.box?.barcode || null,
      fileBarcode: t.file?.barcode || null,
      sourceLocation: t.sourceLocation?.barcode || null,
      destinationLocation: t.destinationLocation?.barcode || null
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
