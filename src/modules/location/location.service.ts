import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class LocationService {
  static async listLocations(shelfId?: string, warehouseId?: string) {
    return prisma.location.findMany({
      where: {
        ...(shelfId && { shelfId }),
        ...(warehouseId && {
          shelf: {
            rack: {
              room: {
                warehouseId
              }
            }
          }
        })
      },
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

  static async bulkGenerateLocations(
    shelfId: string,
    levelId: string | undefined,
    prefix: string = 'LOC',
    startingNumber: number = 1,
    quantity: number = 20,
    padding: number = 3,
    customBarcodePrefix?: string
  ) {
    const shelf = await prisma.shelf.findUnique({
      where: { id: shelfId },
      include: {
        rack: {
          include: {
            room: {
              include: {
                warehouse: true
              }
            }
          }
        }
      }
    });

    if (!shelf) {
      const error: AppError = new Error('Shelf not found');
      error.statusCode = 404;
      error.code = ErrorCode.SHELF_NOT_FOUND;
      throw error;
    }

    const safeQty = Math.min(Math.max(1, quantity), 500);
    const safeStart = Math.max(1, startingNumber);
    const safePadding = Math.min(Math.max(1, padding), 6);
    const cleanPrefix = (prefix || 'LOC').trim().toUpperCase();

    const roomCode = shelf.rack?.room?.code || 'RM';
    const rackCode = shelf.rack?.code || 'RK';
    const shelfCode = shelf.code || 'S1';

    const results: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < safeQty; i++) {
        const num = safeStart + i;
        const numStr = String(num).padStart(safePadding, '0');
        const locName = `${cleanPrefix}-${numStr}`;
        const locBarcode = customBarcodePrefix
          ? `${customBarcodePrefix}-${numStr}`
          : `${roomCode}-${rackCode}-${shelfCode}-${locName}`;

        const created = await tx.location.upsert({
          where: { barcode: locBarcode },
          create: {
            shelfId,
            levelId: levelId || null,
            name: locName,
            barcode: locBarcode,
            isActive: true
          },
          update: {
            shelfId,
            levelId: levelId || null,
            name: locName
          }
        });
        results.push(created);
      }
    });

    return {
      message: `Successfully generated ${results.length} locations on shelf ${shelf.name}`,
      count: results.length,
      locations: results
    };
  }

  static async bulkActionLocations(ids: string[], action: 'ACTIVATE' | 'DEACTIVATE' | 'DELETE') {
    if (!Array.isArray(ids) || ids.length === 0) {
      const error: AppError = new Error('No location IDs provided');
      error.statusCode = 400;
      error.code = ErrorCode.VALIDATION_ERROR;
      throw error;
    }

    if (action === 'ACTIVATE') {
      const res = await prisma.location.updateMany({
        where: { id: { in: ids } },
        data: { isActive: true }
      });
      return { success: true, count: res.count, message: `${res.count} locations activated` };
    }

    if (action === 'DEACTIVATE') {
      const res = await prisma.location.updateMany({
        where: { id: { in: ids } },
        data: { isActive: false }
      });
      return { success: true, count: res.count, message: `${res.count} locations deactivated` };
    }

    if (action === 'DELETE') {
      // Find occupied locations
      const occupied = await prisma.location.findMany({
        where: { id: { in: ids }, isOccupied: true },
        select: { id: true, name: true, barcode: true }
      });

      if (occupied.length > 0) {
        const error: AppError = new Error(`Cannot delete ${occupied.length} locations that currently hold boxes`);
        error.statusCode = 400;
        error.code = ErrorCode.VALIDATION_ERROR;
        throw error;
      }

      const res = await prisma.location.deleteMany({
        where: { id: { in: ids }, isOccupied: false }
      });
      return { success: true, count: res.count, message: `${res.count} locations deleted` };
    }

    throw new Error('Invalid bulk action');
  }

  static async bulkImportLocations(
    shelfId: string,
    rows: { name: string; barcode?: string; levelId?: string }[]
  ) {
    const shelf = await prisma.shelf.findUnique({
      where: { id: shelfId },
      include: {
        rack: {
          include: {
            room: true
          }
        }
      }
    });

    if (!shelf) {
      const error: AppError = new Error('Shelf not found');
      error.statusCode = 404;
      error.code = ErrorCode.SHELF_NOT_FOUND;
      throw error;
    }

    const roomCode = shelf.rack?.room?.code || 'RM';
    const rackCode = shelf.rack?.code || 'RK';
    const shelfCode = shelf.code || 'S1';

    const results: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const name = row.name.trim();
        const barcode = (row.barcode || `${roomCode}-${rackCode}-${shelfCode}-${name}`).trim();

        const loc = await tx.location.upsert({
          where: { barcode },
          create: {
            shelfId,
            levelId: row.levelId || null,
            name,
            barcode,
            isActive: true
          },
          update: {
            shelfId,
            levelId: row.levelId || null,
            name
          }
        });
        results.push(loc);
      }
    });

    return {
      message: `Successfully imported ${results.length} locations`,
      count: results.length,
      locations: results
    };
  }
}
