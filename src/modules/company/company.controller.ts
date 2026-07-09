import { Response, NextFunction } from 'express';
import { CompanyService } from './company.service';
import { listCompaniesQuerySchema, createCompanySchema, updateCompanySchema } from './company.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class CompanyController {
  static async listCompanies(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = listCompaniesQuerySchema.parse(req.query);
      const result = await CompanyService.listCompanies(query.page, query.pageSize);
      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCompany(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const companyParamId = req.params.companyId as string;
      const company = await CompanyService.getCompany(companyId, companyParamId);
      res.status(200).json({
        success: true,
        data: company
      });
    } catch (error) {
      next(error);
    }
  }

  static async createCompany(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = createCompanySchema.parse(req.body);
      const company = await CompanyService.createCompany(data.name, data.code);
      res.status(201).json({
        success: true,
        data: company
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateCompany(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const companyParamId = req.params.companyId as string;
      const data = updateCompanySchema.parse(req.body);
      const company = await CompanyService.updateCompany(companyId, companyParamId, data.name, data.isActive);
      res.status(200).json({
        success: true,
        data: company
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteCompany(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const companyParamId = req.params.companyId as string;
      await CompanyService.deleteCompany(companyId, companyParamId);
      res.status(200).json({
        success: true,
        message: 'Company deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
