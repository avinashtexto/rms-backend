import { Router, Response } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { TaskService } from './task.service';

const router = Router();

router.use(requireAuth as any);

/**
 * GET /api/v1/admin/tasks/assignees
 * List users eligible for task assignment in current warehouse/company scope
 */
router.get('/assignees', async (req: any, res: Response, next: any) => {
  try {
    const warehouseId = req.query.warehouseId as string | undefined;
    const users = await TaskService.getEligibleAssignees(req.user, warehouseId);
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/admin/tasks
 * Create & Assign Task
 */
router.post('/', async (req: any, res: Response, next: any) => {
  try {
    const task = await TaskService.createTask(req.body, req.user);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/tasks
 * List Tasks (Filtered)
 */
router.get('/', async (req: any, res: Response, next: any) => {
  try {
    const tasks = await TaskService.getAdminTasks(req.query, req.user);
    res.json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/tasks/:id
 * Get Task Details
 */
router.get('/:id', async (req: any, res: Response, next: any) => {
  try {
    const task = await TaskService.getTaskById(req.params.id, req.user);
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/admin/tasks/:id/reassign
 * Reassign Task
 */
router.post('/:id/reassign', async (req: any, res: Response, next: any) => {
  try {
    const { newAssigneeId } = req.body;
    if (!newAssigneeId) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ASSIGNEE', message: 'newAssigneeId is required.' } });
    }
    const task = await TaskService.reassignTask(req.params.id, newAssigneeId, req.user);
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/admin/tasks/:id/cancel
 * Cancel Task
 */
router.post('/:id/cancel', async (req: any, res: Response, next: any) => {
  try {
    const task = await TaskService.cancelTask(req.params.id, req.user);
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

export default router;
