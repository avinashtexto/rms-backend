import { Response, NextFunction } from 'express';
import { ReasonCodeService } from './reasonCode.service';
import { createReasonCodeSchema, updateReasonCodeSchema } from './reasonCode.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class ReasonCodeController {
  static async listReasonCodes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string | undefined;
      const reasonCodes = await ReasonCodeService.listReasonCodes(companyId);
      res.status(200).json({
        success: true,
        data: reasonCodes
      });
    } catch (error) {
      next(error);
    }
  }

  static async getReasonCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const reasonCodeId = req.params.reasonCodeId as string;
      const reasonCode = await ReasonCodeService.getReasonCode(reasonCodeId);
      res.status(200).json({
        success: true,
        data: reasonCode
      });
    } catch (error) {
      next(error);
    }
  }

  static async createReasonCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = createReasonCodeSchema.parse(req.body);
      const reasonCode = await ReasonCodeService.createReasonCode(
        data.companyId,
        data.code,
        data.label,
        data.appliesTo,
        data.isActive
      );
      res.status(201).json({
        success: true,
        data: reasonCode
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateReasonCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const reasonCodeId = req.params.reasonCodeId as string;
      const data = updateReasonCodeSchema.parse(req.body);
      const reasonCode = await ReasonCodeService.updateReasonCode(reasonCodeId, data.label, data.appliesTo, data.isActive);
      res.status(200).json({
        success: true,
        data: reasonCode
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteReasonCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const reasonCodeId = req.params.reasonCodeId as string;
      await ReasonCodeService.deleteReasonCode(reasonCodeId);
      res.status(200).json({
        success: true,
        message: 'Reason code deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
