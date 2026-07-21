import { Response, NextFunction } from 'express';
import { FreshBoxMoveService } from './fresh-box-move.service';
import { startSessionSchema, submitScanSchema, freshBoxMoveSchema } from './fresh-box-move.validation';
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
      const scan = await FreshBoxMoveService.submitScan(companyId, operatorId, sessionId, {
        locationBarcode: data.locationBarcode,
        boxBarcode: data.boxBarcode,
        clientEventId: data.clientOpId, // Map clientOpId to clientEventId for service
        gpsLat: data.latitude,
        gpsLng: data.longitude,
        scannedAt: data.scannedAt ? new Date(data.scannedAt) : new Date()
      });
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

  static async listSessions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const sessions = await FreshBoxMoveService.listSessions(companyId, page, pageSize);
      res.status(200).json({ success: true, data: sessions });
    } catch (error) {
      next(error);
    }
  }

  static async submitWorkflow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const operatorId = req.user!.id;
      const data = freshBoxMoveSchema.parse(req.body);
      const result = await FreshBoxMoveService.submitWorkflow(companyId, operatorId, data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
