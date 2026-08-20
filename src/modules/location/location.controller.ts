import { Response, NextFunction } from 'express';
import { LocationService } from './location.service';
import { createLocationSchema, updateLocationSchema } from './location.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class LocationController {
  static async listLocations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';
      const shelfId = req.query.shelfId as string | undefined;
      const warehouseId = (req.params.warehouseId as string | undefined) ||
        (isWarehouseManager ? req.user?.warehouseId : (req.query.warehouseId as string | undefined)) ||
        undefined;
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 1000;

      const result = await LocationService.listLocations(shelfId, warehouseId, search, status, page, limit);
      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta
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
      const warehouseId = (req.params.warehouseId as string | undefined) || req.body.warehouseId;
      const shelfId = req.body.shelfId;
      const name = req.body.name || req.body.barcode || req.body.fullLocation2;
      const barcode = req.body.barcode || req.body.fullLocation2;

      if (!barcode) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Location barcode or NFull Location2 is required' }
        });
      }

      const location = await LocationService.createLocation(
        shelfId,
        name,
        barcode,
        warehouseId,
        req.body.fullLocation || req.body['Full Location'],
        req.body.row || req.body['NRow'],
        req.body.rack || req.body['NRack2'],
        req.body.level || req.body['Nlevel'],
        req.body.location || req.body['NLocation'],
        req.body.fullLocation2 || req.body['NFull Location2']
      );

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
      const location = await LocationService.updateLocation(
        locationId,
        req.body.name,
        req.body.isOccupied,
        req.body.isActive,
        req.body.status
      );
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

  static async importWarehouseLocations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouseId = (req.params.warehouseId as string | undefined) || req.body.warehouseId;
      const rows = req.body.rows || req.body;

      if (!warehouseId || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'warehouseId and non-empty rows array are required' }
        });
      }

      const result = await LocationService.importWarehouseLocations(String(warehouseId), rows);
      res.status(200).json({
        success: true,
        data: result
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
