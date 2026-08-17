import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

type RackListFilters = {
  roomId?: string;
  warehouseId?: string;
};

export class RackService {
  static async listRacks(filters?: RackListFilters) {
    return prisma.rack.findMany({
      where: {
        ...(filters?.roomId && { roomId: filters.roomId }),
        ...(filters?.warehouseId && { room: { warehouseId: filters.warehouseId } })
      },
      include: {
        room: {
          include: {
            warehouse: true
          }
        },
        _count: {
          select: {
            shelves: true,
            levels: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getRack(id: string) {
    const rack = await prisma.rack.findUnique({
      where: { id },
      include: {
        room: {
          include: {
            warehouse: true
          }
        }
      }
    });

    if (!rack) {
      const error: AppError = new Error('Rack not found');
      error.statusCode = 404;
      error.code = ErrorCode.RACK_NOT_FOUND;
      throw error;
    }

    return rack;
  }

  static async createRack(
    roomId: string,
    name: string,
    code: string,
    description?: string,
    floor?: string
  ) {
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    });

    if (!room) {
      const error: AppError = new Error('Room not found');
      error.statusCode = 404;
      error.code = ErrorCode.ROOM_NOT_FOUND;
      throw error;
    }

    const existing = await prisma.rack.findFirst({
      where: { roomId, code }
    });

    if (existing) {
      const error: AppError = new Error(`Rack code '${code}' is already taken for this room`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.rack.create({
      data: { roomId, name, code, description, floor },
      include: {
        room: {
          include: {
            warehouse: true
          }
        }
      }
    });
  }

  static async updateRack(
    id: string,
    name?: string,
    isActive?: boolean,
    description?: string,
    floor?: string,
    roomId?: string,
    code?: string
  ) {
    const rack = await prisma.rack.findUnique({
      where: { id }
    });

    if (!rack) {
      const error: AppError = new Error('Rack not found');
      error.statusCode = 404;
      error.code = ErrorCode.RACK_NOT_FOUND;
      throw error;
    }

    const newRoomId = roomId !== undefined ? roomId : rack.roomId;
    const newCode = code !== undefined ? code.toUpperCase() : rack.code;

    if (newRoomId !== rack.roomId || newCode !== rack.code) {
      const room = await prisma.room.findUnique({
        where: { id: newRoomId }
      });
      if (!room) {
        const error: AppError = new Error('Room not found');
        error.statusCode = 404;
        error.code = ErrorCode.ROOM_NOT_FOUND;
        throw error;
      }

      const existing = await prisma.rack.findFirst({
        where: {
          roomId: newRoomId,
          code: newCode,
          id: { not: id }
        }
      });
      if (existing) {
        const error: AppError = new Error(`Rack code '${newCode}' is already taken for this room`);
        error.statusCode = 400;
        error.code = ErrorCode.DUPLICATE_CODE;
        throw error;
      }
    }

    return prisma.rack.update({
      where: { id },
      data: {
        roomId: newRoomId,
        name: name !== undefined ? name : rack.name,
        code: newCode,
        description: description !== undefined ? description : rack.description,
        floor: floor !== undefined ? floor : rack.floor,
        isActive: isActive !== undefined ? isActive : rack.isActive
      },
      include: {
        room: {
          include: {
            warehouse: true
          }
        }
      }
    });
  }

  static async deleteRack(id: string) {
    const rack = await prisma.rack.findUnique({
      where: { id }
    });

    if (!rack) {
      const error: AppError = new Error('Rack not found');
      error.statusCode = 404;
      error.code = ErrorCode.RACK_NOT_FOUND;
      throw error;
    }

    return prisma.rack.delete({
      where: { id }
    });
  }
}
