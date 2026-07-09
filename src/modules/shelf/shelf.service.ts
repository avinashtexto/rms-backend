import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class ShelfService {
  static async listShelves(rackId?: string) {
    return prisma.shelf.findMany({
      where: rackId ? { rackId } : undefined,
      include: {
        rack: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getShelf(id: string) {
    const shelf = await prisma.shelf.findUnique({
      where: { id },
      include: {
        rack: true
      }
    });

    if (!shelf) {
      const error: AppError = new Error('Shelf not found');
      error.statusCode = 404;
      error.code = ErrorCode.SHELF_NOT_FOUND;
      throw error;
    }

    return shelf;
  }

  static async createShelf(rackId: string, name: string, code: string) {
    const rack = await prisma.rack.findUnique({
      where: { id: rackId }
    });

    if (!rack) {
      const error: AppError = new Error('Rack not found');
      error.statusCode = 404;
      error.code = ErrorCode.RACK_NOT_FOUND;
      throw error;
    }

    const existing = await prisma.shelf.findFirst({
      where: { rackId, code }
    });

    if (existing) {
      const error: AppError = new Error(`Shelf code '${code}' is already taken for this rack`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.shelf.create({
      data: { rackId, name, code },
      include: {
        rack: true
      }
    });
  }

  static async updateShelf(id: string, name?: string, isActive?: boolean) {
    const shelf = await prisma.shelf.findUnique({
      where: { id }
    });

    if (!shelf) {
      const error: AppError = new Error('Shelf not found');
      error.statusCode = 404;
      error.code = ErrorCode.SHELF_NOT_FOUND;
      throw error;
    }

    return prisma.shelf.update({
      where: { id },
      data: {
        name: name !== undefined ? name : shelf.name,
        isActive: isActive !== undefined ? isActive : shelf.isActive
      },
      include: {
        rack: true
      }
    });
  }

  static async deleteShelf(id: string) {
    const shelf = await prisma.shelf.findUnique({
      where: { id }
    });

    if (!shelf) {
      const error: AppError = new Error('Shelf not found');
      error.statusCode = 404;
      error.code = ErrorCode.SHELF_NOT_FOUND;
      throw error;
    }

    return prisma.shelf.delete({
      where: { id }
    });
  }
}
