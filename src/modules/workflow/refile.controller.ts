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
}
