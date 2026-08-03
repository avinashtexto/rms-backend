import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../auth/auth.types';
import { OperationsService } from './operations.service';
import { listOperationsQuerySchema } from './operations.validation';

export class OperationsController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = listOperationsQuerySchema.parse(req.query);
      const result = await OperationsService.list(
        {
          page: query.page,
          limit: query.limit,
          type: query.type,
          status: query.status,
          mine: query.mine,
          from: query.from ? new Date(query.from) : undefined,
          to: query.to ? new Date(query.to) : undefined,
          warehouseId: query.warehouseId,
          hasMissing: query.hasMissing
        },
        {
          id: req.user!.id,
          companyId: req.user!.companyId
        }
      );
      res.status(200).json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  static async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const operation = await OperationsService.get(req.params.id as string, {
        id: req.user!.id,
        companyId: req.user!.companyId
      });
      res.status(200).json({ success: true, data: operation });
    } catch (error) {
      next(error);
    }
  }
}
