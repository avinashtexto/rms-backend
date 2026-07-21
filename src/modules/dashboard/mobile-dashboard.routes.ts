import { Router, Response } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { prisma } from '../../lib/prisma';

const router = Router();

router.use(requireAuth as any);

router.get('/stats', async (req: any, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const boxesProcessedToday = await prisma.freshBoxMoveScan.count({
      where: {
        scannedAt: { gte: today }
      }
    });

    const filesScannedToday = await prisma.inventoryVerificationScan.count({
      where: {
        scannedAt: { gte: today }
      }
    });

    res.json({
      totalTasks: 2,
      pendingTasks: 1,
      inProgressTasks: 1,
      completedTasks: 0,
      urgentTasks: 1,
      boxesProcessedToday,
      filesScannedToday
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
