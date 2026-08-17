import { Response, NextFunction } from 'express';
import { FileRecordService } from './fileRecord.service';
import { createFileRecordSchema, updateFileRecordSchema } from './fileRecord.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class FileRecordController {
  static async listFileRecords(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const boxId = req.query.boxId as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const result = await FileRecordService.listFileRecords(req.user!.companyId, boxId, page, pageSize);
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getFileRecord(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const fileRecordId = req.params.fileRecordId as string;
      const fileRecord = await FileRecordService.getFileRecord(fileRecordId, req.user!.companyId);
      res.status(200).json({
        success: true,
        data: fileRecord
      });
    } catch (error) {
      next(error);
    }
  }

  static async createFileRecord(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = createFileRecordSchema.parse(req.body);
      const fileRecord = await FileRecordService.createFileRecord(req.user!.companyId, data.boxId, data.barcode, data.title, data.status);
      res.status(201).json({
        success: true,
        data: fileRecord
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateFileRecord(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const fileRecordId = req.params.fileRecordId as string;
      const data = updateFileRecordSchema.parse(req.body);
      const fileRecord = await FileRecordService.updateFileRecord(fileRecordId, req.user!.companyId, data.title, data.status, data.boxId);
      res.status(200).json({
        success: true,
        data: fileRecord
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteFileRecord(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const fileRecordId = req.params.fileRecordId as string;
      await FileRecordService.deleteFileRecord(fileRecordId, req.user!.companyId);
      res.status(200).json({
        success: true,
        message: 'File record deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async bulkGenerate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { boxId, prefix, startingNumber, quantity, padding, titlePrefix } = req.body ?? {};
      if (!boxId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'boxId is required' }
        });
      }

      const result = await FileRecordService.bulkGenerateFileRecords(
        req.user!.companyId,
        String(boxId),
        prefix ? String(prefix) : 'FILE',
        Number(startingNumber) || 1,
        Number(quantity) || 20,
        Number(padding) || 4,
        titlePrefix ? String(titlePrefix) : undefined
      );

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async bulkAction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { ids, action } = req.body ?? {};
      if (!Array.isArray(ids) || !action) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'ids array and action are required' }
        });
      }

      const result = await FileRecordService.bulkActionFileRecords(req.user!.companyId, ids, action);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async bulkImport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { boxId, rows } = req.body ?? {};
      if (!boxId || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'boxId and non-empty rows array are required' }
        });
      }

      const result = await FileRecordService.bulkImportFileRecords(req.user!.companyId, String(boxId), rows);
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}
