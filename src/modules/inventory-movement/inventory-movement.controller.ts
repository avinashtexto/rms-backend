import { Request, Response, NextFunction } from 'express';
import { InventoryMovementService } from './inventory-movement.service';

export class InventoryMovementController {
  static async listHistory(req: any, res: Response, next: NextFunction) {
    try {
      const data = await InventoryMovementService.listHistory(req.user.companyId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async recordMovement(req: any, res: Response, next: NextFunction) {
    try {
      const data = await InventoryMovementService.recordMovement(
        req.user.companyId,
        req.user.id,
        req.body
      );
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }
}
