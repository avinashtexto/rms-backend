import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export interface LocationImportRowInput {
  'Full Location'?: string;
  'NRow'?: string;
  'NRack2'?: string;
  'Nlevel'?: string;
  'NLocation'?: string;
  'NFull Location2'?: string;
  fullLocation?: string;
  row?: string;
  rack?: string;
  level?: string;
  location?: string;
  fullLocation2?: string;
  barcode?: string;
  name?: string;
}

export class LocationService {
  static async getOrCreateSystemShelf(warehouseId: string): Promise<string> {
    const existingShelf = await prisma.shelf.findFirst({
      where: {
        rack: {
          room: {
            warehouseId
          }
        }
      }
    });

    if (existingShelf) {
      return existingShelf.id;
    }

    let room = await prisma.room.findFirst({ where: { warehouseId } });
    if (!room) {
      room = await prisma.room.create({
        data: {
          warehouseId,
          name: 'Main Storage Room',
          code: 'RM-MAIN'
        }
      });
    }

    let rack = await prisma.rack.findFirst({ where: { roomId: room.id } });
    if (!rack) {
      rack = await prisma.rack.create({
        data: {
          roomId: room.id,
          name: 'Main Storage Rack',
          code: 'RK-MAIN'
        }
      });
    }

    let shelf = await prisma.shelf.findFirst({ where: { rackId: rack.id } });
    if (!shelf) {
      shelf = await prisma.shelf.create({
        data: {
          rackId: rack.id,
          name: 'Main Storage Shelf',
          code: 'S-MAIN'
        }
      });
    }

    return shelf.id;
  }

  static async listLocations(
    shelfId?: string,
    warehouseId?: string,
    search?: string,
    status?: string,
    page: number = 1,
    limit: number = 1000
  ) {
    const andConditions: any[] = [];

    if (shelfId) {
      andConditions.push({ shelfId });
    }

    if (warehouseId) {
      andConditions.push({
        OR: [
          { warehouseId },
          { shelf: { rack: { room: { warehouseId } } } }
        ]
      });
    }

    if (status && status !== 'ALL') {
      andConditions.push({ status });
    }

    if (search && search.trim().length > 0) {
      const term = search.trim();
      andConditions.push({
        OR: [
          { barcode: { contains: term, mode: 'insensitive' } },
          { name: { contains: term, mode: 'insensitive' } },
          { fullLocation: { contains: term, mode: 'insensitive' } },
          { fullLocation2: { contains: term, mode: 'insensitive' } },
          { row: { contains: term, mode: 'insensitive' } },
          { rack: { contains: term, mode: 'insensitive' } },
          { level: { contains: term, mode: 'insensitive' } },
          { location: { contains: term, mode: 'insensitive' } }
        ]
      });
    }

    const where: any = andConditions.length > 0 ? { AND: andConditions } : {};

    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      prisma.location.count({ where }),
      prisma.location.findMany({
        where,
        include: {
          shelf: {
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
          },
          warehouse: true,
          currentBox: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getLocation(id: string) {
    const location = await prisma.location.findFirst({
      where: {
        OR: [{ id }, { barcode: id }]
      },
      include: {
        shelf: {
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
        },
        warehouse: true,
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

  static async createLocation(
    shelfId: string | undefined,
    name: string,
    barcode: string,
    warehouseId?: string,
    fullLocation?: string,
    row?: string,
    rack?: string,
    level?: string,
    location?: string,
    fullLocation2?: string
  ) {
    const cleanBarcode = barcode.trim();

    const existing = await prisma.location.findFirst({
      where: { barcode: cleanBarcode }
    });

    if (existing) {
      const error: AppError = new Error(`Location barcode '${cleanBarcode}' is already taken`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    let resolvedShelfId = shelfId;
    if (!resolvedShelfId && warehouseId) {
      resolvedShelfId = await LocationService.getOrCreateSystemShelf(warehouseId);
    }

    if (!resolvedShelfId) {
      const firstWarehouse = await prisma.warehouse.findFirst();
      if (firstWarehouse) {
        resolvedShelfId = await LocationService.getOrCreateSystemShelf(firstWarehouse.id);
      }
    }

    if (!resolvedShelfId) {
      const error: AppError = new Error('Shelf ID or Warehouse ID is required to create a location');
      error.statusCode = 400;
      error.code = ErrorCode.VALIDATION_ERROR;
      throw error;
    }

    return prisma.location.create({
      data: {
        shelfId: resolvedShelfId,
        warehouseId: warehouseId || null,
        name: name || cleanBarcode,
        barcode: cleanBarcode,
        fullLocation: fullLocation || null,
        row: row || null,
        rack: rack || null,
        level: level || null,
        location: location || null,
        fullLocation2: fullLocation2 || cleanBarcode,
        status: 'ACTIVE'
      },
      include: {
        shelf: true,
        warehouse: true
      }
    });
  }

  static async updateLocation(
    id: string,
    name?: string,
    isOccupied?: boolean,
    isActive?: boolean,
    status?: 'ACTIVE' | 'INACTIVE'
  ) {
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
        isActive: isActive !== undefined ? isActive : location.isActive,
        status: status !== undefined ? status : (isActive === false ? 'INACTIVE' : 'ACTIVE')
      },
      include: {
        shelf: true,
        warehouse: true,
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

  static async importWarehouseLocations(
    warehouseId: string,
    rows: LocationImportRowInput[]
  ) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId }
    });

    if (!warehouse) {
      const error: AppError = new Error('Warehouse not found');
      error.statusCode = 404;
      error.code = ErrorCode.WAREHOUSE_NOT_FOUND;
      throw error;
    }

    const defaultShelfId = await LocationService.getOrCreateSystemShelf(warehouseId);

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ row: number; location: string; error: string }> = [];

    for (let index = 0; index < rows.length; index++) {
      const rowNum = index + 1;
      const row = rows[index];

      const fullLocation2 = (
        row['NFull Location2'] ||
        row.fullLocation2 ||
        row['Full Location'] ||
        row.fullLocation ||
        row.barcode ||
        ''
      ).trim();

      const fullLocation = (row['Full Location'] || row.fullLocation || fullLocation2).trim();
      const rowStr = (row['NRow'] || row.row || '').trim();
      const rackStr = (row['NRack2'] || row.rack || '').trim();
      const levelStr = (row['Nlevel'] || row.level || '').trim();
      const locStr = (row['NLocation'] || row.location || '').trim();

      if (!fullLocation2 && !fullLocation && !locStr) {
        failed++;
        errors.push({
          row: rowNum,
          location: 'Empty Row',
          error: 'Location identifier (NFull Location2 / Full Location) is required'
        });
        continue;
      }

      const barcode = fullLocation2 || fullLocation || `${rowStr}-${rackStr}-${levelStr}-${locStr}`;
      const name = locStr || fullLocation2 || barcode;

      try {
        const existing = await prisma.location.findFirst({
          where: { barcode }
        });

        if (existing) {
          await prisma.location.update({
            where: { id: existing.id },
            data: {
              warehouseId,
              shelfId: existing.shelfId || defaultShelfId,
              fullLocation: fullLocation || existing.fullLocation,
              row: rowStr || existing.row,
              rack: rackStr || existing.rack,
              level: levelStr || existing.level,
              location: locStr || existing.location,
              fullLocation2: fullLocation2 || existing.fullLocation2,
              name: name || existing.name,
              status: 'ACTIVE',
              isActive: true
            }
          });
          updated++;
        } else {
          await prisma.location.create({
            data: {
              warehouseId,
              shelfId: defaultShelfId,
              barcode,
              name,
              fullLocation,
              row: rowStr,
              rack: rackStr,
              level: levelStr,
              location: locStr,
              fullLocation2,
              status: 'ACTIVE',
              isActive: true
            }
          });
          imported++;
        }
      } catch (err: any) {
        failed++;
        errors.push({
          row: rowNum,
          location: barcode,
          error: err?.message || 'Failed to save location'
        });
      }
    }

    return {
      totalRecords: rows.length,
      imported,
      updated,
      skipped,
      failed,
      errors
    };
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

    const warehouseId = shelf.rack?.room?.warehouseId;
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
            warehouseId: warehouseId || null,
            name: locName,
            barcode: locBarcode,
            fullLocation2: locBarcode,
            location: numStr,
            status: 'ACTIVE',
            isActive: true
          },
          update: {
            shelfId,
            levelId: levelId || null,
            warehouseId: warehouseId || null,
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
        data: { isActive: true, status: 'ACTIVE' }
      });
      return { success: true, count: res.count, message: `${res.count} locations activated` };
    }

    if (action === 'DEACTIVATE') {
      const res = await prisma.location.updateMany({
        where: { id: { in: ids } },
        data: { isActive: false, status: 'INACTIVE' }
      });
      return { success: true, count: res.count, message: `${res.count} locations deactivated` };
    }

    if (action === 'DELETE') {
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

    const warehouseId = shelf.rack?.room?.warehouseId;
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
            warehouseId: warehouseId || null,
            levelId: row.levelId || null,
            name,
            barcode,
            fullLocation2: barcode,
            status: 'ACTIVE',
            isActive: true
          },
          update: {
            shelfId,
            warehouseId: warehouseId || null,
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
