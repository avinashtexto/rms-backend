import { Response, NextFunction } from 'express';
import { RoomService } from './room.service';
import { createRoomSchema, updateRoomSchema, createRowSchema, updateRowSchema } from './room.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class RoomController {
  static async listRooms(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';
      const warehouseId = isWarehouseManager
        ? req.user?.warehouseId
        : (req.query.warehouseId as string | undefined);
      const rooms = await RoomService.listRooms(warehouseId);
      res.status(200).json({
        success: true,
        data: rooms
      });
    } catch (error) {
      next(error);
    }
  }

  static async getRoom(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const roomId = req.params.id as string;
      const room = await RoomService.getRoom(roomId);
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';

      if (isWarehouseManager && req.user?.warehouseId && room.warehouseId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: "You don't have access to rooms in this warehouse."
          }
        });
      }

      res.status(200).json({
        success: true,
        data: room
      });
    } catch (error) {
      next(error);
    }
  }

  static async createRoom(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';
      const data = createRoomSchema.parse(req.body);

      if (isWarehouseManager && req.user?.warehouseId && data.warehouseId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only create rooms within your assigned warehouse.'
          }
        });
      }

      const room = await RoomService.createRoom(
        data.warehouseId,
        data.name,
        data.code,
        data.description,
        data.location
      );
      res.status(201).json({
        success: true,
        data: room
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateRoom(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const roomId = req.params.id as string;
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';
      const existingRoom = await RoomService.getRoom(roomId);

      if (isWarehouseManager && req.user?.warehouseId && existingRoom.warehouseId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: "You don't have access to update this room."
          }
        });
      }

      const data = updateRoomSchema.parse(req.body);
      if (isWarehouseManager && data.warehouseId && data.warehouseId !== req.user?.warehouseId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot move room to another warehouse.'
          }
        });
      }

      const room = await RoomService.updateRoom(
        roomId,
        data.name,
        data.isActive,
        data.description,
        data.warehouseId,
        data.code,
        data.location
      );
      res.status(200).json({
        success: true,
        data: room
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteRoom(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const roomId = req.params.id as string;
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';
      const existingRoom = await RoomService.getRoom(roomId);

      if (isWarehouseManager && req.user?.warehouseId && existingRoom.warehouseId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: "You don't have access to delete this room."
          }
        });
      }

      await RoomService.deleteRoom(roomId);
      res.status(200).json({
        success: true,
        message: 'Room deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async listRows(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const roomId = req.params.roomId as string;
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';
      const room = await RoomService.getRoom(roomId);

      if (isWarehouseManager && req.user?.warehouseId && room.warehouseId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: "You don't have access to rows in this warehouse."
          }
        });
      }

      const rows = await RoomService.listRows(roomId);
      res.status(200).json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  }

  static async createRow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const roomId = req.params.roomId as string;
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';
      const room = await RoomService.getRoom(roomId);

      if (isWarehouseManager && req.user?.warehouseId && room.warehouseId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: "You don't have access to add rows to this room."
          }
        });
      }

      const data = createRowSchema.parse(req.body);
      const row = await RoomService.createRow(roomId, data);
      res.status(201).json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  }

  static async updateRow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const roomId = req.params.roomId as string;
      const rowId = req.params.rowId as string;
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';
      const room = await RoomService.getRoom(roomId);

      if (isWarehouseManager && req.user?.warehouseId && room.warehouseId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: "You don't have access to update rows in this room."
          }
        });
      }

      const data = updateRowSchema.parse(req.body);
      const row = await RoomService.updateRow(roomId, rowId, data);
      res.status(200).json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  }

  static async deleteRow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const roomId = req.params.roomId as string;
      const rowId = req.params.rowId as string;
      const isWarehouseManager = req.user?.roleName === 'WAREHOUSE_MANAGER';
      const room = await RoomService.getRoom(roomId);

      if (isWarehouseManager && req.user?.warehouseId && room.warehouseId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: "You don't have access to delete rows in this room."
          }
        });
      }

      await RoomService.deleteRow(rowId);
      res.status(200).json({ success: true, message: 'Row deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
