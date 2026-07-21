import { Response, NextFunction } from 'express';
import { BoxService } from './box.service';
import { createBoxSchema, updateBoxSchema, createFileRecordSchema, updateFileRecordSchema, listBoxQuerySchema } from './box.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class BoxController {
  // ==========================================
  // BOX CONTROLLERS
  // ==========================================
  
  static async listBoxes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const query = listBoxQuerySchema.parse(req.query);
      const result = await BoxService.listBoxes(
        companyId,
        {
          clientId: query.clientId,
          departmentId: query.departmentId,
          status: query.status,
          locationId: query.locationId
        },
        query.page,
        query.pageSize
      );
      res.status(200).json({
        success: true,
        data: result.boxes,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBoxById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const boxId = req.params.boxId as string;
      const box = await BoxService.getBoxById(companyId, boxId);
      res.status(200).json({ success: true, data: box });
    } catch (error) {
      next(error);
    }
  }

  static async createBox(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const data = createBoxSchema.parse(req.body);
      const box = await BoxService.createBox(
        companyId,
        data.clientId,
        data.departmentId,
        data.barcode,
        data.description,
        data.capacity
      );
      res.status(201).json({ success: true, data: box });
    } catch (error) {
      next(error);
    }
  }

  static async updateBox(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const boxId = req.params.boxId as string;
      const data = updateBoxSchema.parse(req.body);
      const box = await BoxService.updateBox(
        companyId,
        boxId,
        data.clientId,
        data.departmentId,
        data.description,
        data.status,
        data.capacity
      );
      res.status(200).json({ success: true, data: box });
    } catch (error) {
      next(error);
    }
  }

  static async deleteBox(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const boxId = req.params.boxId as string;
      await BoxService.deleteBox(companyId, boxId);
      res.status(200).json({
        success: true,
        message: 'Box deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async resolveBoxBarcode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const barcode = req.params.barcode as string;
      const box = await BoxService.resolveBoxBarcode(companyId, barcode);
      res.status(200).json({ success: true, data: box });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // FILE RECORD CONTROLLERS
  // ==========================================

  static async listFilesByBox(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const boxId = req.params.boxId as string;
      const files = await BoxService.listFilesByBox(companyId, boxId);
      res.status(200).json({ success: true, data: files });
    } catch (error) {
      next(error);
    }
  }

  static async createFileRecord(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const boxId = req.params.boxId as string;
      const data = createFileRecordSchema.parse(req.body);
      const file = await BoxService.createFileRecord(companyId, boxId, data.title, data.barcode);
      res.status(201).json({ success: true, data: file });
    } catch (error) {
      next(error);
    }
  }

  static async updateFileRecord(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const fileRecordId = req.params.fileRecordId as string;
      const data = updateFileRecordSchema.parse(req.body);
      const file = await BoxService.updateFileRecord(companyId, fileRecordId, data.title, data.status);
      res.status(200).json({ success: true, data: file });
    } catch (error) {
      next(error);
    }
  }

  static async resolveFileBarcode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const barcode = req.params.barcode as string;
      const file = await BoxService.resolveFileBarcode(companyId, barcode);
      res.status(200).json({ success: true, data: file });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SEARCH
  // ==========================================

  static async search(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const query = (req.query.q as string) || '';
      const result = await BoxService.search(companyId, query);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
