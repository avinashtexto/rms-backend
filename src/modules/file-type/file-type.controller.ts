import { Request, Response, NextFunction } from 'express';
import { FileTypeService } from './file-type.service';

export class FileTypeController {
  static async list(req: any, res: Response, next: NextFunction) {
    try {
      const data = await FileTypeService.list(req.user.companyId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async create(req: any, res: Response, next: NextFunction) {
    try {
      const data = await FileTypeService.create(req.user.companyId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await FileTypeService.update(req.params.id as string, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await FileTypeService.delete(req.params.id as string);
      res.json({ success: true, message: 'File type deleted' });
    } catch (err) { next(err); }
  }
}
