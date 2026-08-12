import { Request, Response, NextFunction } from 'express';
import { BarcodeMasterService } from './barcode-master.service';

export class BarcodeMasterController {
  static async getDashboardStats(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const stats = await BarcodeMasterService.getDashboardStats(companyId);
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const query = {
        ...req.query,
        companyId
      };
      const result = await BarcodeMasterService.list(query as any);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const barcodeObj = await BarcodeMasterService.getById(id);
      res.json({ success: true, data: barcodeObj });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.userId;
      const barcodeObj = await BarcodeMasterService.create({
        ...req.body,
        companyId
      }, userId);
      res.status(201).json({ success: true, data: barcodeObj, message: 'Barcode created successfully.' });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const userId = (req as any).user.userId;
      const updated = await BarcodeMasterService.update(id, req.body, userId);
      res.json({ success: true, data: updated, message: 'Barcode updated successfully.' });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const userId = (req as any).user.userId;
      const result = await BarcodeMasterService.delete(id, userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async bulkGenerate(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.userId;
      const result = await BarcodeMasterService.bulkGenerate({
        ...req.body,
        companyId
      }, userId);
      res.json({ success: true, data: result, message: 'Bulk sequence generated successfully.' });
    } catch (err) {
      next(err);
    }
  }

  static async importBarcodes(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.userId;
      const rows = req.body.rows || req.body;
      const result = await BarcodeMasterService.importBarcodes(rows, companyId, userId);
      res.json({ success: true, data: result, message: 'Barcode import processed.' });
    } catch (err) {
      next(err);
    }
  }

  static async exportBarcodes(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const query = { ...req.query, companyId, limit: 50000 };
      const result = await BarcodeMasterService.list(query as any);
      res.json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  }

  static async bulkAction(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const { ids, action } = req.body;
      const result = await BarcodeMasterService.bulkAction(ids, action, userId);
      res.json({ success: true, data: result, message: `Bulk action ${action} executed.` });
    } catch (err) {
      next(err);
    }
  }

  static async printBarcodes(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const { ids } = req.body;
      const result = await BarcodeMasterService.printBarcodes(ids, userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async validateBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.userId;
      const barcode = req.body.barcode || req.query.barcode;

      if (!barcode) {
        return res.status(400).json({ success: false, message: 'Barcode is required.' });
      }

      const result = await BarcodeMasterService.validateBarcode(String(barcode), companyId, userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async search(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const q = String(req.query.q || req.query.barcode || '').trim();
      const result = await BarcodeMasterService.list({ companyId, search: q, limit: 10 });
      res.json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  }
}
