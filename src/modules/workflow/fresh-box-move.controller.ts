import { Response, NextFunction } from 'express';
import { FreshBoxMoveService } from './fresh-box-move.service';
import { startSessionSchema, submitScanSchema } from './fresh-box-move.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class FreshBoxMoveController {
  static async startSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const operatorId = req.user!.id;
      const data = startSessionSchema.parse(req.body);
      const session = await FreshBoxMoveService.startSession(operatorId, data.deviceId);
      res.status(201).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  static async submitScan(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const operatorId = req.user!.id;
      const sessionId = req.params.sessionId as string;
      const data = submitScanSchema.parse(req.body);
      const scan = await FreshBoxMoveService.submitScan(companyId, operatorId, sessionId, data);
      res.status(201).json({ success: true, data: scan });
    } catch (error) {
      next(error);
    }
  }

  static async endSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const sessionId = req.params.sessionId as string;
      const session = await FreshBoxMoveService.endSession(companyId, sessionId);
      res.status(200).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  static async getSessionDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const sessionId = req.params.sessionId as string;
      const session = await FreshBoxMoveService.getSessionDetails(companyId, sessionId);
      res.status(200).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }
}
