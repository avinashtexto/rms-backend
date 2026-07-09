import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class LocationService {
  static async listLocations(shelfId?: string) {
    return prisma.location.findMany({
      where: shelfId ? { shelfId } : undefined,
      include: {
        shelf: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getLocation(id: string) {
    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        shelf: true,
        currentBox: true
      }
    });

    if (!location) {
      const error: AppError = new Error('Location not found');
      error.statusCode = 404;
      error.code = ErrorCode.LOCATION_NOT_FOUND;
      throw error;
    }

    return location;
  }

  static async createLocation(shelfId: string, name: string, barcode: string) {
    const shelf = await prisma.shelf.findUnique({
      where: { id: shelfId }
    });

    if (!shelf) {
      const error: AppError = new Error('Shelf not found');
      error.statusCode = 404;
      error.code = ErrorCode.SHELF_NOT_FOUND;
      throw error;
    }

    const existing = await prisma.location.findFirst({
      where: { barcode }
    });

    if (existing) {
      const error: AppError = new Error(`Location barcode '${barcode}' is already taken`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.location.create({
      data: { shelfId, name, barcode },
      include: {
        shelf: true
      }
    });
  }

  static async updateLocation(id: string, name?: string, isOccupied?: boolean, isActive?: boolean) {
    const location = await prisma.location.findUnique({
      where: { id }
    });

    if (!location) {
      const error: AppError = new Error('Location not found');
      error.statusCode = 404;
      error.code = ErrorCode.LOCATION_NOT_FOUND;
      throw error;
    }

    return prisma.location.update({
      where: { id },
      data: {
        name: name !== undefined ? name : location.name,
        isOccupied: isOccupied !== undefined ? isOccupied : location.isOccupied,
        isActive: isActive !== undefined ? isActive : location.isActive
      },
      include: {
        shelf: true,
        currentBox: true
      }
    });
  }

  static async deleteLocation(id: string) {
    const location = await prisma.location.findUnique({
      where: { id }
    });

    if (!location) {
      const error: AppError = new Error('Location not found');
      error.statusCode = 404;
      error.code = ErrorCode.LOCATION_NOT_FOUND;
      throw error;
    }

    return prisma.location.delete({
      where: { id }
    });
  }
}
