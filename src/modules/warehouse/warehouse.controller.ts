import { Response, NextFunction } from 'express';
import { WarehouseService } from './warehouse.service';
import { createWarehouseSchema, updateWarehouseSchema } from './warehouse.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class WarehouseController {
  static async listWarehouses(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const warehouses = await WarehouseService.listWarehouses(companyId);
      res.status(200).json({
        success: true,
        data: warehouses
      });
    } catch (error) {
      next(error);
    }
  }

  static async createWarehouse(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const data = createWarehouseSchema.parse(req.body);
      const warehouse = await WarehouseService.createWarehouse(
        companyId,
        data.siteId,
        data.name,
        data.code,
        data.latitude,
        data.longitude
      );
      res.status(201).json({
        success: true,
        data: warehouse
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateWarehouse(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const warehouseId = req.params.warehouseId as string;
      const data = updateWarehouseSchema.parse(req.body);
      const warehouse = await WarehouseService.updateWarehouse(
        companyId,
        warehouseId,
        data.name,
        data.latitude,
        data.longitude,
        data.isActive
      );
      res.status(200).json({
        success: true,
        data: warehouse
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteWarehouse(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const warehouseId = req.params.warehouseId as string;
      await WarehouseService.deleteWarehouse(companyId, warehouseId);
      res.status(200).json({
        success: true,
        message: 'Warehouse deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
