import { Response, NextFunction } from 'express';
import { SyncService } from './sync.service';
import { syncBatchSchema, resolveConflictSchema } from './sync.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class SyncController {
  static async syncBatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const operatorId = req.user!.id;
      const data = syncBatchSchema.parse(req.body);
      const result = await SyncService.syncBatch(companyId, operatorId, data.deviceId, data.events);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getSyncStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const deviceId = req.params.deviceId as string;
      const status = await SyncService.getSyncStatus(companyId, deviceId);
      res.status(200).json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  static async listConflicts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const conflicts = await SyncService.listConflicts(companyId);
      res.status(200).json({ success: true, data: conflicts });
    } catch (error) {
      next(error);
    }
  }

  static async resolveConflict(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const operatorId = req.user!.id;
      const conflictId = req.params.conflictId as string;
      const data = resolveConflictSchema.parse(req.body);
      const result = await SyncService.resolveConflict(companyId, operatorId, conflictId, data.resolution);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
