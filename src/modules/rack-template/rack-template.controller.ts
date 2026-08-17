import { Response, NextFunction } from 'express';
import { RackTemplateService } from './rack-template.service';
import {
  applyRackTemplateSchema,
  cloneRackTemplateSchema,
  createRackTemplateSchema,
  listRackTemplateQuerySchema,
  updateRackTemplateSchema
} from './rack-template.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class RackTemplateController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = listRackTemplateQuerySchema.parse(req.query);
      const data = await RackTemplateService.listTemplates(req.user!.companyId, query);
      res.json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await RackTemplateService.getTemplate(req.params.id as string, req.user!.companyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const body = createRackTemplateSchema.parse(req.body);
      const data = await RackTemplateService.createTemplate(req.user!.companyId, req.user!.id, body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const body = updateRackTemplateSchema.parse(req.body);
      const data = await RackTemplateService.updateTemplate(
        req.params.id as string,
        req.user!.companyId,
        req.user!.id,
        body
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await RackTemplateService.softDeleteTemplate(
        req.params.id as string,
        req.user!.companyId,
        req.user!.id
      );
      res.json({ success: true, message: 'Template deleted' });
    } catch (err) {
      next(err);
    }
  }

  static async activate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await RackTemplateService.setStatus(
        req.params.id as string,
        req.user!.companyId,
        req.user!.id,
        'ACTIVE'
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async deactivate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await RackTemplateService.setStatus(
        req.params.id as string,
        req.user!.companyId,
        req.user!.id,
        'INACTIVE'
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async clone(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const body = cloneRackTemplateSchema.parse(req.body);
      const data = await RackTemplateService.cloneTemplate(
        req.params.id as string,
        req.user!.companyId,
        req.user!.id,
        body
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async previewById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await RackTemplateService.previewTemplateById(
        req.params.id as string,
        req.user!.companyId,
        req.user!.id
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async previewDraft(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const body = createRackTemplateSchema.parse(req.body);
      const data = RackTemplateService.previewFromInput(body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async apply(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const body = applyRackTemplateSchema.parse(req.body);
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';

      if (isWarehouseManager && req.user?.warehouseId && body.warehouseId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only apply rack templates to your assigned warehouse.'
          }
        });
      }

      const data = await RackTemplateService.applyTemplate(
        req.params.id as string,
        req.user!.companyId,
        req.user!.id,
        body
      );
      res.json({ success: true, data });
    } catch (err: any) {
      next(err);
    }
  }

  static async applyLegacy(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { templateId, roomId } = req.body;
      const data = await RackTemplateService.applyTemplateLegacy(
        templateId,
        roomId,
        req.user!.id,
        req.user!.companyId
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}
