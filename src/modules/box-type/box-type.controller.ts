import { Request, Response, NextFunction } from 'express';
import { BoxTypeService } from './box-type.service';

export class BoxTypeController {
  static async list(req: any, res: Response, next: NextFunction) {
    try {
      const data = await BoxTypeService.list(req.user.companyId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async create(req: any, res: Response, next: NextFunction) {
    try {
      const data = await BoxTypeService.create(req.user.companyId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await BoxTypeService.update(req.params.id as string, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await BoxTypeService.delete(req.params.id as string);
      res.json({ success: true, message: 'Box type deleted' });
    } catch (err) { next(err); }
  }
}
