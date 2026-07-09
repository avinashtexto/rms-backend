import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class StorageService {
  // ==========================================
  // ROOM SERVICES
  // ==========================================
  
  static async listRooms(companyId: string, warehouseId: string) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId }
    });
    if (!warehouse) {
      const error: AppError = new Error('Warehouse not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }
    return prisma.room.findMany({
      where: { warehouseId },
      orderBy: { code: 'asc' }
    });
  }

  static async createRoom(companyId: string, warehouseId: string, name: string, code: string) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId }
    });
    if (!warehouse) {
      const error: AppError = new Error('Warehouse not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    const existing = await prisma.room.findUnique({
      where: {
        warehouseId_code: { warehouseId, code }
      }
    });
    if (existing) {
      const error: AppError = new Error(`Room with code '${code}' already exists in this Warehouse`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.room.create({
      data: { warehouseId, name, code }
    });
  }

  static async updateRoom(companyId: string, roomId: string, name?: string, isActive?: boolean) {
    const room = await prisma.room.findFirst({
      where: { id: roomId, warehouse: { companyId } }
    });
    if (!room) {
      const error: AppError = new Error('Room not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.room.update({
      where: { id: roomId },
      data: {
        name: name !== undefined ? name : room.name,
        isActive: isActive !== undefined ? isActive : room.isActive
      }
    });
  }

  // ==========================================
  // RACK SERVICES
  // ==========================================

  static async listRacks(companyId: string, roomId: string) {
    const room = await prisma.room.findFirst({
      where: { id: roomId, warehouse: { companyId } }
    });
    if (!room) {
      const error: AppError = new Error('Room not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }
    return prisma.rack.findMany({
      where: { roomId },
      orderBy: { code: 'asc' }
    });
  }

  static async createRack(companyId: string, roomId: string, name: string, code: string) {
    const room = await prisma.room.findFirst({
      where: { id: roomId, warehouse: { companyId } }
    });
    if (!room) {
      const error: AppError = new Error('Room not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    const existing = await prisma.rack.findUnique({
      where: {
        roomId_code: { roomId, code }
      }
    });
    if (existing) {
      const error: AppError = new Error(`Rack with code '${code}' already exists in this Room`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.rack.create({
      data: { roomId, name, code }
    });
  }

  static async updateRack(companyId: string, rackId: string, name?: string, isActive?: boolean) {
    const rack = await prisma.rack.findFirst({
      where: { id: rackId, room: { warehouse: { companyId } } }
    });
    if (!rack) {
      const error: AppError = new Error('Rack not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.rack.update({
      where: { id: rackId },
      data: {
        name: name !== undefined ? name : rack.name,
        isActive: isActive !== undefined ? isActive : rack.isActive
      }
    });
  }

  // ==========================================
  // SHELF SERVICES
  // ==========================================

  static async listShelves(companyId: string, rackId: string) {
    const rack = await prisma.rack.findFirst({
      where: { id: rackId, room: { warehouse: { companyId } } }
    });
    if (!rack) {
      const error: AppError = new Error('Rack not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }
    return prisma.shelf.findMany({
      where: { rackId },
      orderBy: { code: 'asc' }
    });
  }

  static async createShelf(companyId: string, rackId: string, name: string, code: string) {
    const rack = await prisma.rack.findFirst({
      where: { id: rackId, room: { warehouse: { companyId } } }
    });
    if (!rack) {
      const error: AppError = new Error('Rack not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    const existing = await prisma.shelf.findUnique({
      where: {
        rackId_code: { rackId, code }
      }
    });
    if (existing) {
      const error: AppError = new Error(`Shelf with code '${code}' already exists on this Rack`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.shelf.create({
      data: { rackId, name, code }
    });
  }

  static async updateShelf(companyId: string, shelfId: string, name?: string, isActive?: boolean) {
    const shelf = await prisma.shelf.findFirst({
      where: { id: shelfId, rack: { room: { warehouse: { companyId } } } }
    });
    if (!shelf) {
      const error: AppError = new Error('Shelf not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.shelf.update({
      where: { id: shelfId },
      data: {
        name: name !== undefined ? name : shelf.name,
        isActive: isActive !== undefined ? isActive : shelf.isActive
      }
    });
  }

  // ==========================================
  // LOCATION SERVICES
  // ==========================================

  static async listLocations(companyId: string, shelfId: string) {
    const shelf = await prisma.shelf.findFirst({
      where: { id: shelfId, rack: { room: { warehouse: { companyId } } } }
    });
    if (!shelf) {
      const error: AppError = new Error('Shelf not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }
    return prisma.location.findMany({
      where: { shelfId },
      orderBy: { name: 'asc' }
    });
  }

  static async createLocation(companyId: string, shelfId: string, name: string, barcode?: string) {
    const shelf = await prisma.shelf.findFirst({
      where: { id: shelfId, rack: { room: { warehouse: { companyId } } } },
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
      const error: AppError = new Error('Shelf not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    const existingName = await prisma.location.findUnique({
      where: {
        shelfId_name: { shelfId, name }
      }
    });
    if (existingName) {
      const error: AppError = new Error(`Location with name '${name}' already exists on this Shelf`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    // Auto-generate barcode if omitted
    let finalBarcode = barcode;
    if (!finalBarcode) {
      const prefix = shelf.rack.room.warehouse.code;
      const uniqueSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      finalBarcode = `LOC-${prefix}-${shelf.rack.room.code}-${shelf.rack.code}-${shelf.code}-${name}-${uniqueSuffix}`;
    }

    // Double check unique barcode constraint
    const existingBarcode = await prisma.location.findUnique({
      where: { barcode: finalBarcode }
    });
    if (existingBarcode) {
      const error: AppError = new Error(`Barcode '${finalBarcode}' is already registered to another Location`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.location.create({
      data: {
        shelfId,
        name,
        barcode: finalBarcode
      }
    });
  }

  static async updateLocation(
    companyId: string,
    locationId: string,
    name?: string,
    isActive?: boolean,
    isOccupied?: boolean
  ) {
    const location = await prisma.location.findFirst({
      where: { id: locationId, shelf: { rack: { room: { warehouse: { companyId } } } } }
    });
    if (!location) {
      const error: AppError = new Error('Location not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.location.update({
      where: { id: locationId },
      data: {
        name: name !== undefined ? name : location.name,
        isActive: isActive !== undefined ? isActive : location.isActive,
        isOccupied: isOccupied !== undefined ? isOccupied : location.isOccupied
      }
    });
  }

  static async resolveBarcode(companyId: string, barcode: string) {
    const location = await prisma.location.findUnique({
      where: { barcode },
      include: {
        shelf: {
          include: {
            rack: {
              include: {
                room: {
                  include: {
                    warehouse: {
                      include: {
                        site: {
                          include: {
                            branch: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!location) {
      const error: AppError = new Error(`Location barcode '${barcode}' not found`);
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    // Tenant safety check
    if (location.shelf.rack.room.warehouse.companyId !== companyId) {
      const error: AppError = new Error('Access denied: Location belongs to another tenant');
      error.statusCode = 403;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }

    const site = location.shelf?.rack?.room?.warehouse?.site;
    const branch = site?.branch;

    return {
      locationId: location.id,
      name: location.name,
      barcode: location.barcode,
      isOccupied: location.isOccupied,
      isActive: location.isActive,
      path: {
        branch: branch ? { id: branch.id, name: branch.name, code: branch.code } : null,
        site: site ? { id: site.id, name: site.name, code: site.code } : null,
        warehouse: location.shelf?.rack?.room?.warehouse ? { id: location.shelf.rack.room.warehouse.id, name: location.shelf.rack.room.warehouse.name, code: location.shelf.rack.room.warehouse.code } : null,
        room: location.shelf?.rack?.room ? { id: location.shelf.rack.room.id, name: location.shelf.rack.room.name, code: location.shelf.rack.room.code } : null,
        rack: location.shelf?.rack ? { id: location.shelf.rack.id, name: location.shelf.rack.name, code: location.shelf.rack.code } : null,
        shelf: location.shelf ? { id: location.shelf.id, name: location.shelf.name, code: location.shelf.code } : null
      }
    };
  }
}
