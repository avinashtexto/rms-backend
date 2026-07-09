import { Response, NextFunction } from 'express';
import { RackService } from './rack.service';
import { createRackSchema, updateRackSchema } from './rack.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class RackController {
  static async listRacks(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const roomId = req.query.roomId as string | undefined;
      const racks = await RackService.listRacks(roomId);
      res.status(200).json({
        success: true,
        data: racks
      });
    } catch (error) {
      next(error);
    }
  }

  static async getRack(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rackId = req.params.rackId as string;
      const rack = await RackService.getRack(rackId);
      res.status(200).json({
        success: true,
        data: rack
      });
    } catch (error) {
      next(error);
    }
  }

  static async createRack(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = createRackSchema.parse(req.body);
      const rack = await RackService.createRack(data.roomId, data.name, data.code);
      res.status(201).json({
        success: true,
        data: rack
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateRack(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rackId = req.params.rackId as string;
      const data = updateRackSchema.parse(req.body);
      const rack = await RackService.updateRack(rackId, data.name, data.isActive);
      res.status(200).json({
        success: true,
        data: rack
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteRack(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rackId = req.params.rackId as string;
      await RackService.deleteRack(rackId);
      res.status(200).json({
        success: true,
        message: 'Rack deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
