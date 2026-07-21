import { Response, NextFunction } from 'express';
import { SiteService } from './site.service';
import { listSitesQuerySchema, createSiteSchema, updateSiteSchema } from './site.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class SiteController {
  /** Public — no auth. Returns active sites for use in the mobile login screen site picker. */
  static async listPublicSites(req: any, res: Response, next: NextFunction) {
    try {
      const sites = await SiteService.listAllActiveSites();
      res.status(200).json({ success: true, data: sites });
    } catch (error) {
      next(error);
    }
  }

  static async listSites(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const query = listSitesQuerySchema.parse(req.query);
      const result = await SiteService.listSites(companyId, query.page, query.pageSize);
      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSiteById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const siteId = req.params.id as string;
      const site = await SiteService.getSiteById(companyId, siteId);
      res.status(200).json({
        success: true,
        data: site
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
        data.city,
        data.state,
        data.country,
        data.phone,
        data.isActive
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
      const siteId = req.params.id as string;
      const data = updateSiteSchema.parse(req.body);
      const site = await SiteService.updateSite(
        companyId,
        siteId,
        data.branchId,
        data.name,
        data.code,
        data.address,
        data.city,
        data.state,
        data.country,
        data.phone,
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
      const siteId = req.params.id as string;
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
