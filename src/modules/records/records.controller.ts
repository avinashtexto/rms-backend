import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../auth/auth.types';
import { BoxesRecordsService } from './boxes.service';
import { FilesRecordsService } from './files.service';
import {
  listBoxesQuerySchema,
  listFilesQuerySchema,
  updateBoxRecordSchema,
  updateFileRecordSchema
} from './records.validation';

function currentUser(req: AuthenticatedRequest) {
  return {
    id: req.user!.id,
    companyId: req.user!.companyId
  };
}

export class RecordsController {
  static async listBoxes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = listBoxesQuerySchema.parse(req.query);
      const result = await BoxesRecordsService.list(
        {
          page: query.page,
          limit: query.limit,
          search: query.search,
          sortBy: query.sortBy,
          order: query.order,
          status: query.status,
          clientId: query.clientId,
          locationId: query.locationId,
          warehouseId: query.warehouseId
        },
        currentUser(req)
      );
      res.status(200).json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  static async getBox(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const box = await BoxesRecordsService.get(id, currentUser(req));
      res.status(200).json({ success: true, data: box });
    } catch (error) {
      next(error);
    }
  }

  static async updateBox(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = updateBoxRecordSchema.parse(req.body);
      const box = await BoxesRecordsService.update(id, data, currentUser(req));
      res.status(200).json({ success: true, data: box });
    } catch (error) {
      next(error);
    }
  }

  static async getBoxTimeline(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const timeline = await BoxesRecordsService.timeline(id, currentUser(req));
      res.status(200).json({ success: true, data: timeline });
    } catch (error) {
      next(error);
    }
  }

  static async listFiles(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = listFilesQuerySchema.parse(req.query);
      const result = await FilesRecordsService.list(
        {
          page: query.page,
          limit: query.limit,
          search: query.search,
          sortBy: query.sortBy,
          order: query.order,
          status: query.status,
          boxId: query.boxId,
          clientId: query.clientId
        },
        currentUser(req)
      );
      res.status(200).json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  static async getFile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const file = await FilesRecordsService.get(id, currentUser(req));
      res.status(200).json({ success: true, data: file });
    } catch (error) {
      next(error);
    }
  }

  static async updateFile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = updateFileRecordSchema.parse(req.body);
      const file = await FilesRecordsService.update(id, data, currentUser(req));
      res.status(200).json({ success: true, data: file });
    } catch (error) {
      next(error);
    }
  }

  static async getFileTimeline(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const timeline = await FilesRecordsService.timeline(id, currentUser(req));
      res.status(200).json({ success: true, data: timeline });
    } catch (error) {
      next(error);
    }
  }
}
