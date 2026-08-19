import { Response, NextFunction } from 'express';
import { ScanService } from './scan.service';
import { lookupBarcodeSchema, submitScanSchema } from './scan.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class ScanController {
  static async lookupBarcode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = lookupBarcodeSchema.parse(req.query);
      const userId = req.user!.id;
      const deviceId = (req.headers['x-device-id'] as string) || (req as any).deviceId || null;
      const result = await ScanService.lookupBarcode(req.user!.companyId, data.barcode, userId, deviceId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async submitScan(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = submitScanSchema.parse(req.body);
      const deviceId = (req.headers['x-device-id'] as string) || (req as any).deviceId || null;
      const result = await ScanService.submitScan(
        req.user!.companyId,
        req.user!.id,
        data,
        deviceId
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
