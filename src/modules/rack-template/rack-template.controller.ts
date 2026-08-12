import { Request, Response, NextFunction } from 'express';
import { RackTemplateService } from './rack-template.service';

export class RackTemplateController {
  static async list(req: any, res: Response, next: NextFunction) {
    try {
      const companyId = req.user.companyId;
      const data = await RackTemplateService.listTemplates(companyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: any, res: Response, next: NextFunction) {
    try {
      const companyId = req.user.companyId;
      const data = await RackTemplateService.createTemplate(companyId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = await RackTemplateService.updateTemplate(id as string, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await RackTemplateService.deleteTemplate(id as string);
      res.json({ success: true, message: 'Template deleted' });
    } catch (err) {
      next(err);
    }
  }

  static async apply(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateId, roomId } = req.body;
      const data = await RackTemplateService.applyTemplate(templateId, roomId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}
