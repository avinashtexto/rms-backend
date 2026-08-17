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
        levels: {
          orderBy: { code: 'asc' }
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
        },
        levels: {
          orderBy: { code: 'asc' }
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

  static async listLevels(rackId: string) {
    const rack = await prisma.rack.findUnique({
      where: { id: rackId },
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

    return prisma.level.findMany({
      where: { rackId },
      include: {
        rack: {
          select: {
            id: true,
            name: true,
            code: true,
            roomId: true,
            room: {
              select: {
                id: true,
                name: true,
                code: true,
                warehouseId: true
              }
            }
          }
        },
        _count: {
          select: {
            locations: true
          }
        }
      },
      orderBy: { code: 'asc' }
    });
  }

  static async createLevel(rackId: string, name: string, code: string) {
    const rack = await prisma.rack.findUnique({
      where: { id: rackId }
    });

    if (!rack) {
      const error: AppError = new Error('Rack not found');
      error.statusCode = 404;
      error.code = ErrorCode.RACK_NOT_FOUND;
      throw error;
    }

    const upperCode = code.trim().toUpperCase();
    const existing = await prisma.level.findFirst({
      where: { rackId, code: upperCode }
    });

    if (existing) {
      const error: AppError = new Error(`Level code '${upperCode}' already exists for this rack`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.level.create({
      data: {
        rackId,
        name: name.trim(),
        code: upperCode
      },
      include: {
        rack: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });
  }

  static async deleteLevel(rackId: string, levelId: string) {
    const level = await prisma.level.findFirst({
      where: { id: levelId, rackId },
      include: {
        locations: {
          where: { isOccupied: true }
        }
      }
    });

    if (!level) {
      const error: AppError = new Error('Level not found');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    if (level.locations.length > 0) {
      const error: AppError = new Error('Cannot delete level with occupied locations');
      error.statusCode = 400;
      error.code = ErrorCode.VALIDATION_ERROR;
      throw error;
    }

    await prisma.location.deleteMany({
      where: { levelId }
    });

    return prisma.level.delete({
      where: { id: levelId }
    });
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
