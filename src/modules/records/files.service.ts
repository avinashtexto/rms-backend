import { Prisma } from '@prisma/client';
import { WorkflowAction } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { ListFilesQuery, PaginatedResult, RecordsUser } from './records.types';
import { buildLocationBreadcrumb, isUuid, locationBreadcrumbInclude } from './records.utils';

export class FilesRecordsService {
  private static async findFileOrThrow(companyId: string, idOrBarcode: string) {
    const file = await prisma.fileRecord.findFirst({
      where: {
        companyId,
        ...(isUuid(idOrBarcode) ? { id: idOrBarcode } : { barcode: idOrBarcode })
      }
    });

    if (!file) {
      const error: AppError = new Error('File record not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.FILE_RECORD_NOT_FOUND;
      throw error;
    }

    return file;
  }

  static async list(
    query: ListFilesQuery,
    user: RecordsUser
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.FileRecordWhereInput = {
      companyId: user.companyId,
      ...(query.status && { status: query.status }),
      ...(query.boxId && { boxId: query.boxId }),
      ...(query.clientId && { box: { clientId: query.clientId } }),
      ...(query.search && {
        OR: [
          { barcode: { contains: query.search, mode: 'insensitive' } },
          { title: { contains: query.search, mode: 'insensitive' } }
        ]
      })
    };

    const orderBy: Prisma.FileRecordOrderByWithRelationInput = {
      [query.sortBy]: query.order
    };

    const [files, total] = await prisma.$transaction([
      prisma.fileRecord.findMany({
        where,
        include: {
          box: {
            select: {
              id: true,
              barcode: true,
              description: true,
              client: { select: { id: true, code: true, name: true } }
            }
          }
        },
        orderBy,
        skip,
        take: query.limit
      }),
      prisma.fileRecord.count({ where })
    ]);

    return {
      data: files.map((file) => ({
        id: file.id,
        barcode: file.barcode,
        label: file.title,
        status: file.status,
        homeBoxId: file.boxId,
        box: file.box,
        client: file.box.client,
        updatedAt: file.updatedAt
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    };
  }

  static async get(idOrBarcode: string, user: RecordsUser) {
    const file = await prisma.fileRecord.findFirst({
      where: {
        companyId: user.companyId,
        ...(isUuid(idOrBarcode) ? { id: idOrBarcode } : { barcode: idOrBarcode })
      },
      include: {
        box: {
          include: {
            client: { select: { id: true, code: true, name: true } },
            currentLocation: {
              include: locationBreadcrumbInclude
            }
          }
        }
      }
    });

    if (!file) {
      const error: AppError = new Error('File record not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.FILE_RECORD_NOT_FOUND;
      throw error;
    }

    return {
      id: file.id,
      barcode: file.barcode,
      label: file.title,
      status: file.status,
      homeBoxId: file.boxId,
      box: {
        id: file.box.id,
        barcode: file.box.barcode,
        label: file.box.description,
        status: file.box.status
      },
      client: file.box.client,
      location: file.box.currentLocation
        ? {
            id: file.box.currentLocation.id,
            barcode: file.box.currentLocation.barcode,
            name: file.box.currentLocation.name,
            breadcrumb: buildLocationBreadcrumb(file.box.currentLocation)
          }
        : null,
      updatedAt: file.updatedAt
    };
  }

  static async update(
    idOrBarcode: string,
    data: { label?: string; homeBoxId?: string },
    user: RecordsUser
  ) {
    const file = await FilesRecordsService.findFileOrThrow(user.companyId, idOrBarcode);

    if (data.homeBoxId) {
      const targetBox = await prisma.box.findFirst({
        where: { id: data.homeBoxId, companyId: user.companyId }
      });
      if (!targetBox) {
        const error: AppError = new Error('Target box not found or access denied');
        error.statusCode = 404;
        error.code = ErrorCode.BOX_NOT_FOUND;
        throw error;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.fileRecord.update({
        where: { id: file.id },
        data: {
          ...(data.label !== undefined && { title: data.label }),
          ...(data.homeBoxId !== undefined && { boxId: data.homeBoxId })
        },
        include: {
          box: {
            include: {
              client: { select: { id: true, code: true, name: true } },
              currentLocation: {
                include: locationBreadcrumbInclude
              }
            }
          }
        }
      });

      if (data.homeBoxId !== undefined && data.homeBoxId !== file.boxId) {
        await tx.auditLog.create({
          data: {
            companyId: user.companyId,
            userId: user.id,
            boxId: data.homeBoxId,
            fileRecordId: file.id,
            action: WorkflowAction.FILE_RECORD_UPDATED,
            previousState: {
              homeBoxId: file.boxId,
              label: file.title
            },
            newState: {
              homeBoxId: data.homeBoxId,
              label: next.title
            }
          }
        });
      } else if (data.label !== undefined && data.label !== file.title) {
        await tx.auditLog.create({
          data: {
            companyId: user.companyId,
            userId: user.id,
            boxId: next.boxId,
            fileRecordId: file.id,
            action: WorkflowAction.FILE_RECORD_UPDATED,
            previousState: { label: file.title },
            newState: { label: next.title }
          }
        });
      }

      return next;
    });

    return {
      id: updated.id,
      barcode: updated.barcode,
      label: updated.title,
      status: updated.status,
      homeBoxId: updated.boxId,
      box: {
        id: updated.box.id,
        barcode: updated.box.barcode,
        label: updated.box.description,
        status: updated.box.status
      },
      client: updated.box.client,
      location: updated.box.currentLocation
        ? {
            id: updated.box.currentLocation.id,
            barcode: updated.box.currentLocation.barcode,
            name: updated.box.currentLocation.name,
            breadcrumb: buildLocationBreadcrumb(updated.box.currentLocation)
          }
        : null,
      updatedAt: updated.updatedAt
    };
  }

  static async timeline(idOrBarcode: string, user: RecordsUser) {
    const file = await FilesRecordsService.findFileOrThrow(user.companyId, idOrBarcode);

    const logs = await prisma.auditLog.findMany({
      where: {
        companyId: user.companyId,
        fileRecordId: file.id
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
