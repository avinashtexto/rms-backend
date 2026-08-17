import { Response, NextFunction } from 'express';
import { LocationService } from './location.service';
import { createLocationSchema, updateLocationSchema } from './location.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class LocationController {
  static async listLocations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';
      const shelfId = req.query.shelfId as string | undefined;
      const warehouseId = (isWarehouseManager ? req.user?.warehouseId : (req.query.warehouseId as string | undefined)) ?? undefined;
      const locations = await LocationService.listLocations(shelfId, warehouseId);
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

  static async bulkGenerate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { shelfId, levelId, prefix, startingNumber, quantity, padding, barcodePrefix } = req.body ?? {};
      if (!shelfId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'shelfId is required' }
        });
      }

      const result = await LocationService.bulkGenerateLocations(
        String(shelfId),
        levelId ? String(levelId) : undefined,
        prefix ? String(prefix) : 'LOC',
        Number(startingNumber) || 1,
        Number(quantity) || 20,
        Number(padding) || 3,
        barcodePrefix ? String(barcodePrefix) : undefined
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

      const result = await LocationService.bulkActionLocations(ids, action);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async bulkImport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { shelfId, rows } = req.body ?? {};
      if (!shelfId || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'shelfId and non-empty rows array are required' }
        });
      }

      const result = await LocationService.bulkImportLocations(String(shelfId), rows);
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}
