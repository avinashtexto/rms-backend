import { Request, Response, NextFunction } from 'express';
import { WorkOrderService } from './work-order.service';

export class WorkOrderController {
  static async list(req: any, res: Response, next: NextFunction) {
    try {
      const data = await WorkOrderService.list(req.user.companyId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async create(req: any, res: Response, next: NextFunction) {
    try {
      const data = await WorkOrderService.create(req.user.companyId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WorkOrderService.updateStatus(req.params.id as string, req.body.status);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await WorkOrderService.delete(req.params.id as string);
      res.json({ success: true, message: 'Work order deleted' });
    } catch (err) { next(err); }
  }
}
