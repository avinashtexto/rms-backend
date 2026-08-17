import { Response, NextFunction } from 'express';
import { WarehouseService } from './warehouse.service';
import { listWarehousesQuerySchema, createWarehouseSchema, updateWarehouseSchema } from './warehouse.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class WarehouseController {
  static async listWarehouses(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const query = listWarehousesQuerySchema.parse(req.query);
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';
      const scopedWarehouseId = isWarehouseManager ? req.user?.warehouseId : undefined;
      const result = await WarehouseService.listWarehouses(companyId, query.page, query.pageSize, scopedWarehouseId);
      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  static async getWarehouseById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const warehouseId = req.params.id as string;
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';

      if (isWarehouseManager && req.user?.warehouseId && req.user.warehouseId !== warehouseId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: "You don't have access to this warehouse."
          }
        });
      }

      const warehouse = await WarehouseService.getWarehouseById(companyId, warehouseId);
      res.status(200).json({
        success: true,
        data: warehouse
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
        data.address,
        data.city,
        data.state,
        data.country,
        data.zipCode,
        data.phone,
        data.isActive,
        data.admin
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
      const warehouseId = req.params.id as string;
      const data = updateWarehouseSchema.parse(req.body);
      const warehouse = await WarehouseService.updateWarehouse(
        companyId,
        warehouseId,
        data.siteId,
        data.name,
        data.code,
        data.address,
        data.city,
        data.state,
        data.country,
        data.zipCode,
        data.phone,
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
      const warehouseId = req.params.id as string;
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
