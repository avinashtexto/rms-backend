import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { CreateRowInput, UpdateRowInput } from './room.validation';

function pad(value: number, size = 2) {
  return String(value).padStart(size, '0');
}

export class RoomService {
  private static async getLocationCountsByRoomIds(roomIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (roomIds.length === 0) {
      return counts;
    }

    await Promise.all(
      roomIds.map(async (roomId) => {
        const count = await prisma.location.count({
          where: {
            shelf: {
              rack: { roomId }
            }
          }
        });
        counts.set(roomId, count);
      })
    );

    return counts;
  }

  static async listRooms(warehouseId?: string) {
    const rooms = await prisma.room.findMany({
      where: warehouseId ? { warehouseId } : undefined,
      include: {
        warehouse: true,
        rows: {
          orderBy: { code: 'asc' },
          include: {
            racks: { select: { id: true, name: true, code: true } }
          }
        },
        _count: {
          select: {
            rows: true,
            racks: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const locationCounts = await RoomService.getLocationCountsByRoomIds(rooms.map((room) => room.id));

    return rooms.map((room) => ({
      ...room,
      rowCount: room._count.rows,
      rackCount: room._count.racks,
      locationCount: locationCounts.get(room.id) ?? 0
    }));
  }

  static async getRoom(id: string) {
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        warehouse: true,
        rows: {
          orderBy: { code: 'asc' },
          include: {
            racks: { select: { id: true, name: true, code: true } }
          }
        }
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
      include: {
        racks: {
          select: { id: true, name: true, code: true }
        }
      },
      orderBy: { code: 'asc' }
    });
  }

  static async createRow(roomId: string, data: CreateRowInput) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      const error: AppError = new Error('Room not found');
      error.statusCode = 404;
      error.code = ErrorCode.ROOM_NOT_FOUND;
      throw error;
    }

    if (data.rackId) {
      const rack = await prisma.rack.findFirst({ where: { id: data.rackId, roomId } });
      if (!rack) {
        const error: AppError = new Error('Rack not found in selected room');
        error.statusCode = 404;
        error.code = ErrorCode.NOT_FOUND;
        throw error;
      }
    }

    const createdRows = await prisma.$transaction(async (tx) => {
      const rows = [];
      const count = data.noOfRows ?? 1;

      for (let i = 1; i <= count; i++) {
        const code = data.code && count === 1 ? data.code.toUpperCase() : `${data.rowPrefix}${pad(i)}`.toUpperCase();
        const name =
          data.name && count === 1
            ? data.name
            : `${data.column}-${data.rowPrefix}${pad(i)}`;

        const existing = await tx.row.findUnique({
          where: { roomId_code: { roomId, code } }
        });
        if (existing) {
          const error: AppError = new Error(`Row code '${code}' already exists in this room`);
          error.statusCode = 400;
          error.code = ErrorCode.DUPLICATE_CODE;
          throw error;
        }

        const row = await tx.row.create({
          data: {
            roomId,
            name,
            code,
            column: data.column,
            rowPrefix: data.rowPrefix,
            columnsInCell: data.columnsInCell,
            capacityOfCell: data.capacityOfCell,
            floor: data.floor,
            isTemporaryLocation: data.isTemporaryLocation ?? false,
            description: data.description
          },
          include: {
            racks: { select: { id: true, name: true, code: true } }
          }
        });
        rows.push(row);
      }

      if (data.rackId && rows[0]) {
        await tx.rack.update({
          where: { id: data.rackId },
          data: { rowId: rows[0].id }
        });
      }

      return rows;
    });

    return createdRows.length === 1 ? createdRows[0] : createdRows;
  }

  static async updateRow(roomId: string, rowId: string, data: UpdateRowInput) {
    const row = await prisma.row.findFirst({ where: { id: rowId, roomId } });
    if (!row) {
      const error: AppError = new Error('Row not found');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    if (data.code && data.code.toUpperCase() !== row.code) {
      const existing = await prisma.row.findUnique({
        where: { roomId_code: { roomId, code: data.code.toUpperCase() } }
      });
      if (existing) {
        const error: AppError = new Error(`Row code '${data.code}' already exists in this room`);
        error.statusCode = 400;
        error.code = ErrorCode.DUPLICATE_CODE;
        throw error;
      }
    }

    if (data.rackId) {
      const rack = await prisma.rack.findFirst({ where: { id: data.rackId, roomId } });
      if (!rack) {
        const error: AppError = new Error('Rack not found in selected room');
        error.statusCode = 404;
        error.code = ErrorCode.NOT_FOUND;
        throw error;
      }
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.row.update({
        where: { id: rowId },
        data: {
          name: data.name,
          code: data.code ? data.code.toUpperCase() : undefined,
          column: data.column,
          rowPrefix: data.rowPrefix,
          columnsInCell: data.columnsInCell,
          capacityOfCell: data.capacityOfCell,
          floor: data.floor,
          isTemporaryLocation: data.isTemporaryLocation,
          description: data.description,
          isActive: data.isActive
        },
        include: {
          racks: { select: { id: true, name: true, code: true } }
        }
      });

      if (data.rackId !== undefined) {
        await tx.rack.updateMany({
          where: { rowId },
          data: { rowId: null }
        });
        if (data.rackId) {
          await tx.rack.update({
            where: { id: data.rackId },
            data: { rowId }
          });
        }
      }

      return updated;
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

  static async createRoom(
    warehouseId: string,
    name: string,
    code: string,
    description?: string,
    location?: string
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
      data: { warehouseId, name, code, description, location },
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
    code?: string,
    location?: string
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
        location: location !== undefined ? location : room.location,
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
