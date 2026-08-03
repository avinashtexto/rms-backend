import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../auth/auth.types';
import { ReportsService } from './reports.service';
import { exportReportSchema, reportDateFiltersSchema } from './reports.validation';

function actor(req: AuthenticatedRequest) {
  return {
    id: req.user!.id,
    companyId: req.user!.companyId
  };
}

function parseFilters(query: Record<string, unknown>) {
  const parsed = reportDateFiltersSchema.parse(query);
  return {
    from: parsed.from ? new Date(parsed.from) : undefined,
    to: parsed.to ? new Date(parsed.to) : undefined,
    warehouseId: parsed.warehouseId,
    clientId: parsed.clientId
  };
}

export class ReportsController {
  static async summary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { warehouseId } = reportDateFiltersSchema.parse(req.query);
      const data = await ReportsService.summary(actor(req), warehouseId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async operationsByDay(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReportsService.operationsByDay(actor(req), parseFilters(req.query));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async productivity(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReportsService.productivity(actor(req), parseFilters(req.query));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async occupancy(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReportsService.occupancy(actor(req), parseFilters(req.query));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async missingFiles(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReportsService.missingFiles(actor(req), parseFilters(req.query));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async clientHoldings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReportsService.clientHoldings(actor(req), parseFilters(req.query));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async export(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const body = exportReportSchema.parse(req.body);
      const result = await ReportsService.export(actor(req), body.reportType, {
        from: body.from ? new Date(body.from) : undefined,
        to: body.to ? new Date(body.to) : undefined,
        warehouseId: body.warehouseId,
        clientId: body.clientId
      });
      res.status(202).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async exportStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReportsService.exportStatus(actor(req), req.params.jobId as string);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async downloadExport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const csvData = await ReportsService.downloadExport(actor(req), req.params.jobId as string);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="report-${req.params.jobId as string}.csv"`
      );
      res.status(200).send(csvData);
    } catch (error) {
      next(error);
    }
  }
}
