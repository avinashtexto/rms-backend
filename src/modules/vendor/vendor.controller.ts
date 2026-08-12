import { Request, Response, NextFunction } from 'express';
import { VendorService } from './vendor.service';

export class VendorController {
  static async list(req: any, res: Response, next: NextFunction) {
    try {
      const data = await VendorService.list(req.user.companyId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async create(req: any, res: Response, next: NextFunction) {
    try {
      const data = await VendorService.create(req.user.companyId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await VendorService.update(req.params.id as string, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await VendorService.delete(req.params.id as string);
      res.json({ success: true, message: 'Vendor deleted' });
    } catch (err) { next(err); }
  }
}
