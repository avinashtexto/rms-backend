import { Response, NextFunction } from 'express';
import { VendorService } from './vendor.service';
import { createVendorSchema, listVendorsQuerySchema, updateVendorSchema } from './vendor.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class VendorController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = listVendorsQuerySchema.parse(req.query);
      const result = await VendorService.list(req.user!, query);
      res.status(200).json({ success: true, data: result.data, meta: result.meta });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const vendor = await VendorService.getById(req.user!, req.params.id as string);
      res.status(200).json({ success: true, data: vendor });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = createVendorSchema.parse(req.body);
      const vendor = await VendorService.create(req.user!, data);
      res.status(201).json({ success: true, data: vendor });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = updateVendorSchema.parse(req.body);
      const vendor = await VendorService.update(req.user!, req.params.id as string, data);
      res.status(200).json({ success: true, data: vendor });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await VendorService.delete(req.user!, req.params.id as string);
      res.status(200).json({ success: true, message: 'Vendor deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}
