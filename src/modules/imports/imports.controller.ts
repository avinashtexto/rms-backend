import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../auth/auth.types';
import { ImportsService } from './imports.service';
import { recordsImportSchema, segregationPlanImportSchema } from './imports.validation';

function currentUser(req: AuthenticatedRequest) {
  return { id: req.user!.id, companyId: req.user!.companyId };
}

export class ImportsController {
  static async importRecords(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const body = recordsImportSchema.parse(req.body);
      const result = await ImportsService.importRecords(body.rows, currentUser(req));
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async importSegregationPlan(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const body = segregationPlanImportSchema.parse(req.body);
      const result = ImportsService.importSegregationPlan(body.rows, currentUser(req));
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async listSegregationPlan(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = ImportsService.listSegregationPlan(currentUser(req));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
