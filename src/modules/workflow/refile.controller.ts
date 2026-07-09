import { Response, NextFunction } from 'express';
import { RefileService } from './refile.service';
import { submitRefileScanSchema } from './refile.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class RefileController {
  static async submitScan(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const operatorId = req.user!.id;
      const data = submitRefileScanSchema.parse(req.body);
      const result = await RefileService.submitRefileScan(companyId, operatorId, data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async listRefileScans(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const scans = await RefileService.listRefileScans(companyId, page, pageSize);
      res.status(200).json({ success: true, data: scans });
    } catch (error) {
      next(error);
    }
  }
}
