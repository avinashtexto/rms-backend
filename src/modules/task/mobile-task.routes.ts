import { Router, Response } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { TaskService } from './task.service';

const router = Router();

router.use(requireAuth as any);

/**
 * GET /api/v1/mobile/tasks
 * Get My Assigned Tasks
 */
router.get('/', async (req: any, res: Response, next: any) => {
  try {
    const tasks = await TaskService.getMyTasks(req.query, req.user);
    res.json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/mobile/tasks/:id
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
 * POST /api/v1/mobile/tasks/:id/accept
 * Accept Task
 */
router.post('/:id/accept', async (req: any, res: Response, next: any) => {
  try {
    const task = await TaskService.acceptTask(req.params.id, req.user);
    res.json({ success: true, message: 'Task accepted', data: task });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/mobile/tasks/:id/start
 * Start Task
 */
router.post('/:id/start', async (req: any, res: Response, next: any) => {
  try {
    const task = await TaskService.startTask(req.params.id, req.user);
    res.json({ success: true, message: 'Task started', data: task });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/mobile/tasks/:id/complete
 * Complete Task (Validates and performs operational completion)
 */
router.post('/:id/complete', async (req: any, res: Response, next: any) => {
  try {
    const task = await TaskService.completeTask(req.params.id, req.body, req.user);
    res.json({ success: true, message: 'Task completed successfully', data: task });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/mobile/tasks/:id/reject
 * Reject Task
 */
router.post('/:id/reject', async (req: any, res: Response, next: any) => {
  try {
    const { reason } = req.body;
    const task = await TaskService.rejectTask(req.params.id, reason, req.user);
    res.json({ success: true, message: 'Task rejected', data: task });
  } catch (error) {
    next(error);
  }
});

export default router;
