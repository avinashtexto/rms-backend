import { Response, NextFunction } from 'express';
import { SiteService } from './site.service';
import { createSiteSchema, updateSiteSchema } from './site.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class SiteController {
  static async listSites(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const sites = await SiteService.listSites(companyId);
      res.status(200).json({
        success: true,
        data: sites
      });
    } catch (error) {
      next(error);
    }
  }

  static async createSite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const data = createSiteSchema.parse(req.body);
      const site = await SiteService.createSite(
        companyId,
        data.branchId,
        data.name,
        data.code,
        data.address,
        data.latitude,
        data.longitude
      );
      res.status(201).json({
        success: true,
        data: site
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const siteId = req.params.siteId as string;
      const data = updateSiteSchema.parse(req.body);
      const site = await SiteService.updateSite(
        companyId,
        siteId,
        data.name,
        data.address,
        data.latitude,
        data.longitude,
        data.isActive
      );
      res.status(200).json({
        success: true,
        data: site
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteSite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const siteId = req.params.siteId as string;
      await SiteService.deleteSite(companyId, siteId);
      res.status(200).json({
        success: true,
        message: 'Site deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
