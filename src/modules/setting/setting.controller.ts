import { Response, NextFunction } from 'express';
import { SettingService } from './setting.service';
import { createReasonCodeSchema, updateCompanySchema } from './setting.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class SettingController {
  static async listReasonCodes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const appliesTo = req.query.appliesTo as string | undefined;
      const list = await SettingService.listReasonCodes(companyId, appliesTo);
      res.status(200).json({ success: true, data: list });
    } catch (error) {
      next(error);
    }
  }

  static async createReasonCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const data = createReasonCodeSchema.parse(req.body);
      const code = await SettingService.createReasonCode(companyId, data.code, data.label, data.appliesTo);
      res.status(201).json({ success: true, data: code });
    } catch (error) {
      next(error);
    }
  }

  static async getCompanySettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const settings = await SettingService.getCompanySettings(companyId);
      res.status(200).json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  static async updateCompanySettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const data = updateCompanySchema.parse(req.body);
      const settings = await SettingService.updateCompanySettings(companyId, data.name);
      res.status(200).json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }
}
