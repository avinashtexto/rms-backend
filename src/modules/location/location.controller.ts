import { Response, NextFunction } from 'express';
import { LocationService } from './location.service';
import { createLocationSchema, updateLocationSchema } from './location.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class LocationController {
  static async listLocations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shelfId = req.query.shelfId as string | undefined;
      const locations = await LocationService.listLocations(shelfId);
      res.status(200).json({
        success: true,
        data: locations
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLocation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const locationId = req.params.locationId as string;
      const location = await LocationService.getLocation(locationId);
      res.status(200).json({
        success: true,
        data: location
      });
    } catch (error) {
      next(error);
    }
  }

  static async createLocation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = createLocationSchema.parse(req.body);
      const location = await LocationService.createLocation(data.shelfId, data.name, data.barcode);
      res.status(201).json({
        success: true,
        data: location
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateLocation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const locationId = req.params.locationId as string;
      const data = updateLocationSchema.parse(req.body);
      const location = await LocationService.updateLocation(locationId, data.name, data.isOccupied, data.isActive);
      res.status(200).json({
        success: true,
        data: location
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteLocation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const locationId = req.params.locationId as string;
      await LocationService.deleteLocation(locationId);
      res.status(200).json({
        success: true,
        message: 'Location deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
