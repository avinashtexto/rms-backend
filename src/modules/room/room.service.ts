import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class RoomService {
  static async listRooms(warehouseId?: string) {
    return prisma.room.findMany({
      where: warehouseId ? { warehouseId } : undefined,
      include: {
        warehouse: true,
        rows: { orderBy: { code: 'asc' } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getRoom(id: string) {
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        warehouse: true,
        rows: { orderBy: { code: 'asc' } }
      }
    });

    if (!room) {
      const error: AppError = new Error('Room not found');
      error.statusCode = 404;
      error.code = ErrorCode.ROOM_NOT_FOUND;
      throw error;
    }

    return room;
  }

  static async listRows(roomId: string) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      const error: AppError = new Error('Room not found');
      error.statusCode = 404;
      error.code = ErrorCode.ROOM_NOT_FOUND;
      throw error;
    }
    return prisma.row.findMany({
      where: { roomId },
      orderBy: { code: 'asc' }
    });
  }

  static async createRow(roomId: string, name: string, code: string) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      const error: AppError = new Error('Room not found');
      error.statusCode = 404;
      error.code = ErrorCode.ROOM_NOT_FOUND;
      throw error;
    }

    const existing = await prisma.row.findUnique({
      where: { roomId_code: { roomId, code: code.toUpperCase() } }
    });
    if (existing) {
      const error: AppError = new Error(`Row code '${code}' already exists in this room`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.row.create({
      data: { roomId, name, code: code.toUpperCase() }
    });
  }

  static async deleteRow(rowId: string) {
    const row = await prisma.row.findUnique({ where: { id: rowId } });
    if (!row) {
      const error: AppError = new Error('Row not found');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }
    return prisma.row.delete({ where: { id: rowId } });
  }

  static async createRoom(warehouseId: string, name: string, code: string, description?: string) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId }
    });

    if (!warehouse) {
      const error: AppError = new Error('Warehouse not found');
      error.statusCode = 404;
      error.code = ErrorCode.WAREHOUSE_NOT_FOUND;
      throw error;
    }

    const existing = await prisma.room.findFirst({
      where: { warehouseId, code }
    });

    if (existing) {
      const error: AppError = new Error(`Room code '${code}' is already taken for this warehouse`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.room.create({
      data: { warehouseId, name, code, description },
      include: {
        warehouse: true
      }
    });
  }

  static async updateRoom(
    id: string,
    name?: string,
    isActive?: boolean,
    description?: string,
    warehouseId?: string,
    code?: string
  ) {
    const room = await prisma.room.findUnique({
      where: { id }
    });

    if (!room) {
      const error: AppError = new Error('Room not found');
      error.statusCode = 404;
      error.code = ErrorCode.ROOM_NOT_FOUND;
      throw error;
    }

    const newWarehouseId = warehouseId !== undefined ? warehouseId : room.warehouseId;
    const newCode = code !== undefined ? code.toUpperCase() : room.code;

    if (newWarehouseId !== room.warehouseId || newCode !== room.code) {
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: newWarehouseId }
      });
      if (!warehouse) {
        const error: AppError = new Error('Warehouse not found');
        error.statusCode = 404;
        error.code = ErrorCode.WAREHOUSE_NOT_FOUND;
        throw error;
      }

      const existing = await prisma.room.findFirst({
        where: {
          warehouseId: newWarehouseId,
          code: newCode,
          id: { not: id }
        }
      });
      if (existing) {
        const error: AppError = new Error(`Room code '${newCode}' is already taken for this warehouse`);
        error.statusCode = 400;
        error.code = ErrorCode.DUPLICATE_CODE;
        throw error;
      }
    }

    return prisma.room.update({
      where: { id },
      data: {
        warehouseId: newWarehouseId,
        name: name !== undefined ? name : room.name,
        code: newCode,
        description: description !== undefined ? description : room.description,
        isActive: isActive !== undefined ? isActive : room.isActive
      },
      include: {
        warehouse: true
      }
    });
  }

  static async deleteRoom(id: string) {
    const room = await prisma.room.findUnique({
      where: { id }
    });

    if (!room) {
      const error: AppError = new Error('Room not found');
      error.statusCode = 404;
      error.code = ErrorCode.ROOM_NOT_FOUND;
      throw error;
    }

    return prisma.room.delete({
      where: { id }
    });
  }
}
