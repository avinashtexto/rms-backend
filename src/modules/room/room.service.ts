import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class RoomService {
  static async listRooms(warehouseId?: string) {
    return prisma.room.findMany({
      where: warehouseId ? { warehouseId } : undefined,
      include: {
        warehouse: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getRoom(id: string) {
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        warehouse: true
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

  static async createRoom(warehouseId: string, name: string, code: string) {
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
      data: { warehouseId, name, code },
      include: {
        warehouse: true
      }
    });
  }

  static async updateRoom(id: string, name?: string, isActive?: boolean) {
    const room = await prisma.room.findUnique({
      where: { id }
    });

    if (!room) {
      const error: AppError = new Error('Room not found');
      error.statusCode = 404;
      error.code = ErrorCode.ROOM_NOT_FOUND;
      throw error;
    }

    return prisma.room.update({
      where: { id },
      data: {
        name: name !== undefined ? name : room.name,
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
