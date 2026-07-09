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

  static async getAssignedTransfers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const operatorId = req.user!.id;
      const transfers = await CustodyMoveService.getAssignedTransfers(companyId, operatorId);
      res.status(200).json({ success: true, data: transfers });
    } catch (error) {
      next(error);
    }
  }

  static async completeTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const operatorId = req.user!.id;
      const transferId = req.params.id as string;
      const transfer = await CustodyMoveService.completeTransfer(companyId, operatorId, transferId);
      res.status(200).json({ success: true, data: transfer });
    } catch (error) {
      next(error);
    }
  }

  static async scanBox(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const barcode = req.params.barcode as string;
      const box = await CustodyMoveService.scanBox(companyId, barcode);
      res.status(200).json({ success: true, data: box });
    } catch (error) {
      next(error);
    }
  }

  static async listTransfers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const transfers = await CustodyMoveService.listTransfers(companyId, page, pageSize);
      res.status(200).json({ success: true, data: transfers });
    } catch (error) {
      next(error);
    }
  }
}
