import { Response, NextFunction } from 'express';
import { ShelfService } from './shelf.service';
import { createShelfSchema, updateShelfSchema } from './shelf.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class ShelfController {
  static async listShelves(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rackId = req.query.rackId as string | undefined;
      const shelves = await ShelfService.listShelves(rackId);
      res.status(200).json({
        success: true,
        data: shelves
      });
    } catch (error) {
      next(error);
    }
  }

  static async getShelf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shelfId = req.params.shelfId as string;
      const shelf = await ShelfService.getShelf(shelfId);
      res.status(200).json({
        success: true,
        data: shelf
      });
    } catch (error) {
      next(error);
    }
  }

  static async createShelf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = createShelfSchema.parse(req.body);
      const shelf = await ShelfService.createShelf(data.rackId, data.name, data.code);
      res.status(201).json({
        success: true,
        data: shelf
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateShelf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shelfId = req.params.shelfId as string;
      const data = updateShelfSchema.parse(req.body);
      const shelf = await ShelfService.updateShelf(shelfId, data.name, data.isActive);
      res.status(200).json({
        success: true,
        data: shelf
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteShelf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shelfId = req.params.shelfId as string;
      await ShelfService.deleteShelf(shelfId);
      res.status(200).json({
        success: true,
        message: 'Shelf deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
