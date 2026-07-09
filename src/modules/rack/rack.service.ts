import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class RackService {
  static async listRacks(roomId?: string) {
    return prisma.rack.findMany({
      where: roomId ? { roomId } : undefined,
      include: {
        room: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getRack(id: string) {
    const rack = await prisma.rack.findUnique({
      where: { id },
      include: {
        room: true
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

  static async createRack(roomId: string, name: string, code: string) {
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
      data: { roomId, name, code },
      include: {
        room: true
      }
    });
  }

  static async updateRack(id: string, name?: string, isActive?: boolean) {
    const rack = await prisma.rack.findUnique({
      where: { id }
    });

    if (!rack) {
      const error: AppError = new Error('Rack not found');
      error.statusCode = 404;
      error.code = ErrorCode.RACK_NOT_FOUND;
      throw error;
    }

    return prisma.rack.update({
      where: { id },
      data: {
        name: name !== undefined ? name : rack.name,
        isActive: isActive !== undefined ? isActive : rack.isActive
      },
      include: {
        room: true
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
