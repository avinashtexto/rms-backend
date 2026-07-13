import { Response, NextFunction } from 'express';
import { ReportService } from './report.service';
import { generateReportSchema, updateReportSchema } from './report.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class ReportController {
  static async generateReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const data = generateReportSchema.parse(req.body);
      const result = await ReportService.generateReport(companyId, data.type, data.name, data.description);
      res.status(202).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getJobStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const jobId = req.params.jobId as string;
      const status = await ReportService.getJobStatus(companyId, jobId);
      res.status(200).json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  static async downloadReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const jobId = req.params.jobId as string;
      const csvData = await ReportService.downloadReport(companyId, jobId);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="report-${jobId}.csv"`);
      res.status(200).send(csvData);
    } catch (error) {
      next(error);
    }
  }

  static async listReports(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const reports = await ReportService.listReports(companyId);
      res.status(200).json({ success: true, data: reports });
    } catch (error) {
      next(error);
    }
  }

  static async updateReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const jobId = req.params.jobId as string;
      const data = updateReportSchema.parse(req.body);
      const report = await ReportService.updateReport(companyId, jobId, data.name, data.description);
      res.status(200).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  static async deleteReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const jobId = req.params.jobId as string;
      await ReportService.deleteReport(companyId, jobId);
      res.status(200).json({ success: true, message: 'Report deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
