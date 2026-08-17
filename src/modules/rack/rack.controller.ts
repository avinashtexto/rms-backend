import { Response, NextFunction } from 'express';
import { RackService } from './rack.service';
import { createRackSchema, updateRackSchema } from './rack.validation';
import { AuthenticatedRequest } from '../auth/auth.types';
import { prisma } from '../../lib/prisma';

export class RackController {
  static async listRacks(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';
      const roomId = req.query.roomId as string | undefined;
      const warehouseId = (isWarehouseManager
        ? req.user?.warehouseId
        : (req.query.warehouseId as string | undefined)) ?? undefined;
      const racks = await RackService.listRacks({ roomId, warehouseId });
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
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';

      if (isWarehouseManager && req.user?.warehouseId && rack.room?.warehouseId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: "You don't have access to racks in this warehouse."
          }
        });
      }

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
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';
      const data = createRackSchema.parse(req.body);

      if (isWarehouseManager && req.user?.warehouseId) {
        const room = await prisma.room.findUnique({ where: { id: data.roomId } });
        if (!room || room.warehouseId !== req.user.warehouseId) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Target room does not belong to your assigned warehouse.'
            }
          });
        }
      }

      const rack = await RackService.createRack(
        data.roomId,
        data.name,
        data.code,
        data.description,
        data.floor
      );
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
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';
      const existingRack = await RackService.getRack(rackId);

      if (isWarehouseManager && req.user?.warehouseId && existingRack.room?.warehouseId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: "You don't have access to update this rack."
          }
        });
      }

      const data = updateRackSchema.parse(req.body);
      if (isWarehouseManager && data.roomId && req.user?.warehouseId) {
        const targetRoom = await prisma.room.findUnique({ where: { id: data.roomId } });
        if (!targetRoom || targetRoom.warehouseId !== req.user.warehouseId) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Target room does not belong to your assigned warehouse.'
            }
          });
        }
      }

      const rack = await RackService.updateRack(
        rackId,
        data.name,
        data.isActive,
        data.description,
        data.floor,
        data.roomId,
        data.code
      );
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
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';
      const existingRack = await RackService.getRack(rackId);

      if (isWarehouseManager && req.user?.warehouseId && existingRack.room?.warehouseId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: "You don't have access to delete this rack."
          }
        });
      }

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
