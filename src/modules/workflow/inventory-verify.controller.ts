import { Response, NextFunction } from 'express';
import { InventoryVerifyService } from './inventory-verify.service';
import { startVerifySessionSchema, submitVerifyScanSchema } from './inventory-verify.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class InventoryVerifyController {
  static async startSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const operatorId = req.user!.id;
      const data = startVerifySessionSchema.parse(req.body);
      const session = await InventoryVerifyService.startSession(companyId, operatorId, data.boxId);
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
      const data = submitVerifyScanSchema.parse(req.body);
      const scan = await InventoryVerifyService.submitScan(companyId, operatorId, sessionId, data);
      res.status(201).json({ success: true, data: scan });
    } catch (error) {
      next(error);
    }
  }

  static async endSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const sessionId = req.params.sessionId as string;
      const session = await InventoryVerifyService.endSession(companyId, sessionId);
      res.status(200).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  static async getSessionDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const sessionId = req.params.sessionId as string;
      const session = await InventoryVerifyService.getSessionDetails(companyId, sessionId);
      res.status(200).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }
}
