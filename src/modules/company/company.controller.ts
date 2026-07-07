import { Response, NextFunction } from 'express';
import { CompanyService } from './company.service';
import { createCompanySchema, updateCompanySchema } from './company.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class CompanyController {
  static async listCompanies(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companies = await CompanyService.listCompanies();
      res.status(200).json({
        success: true,
        data: companies
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
      const companyId = req.params.companyId as string;
      const data = updateCompanySchema.parse(req.body);
      const company = await CompanyService.updateCompany(companyId, data.name, data.isActive);
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
      const companyId = req.params.companyId as string;
      await CompanyService.deleteCompany(companyId);
      res.status(200).json({
        success: true,
        message: 'Company deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
