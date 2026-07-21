import { Response, NextFunction } from 'express';
import { ScanService } from './scan.service';
import { lookupBarcodeSchema, submitScanSchema } from './scan.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class ScanController {
  static async lookupBarcode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = lookupBarcodeSchema.parse(req.query);
      const result = await ScanService.lookupBarcode(req.user!.companyId, data.barcode);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async submitScan(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = submitScanSchema.parse(req.body);
      const result = await ScanService.submitScan(
        req.user!.companyId,
        req.user!.id,
        data
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
