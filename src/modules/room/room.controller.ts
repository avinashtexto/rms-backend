import { Response, NextFunction } from 'express';
import { RoomService } from './room.service';
import { createRoomSchema, updateRoomSchema, createRowSchema } from './room.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class RoomController {
  static async listRooms(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
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
      const data = createRoomSchema.parse(req.body);
      const room = await RoomService.createRoom(data.warehouseId, data.name, data.code, data.description);
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
      const data = updateRoomSchema.parse(req.body);
      const room = await RoomService.updateRoom(
        roomId,
        data.name,
        data.isActive,
        data.description,
        data.warehouseId,
        data.code
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
      const rows = await RoomService.listRows(roomId);
      res.status(200).json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  }

  static async createRow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const roomId = req.params.roomId as string;
      const data = createRowSchema.parse(req.body);
      const row = await RoomService.createRow(roomId, data.name, data.code);
      res.status(201).json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  }

  static async deleteRow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rowId = req.params.rowId as string;
      await RoomService.deleteRow(rowId);
      res.status(200).json({ success: true, message: 'Row deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
