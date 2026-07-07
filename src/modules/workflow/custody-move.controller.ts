import { Response, NextFunction } from 'express';
import { CustodyMoveService } from './custody-move.service';
import { segregateBoxSchema, mergeBoxesSchema, initiateTransferSchema } from './custody-move.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class CustodyMoveController {
  static async segregateBox(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const operatorId = req.user!.id;
      const data = segregateBoxSchema.parse(req.body);
      const session = await CustodyMoveService.segregateBox(companyId, operatorId, data);
      res.status(200).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  static async mergeBoxes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const operatorId = req.user!.id;
      const data = mergeBoxesSchema.parse(req.body);
      const session = await CustodyMoveService.mergeBoxes(companyId, operatorId, data.sourceBoxId, data.targetBoxId);
      res.status(200).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  static async initiateTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const operatorId = req.user!.id;
      const data = initiateTransferSchema.parse(req.body);
      const transfer = await CustodyMoveService.initiateTransfer(companyId, operatorId, data);
      res.status(201).json({ success: true, data: transfer });
    } catch (error) {
      next(error);
    }
  }

  static async acceptTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const operatorId = req.user!.id;
      const transferId = req.params.transferId as string;
      const transfer = await CustodyMoveService.acceptTransfer(companyId, operatorId, transferId);
      res.status(200).json({ success: true, data: transfer });
    } catch (error) {
      next(error);
    }
  }
}
