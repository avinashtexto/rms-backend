import { Response, NextFunction } from 'express';
import { GpsService } from './gps.service';
import { trackGpsSchema, historyQuerySchema } from './gps.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class GpsController {
  static async trackGps(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const data = trackGpsSchema.parse(req.body);
      const track = await GpsService.trackGps(userId, data);
      res.status(201).json({ success: true, data: track });
    } catch (error) {
      next(error);
    }
  }

  static async getLastKnownLocation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const userId = req.params.userId as string;
      const track = await GpsService.getLastKnownLocation(companyId, userId);
      res.status(200).json({ success: true, data: track });
    } catch (error) {
      next(error);
    }
  }

  static async getHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const userId = req.params.userId as string;
      const query = historyQuerySchema.parse(req.query);
      const history = await GpsService.getHistory(companyId, userId, query.start, query.end);
      res.status(200).json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  }

  static async getLiveWarehouseUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const warehouseId = req.params.warehouseId as string;
      const liveUsers = await GpsService.getLiveWarehouseUsers(companyId, warehouseId);
      res.status(200).json({ success: true, data: liveUsers });
    } catch (error) {
      next(error);
    }
  }
}
