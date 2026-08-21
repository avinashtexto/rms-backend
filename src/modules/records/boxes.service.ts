import { Prisma } from '@prisma/client';
import { WorkflowAction } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { ListBoxesQuery, PaginatedResult, RecordsUser } from './records.types';
import { buildLocationBreadcrumb, isUuid, locationBreadcrumbInclude } from './records.utils';

export class BoxesRecordsService {
  private static async findBoxOrThrow(companyId: string, idOrBarcode: string) {
    const box = await prisma.box.findFirst({
      where: {
        companyId,
        ...(isUuid(idOrBarcode) ? { id: idOrBarcode } : { barcode: idOrBarcode })
      }
    });

    if (!box) {
      const error: AppError = new Error('Box not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.BOX_NOT_FOUND;
      throw error;
    }

    return box;
  }

  static async list(
    query: ListBoxesQuery,
    user: RecordsUser
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.BoxWhereInput = {
      companyId: user.companyId,
      ...(query.status && { status: query.status }),
      ...(query.clientId && { clientId: query.clientId }),
      ...(query.locationId && { currentLocationId: query.locationId }),
      ...(query.warehouseId && {
        currentLocation: {
          shelf: {
            rack: {
              room: {
                warehouseId: query.warehouseId
              }
            }
          }
        }
      }),
      ...(query.search && {
        OR: [
          { barcode: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } }
        ]
      })
    };

    const orderBy: Prisma.BoxOrderByWithRelationInput = {
      [query.sortBy]: query.order
    };

    const [boxes, total] = await prisma.$transaction([
      prisma.box.findMany({
        where,
        include: {
          client: { select: { id: true, code: true, name: true } },
          currentLocation: {
            select: {
              id: true,
              barcode: true,
              name: true
            }
          },
          _count: { select: { fileRecords: true } }
        },
        orderBy,
        skip,
        take: query.limit
      }),
      prisma.box.count({ where })
    ]);

    return {
      data: boxes.map((box) => {
        const capacity = box.capacity ?? box.fileCapacity ?? 25;
        const fileCount = box._count.fileRecords;
        return {
          id: box.id,
          barcode: box.barcode,
          label: box.description,
          status: box.status,
          capacity,
          fileCapacity: box.fileCapacity ?? capacity,
          client: box.client,
          location: box.currentLocation,
          fileCount,
          availableSlots: Math.max(0, capacity - fileCount),
          updatedAt: box.updatedAt
        };
      }),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    };
  }

  static async get(idOrBarcode: string, user: RecordsUser) {
    const box = await prisma.box.findFirst({
      where: {
        companyId: user.companyId,
        ...(isUuid(idOrBarcode) ? { id: idOrBarcode } : { barcode: idOrBarcode })
      },
      include: {
        client: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        currentLocation: {
          include: locationBreadcrumbInclude
        },
        fileRecords: {
          orderBy: { barcode: 'asc' },
          select: {
            id: true,
            barcode: true,
            title: true,
            status: true,
            updatedAt: true
          }
        }
      }
    });

    if (!box) {
      const error: AppError = new Error('Box not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.BOX_NOT_FOUND;
      throw error;
    }

    const capacity = box.capacity ?? box.fileCapacity ?? 25;
    const fileCount = box.fileRecords.length;

    return {
      id: box.id,
      barcode: box.barcode,
      label: box.description,
      status: box.status,
      capacity,
      fileCapacity: box.fileCapacity ?? capacity,
      client: box.client,
      department: box.department,
      location: box.currentLocation
        ? {
            id: box.currentLocation.id,
            barcode: box.currentLocation.barcode,
            name: box.currentLocation.name,
            breadcrumb: buildLocationBreadcrumb(box.currentLocation)
          }
        : null,
      files: box.fileRecords.map((file) => ({
        id: file.id,
        barcode: file.barcode,
        label: file.title,
        status: file.status,
        updatedAt: file.updatedAt
      })),
      fileCount,
      availableSlots: Math.max(0, capacity - fileCount),
      updatedAt: box.updatedAt
    };
  }

  static async update(
    idOrBarcode: string,
    data: { label?: string; capacity?: number; fileCapacity?: number },
    user: RecordsUser
  ) {
    const box = await prisma.box.findFirst({
      where: {
        companyId: user.companyId,
        ...(isUuid(idOrBarcode) ? { id: idOrBarcode } : { barcode: idOrBarcode })
      },
      include: {
        _count: { select: { fileRecords: true } }
      }
    });

    if (!box) {
      const error: AppError = new Error('Box not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.BOX_NOT_FOUND;
      throw error;
    }

    const currentFileCount = box._count.fileRecords;
    const targetCapacity = data.capacity !== undefined ? data.capacity : data.fileCapacity;

    if (targetCapacity !== undefined) {
      if (targetCapacity < 1) {
        const error: AppError = new Error('Box capacity must be at least 1');
        error.statusCode = 400;
        error.code = ErrorCode.VALIDATION_ERROR;
        throw error;
      }

      if (targetCapacity < currentFileCount) {
        const error: AppError = new Error(
          `Cannot reduce box capacity below the current file count (${currentFileCount}).`
        );
        error.statusCode = 400;
        error.code = ErrorCode.VALIDATION_ERROR;
        throw error;
      }
    }

    const prevCapacity = box.capacity ?? box.fileCapacity ?? 25;
    const newCapacity = targetCapacity !== undefined ? targetCapacity : prevCapacity;

    const updated = await prisma.box.update({
      where: { id: box.id },
      data: {
        ...(data.label !== undefined && { description: data.label }),
        ...(targetCapacity !== undefined && {
          capacity: targetCapacity,
          fileCapacity: targetCapacity
        })
      },
      include: {
        client: { select: { id: true, code: true, name: true } },
        currentLocation: { select: { id: true, barcode: true, name: true } },
        _count: { select: { fileRecords: true } }
      }
    });

    if (data.label !== undefined || targetCapacity !== undefined) {
      await prisma.auditLog.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          boxId: box.id,
          action: WorkflowAction.BOX_UPDATED,
          previousState: {
            label: box.description,
            capacity: prevCapacity,
            fileCapacity: box.fileCapacity
          },
          newState: {
            label: updated.description,
            capacity: newCapacity,
            fileCapacity: updated.fileCapacity
          }
        }
      });
    }

    const updatedCapacity = updated.capacity ?? updated.fileCapacity ?? 25;
    const updatedFileCount = updated._count.fileRecords;

    return {
      id: updated.id,
      barcode: updated.barcode,
      label: updated.description,
      status: updated.status,
      capacity: updatedCapacity,
      fileCapacity: updated.fileCapacity,
      client: updated.client,
      location: updated.currentLocation,
      fileCount: updatedFileCount,
      availableSlots: Math.max(0, updatedCapacity - updatedFileCount),
      updatedAt: updated.updatedAt
    };
  }

  static async timeline(idOrBarcode: string, user: RecordsUser) {
    const box = await BoxesRecordsService.findBoxOrThrow(user.companyId, idOrBarcode);

    const logs = await prisma.auditLog.findMany({
      where: {
        companyId: user.companyId,
        boxId: box.id
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        device: { select: { id: true, serialNumber: true, model: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      previousState: log.previousState,
      newState: log.newState,
      user: log.user,
      device: log.device,
      createdAt: log.createdAt
    }));
  }
}
