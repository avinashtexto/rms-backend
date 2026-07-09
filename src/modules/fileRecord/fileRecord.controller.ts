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
      const result = await FileRecordService.listFileRecords(boxId, page, pageSize);
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
      const fileRecord = await FileRecordService.getFileRecord(fileRecordId);
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
      const fileRecord = await FileRecordService.createFileRecord(data.boxId, data.barcode, data.title, data.status);
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
      const fileRecord = await FileRecordService.updateFileRecord(fileRecordId, data.title, data.status, data.boxId);
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
      await FileRecordService.deleteFileRecord(fileRecordId);
      res.status(200).json({
        success: true,
        message: 'File record deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
