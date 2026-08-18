import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { BoxStatus, FileRecordStatus } from '@prisma/client';

import { BarcodeMasterService } from '../barcode-master/barcode-master.service';
import { AuditService } from '../audit/audit.service';
import { FileRecordService } from '../fileRecord/fileRecord.service';
import { buildLocationBreadcrumb, locationBreadcrumbInclude } from '../records/records.utils';

export class BoxService {
  // ==========================================
  // BOX CRUD & RESOLUTION
  // ==========================================
  
  static async listBoxes(
    companyId: string,
    filters: { clientId?: string; departmentId?: string | null; status?: BoxStatus; locationId?: string; warehouseId?: string | null },
    page: number = 1,
    pageSize: number = 20
  ) {
    const skip = (page - 1) * pageSize;
    const where: any = {
      companyId,
      ...(filters.clientId && { clientId: filters.clientId }),
      ...(filters.departmentId !== undefined && { departmentId: filters.departmentId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.locationId && { currentLocationId: filters.locationId }),
      ...(filters.warehouseId && {
        currentLocation: {
          shelf: {
            rack: {
              room: {
                warehouseId: filters.warehouseId
              }
            }
          }
        }
      })
    };

    const [boxes, total] = await prisma.$transaction([
      prisma.box.findMany({
        where,
        include: {
          client: true,
          department: true,
          currentLocation: true,
          _count: { select: { fileRecords: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.box.count({ where })
    ]);

    return { boxes, meta: { page, pageSize, total } };
  }

  static async getBoxById(companyId: string, boxId: string) {
    const box = await prisma.box.findFirst({
      where: { id: boxId, companyId },
      include: {
        client: true,
        department: true,
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
        },
        _count: { select: { fileRecords: true } }
      }
    });

    if (!box) {
      const error: AppError = new Error('Box not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return {
      ...box,
      label: box.description,
      location: box.currentLocation
        ? {
            id: box.currentLocation.id,
            barcode: box.currentLocation.barcode,
            name: box.currentLocation.name,
            breadcrumb: buildLocationBreadcrumb(box.currentLocation as any)
          }
        : null,
      files: box.fileRecords.map((f) => ({
        id: f.id,
        barcode: f.barcode,
        label: f.title,
        status: f.status,
        updatedAt: f.updatedAt
      }))
    };
  }

  static async createBox(
    companyId: string,
    clientId: string,
    departmentId?: string | null,
    barcode?: string,
    description?: string | null,
    capacity?: number | null,
    userId?: string,
    deviceId?: string | null
  ) {
    // Verify client belongs to current company
    const client = await prisma.client.findFirst({
      where: { id: clientId, companyId }
    });
    if (!client) {
      const error: AppError = new Error('Client not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    // Verify department belongs to client
    if (departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, clientId }
      });
      if (!department) {
        const error: AppError = new Error('Department does not belong to the selected Client');
        error.statusCode = 400;
        error.code = ErrorCode.VALIDATION_ERROR;
        throw error;
      }
    }

    return prisma.$transaction(async (tx) => {
      // Auto-generate barcode if missing using sequential BX+6digit logic
      let finalBarcode = barcode ? barcode.trim().toUpperCase() : '';
      if (!finalBarcode) {
        finalBarcode = await BarcodeMasterService.generateNextBoxBarcode(tx);
      }

      // Check barcode uniqueness in Box
      const existing = await tx.box.findUnique({
        where: { barcode: finalBarcode }
      });
      if (existing) {
        const error: AppError = new Error(`Box with barcode '${finalBarcode}' already exists`);
        error.statusCode = 400;
        error.code = ErrorCode.DUPLICATE_CODE;
        throw error;
      }

      // Create the Box record
      const createdBox = await tx.box.create({
        data: {
          companyId,
          clientId,
          departmentId,
          barcode: finalBarcode,
          description,
          capacity: capacity !== undefined ? capacity : 25
        },
        include: {
          client: true,
          department: true,
          currentLocation: true,
          _count: { select: { fileRecords: true } }
        }
      });

      // Upsert into BarcodeMaster to ensure lifecycle synchronization
      const existingMaster = await tx.barcodeMaster.findUnique({
        where: { barcode: finalBarcode }
      });

      if (existingMaster) {
        await tx.barcodeMaster.update({
          where: { id: existingMaster.id },
          data: {
            isAssigned: true,
            status: 'ASSIGNED',
            assignedToType: 'BOX',
            assignedToId: createdBox.id,
            assignedAt: new Date()
          }
        });
      } else {
        const fallbackUserId = userId || (await tx.user.findFirst({ where: { companyId } }))?.id || '';
        if (fallbackUserId) {
          const master = await tx.barcodeMaster.create({
            data: {
              companyId,
              barcode: finalBarcode,
              type: 'BOX',
              status: 'ASSIGNED',
              isAssigned: true,
              assignedToType: 'BOX',
              assignedToId: createdBox.id,
              assignedAt: new Date(),
              createdById: fallbackUserId,
              remarks: description || 'Auto-created with Box'
            }
          });

          await tx.barcodeHistory.create({
            data: {
              barcodeMasterId: master.id,
              barcode: finalBarcode,
              action: 'CREATED',
              newStatus: 'ASSIGNED',
              userId: fallbackUserId,
              remarks: 'Auto-created with Box'
            }
          });
        }
      }

      // Audit Log
      if (userId) {
        await AuditService.recordAuditLog({
          companyId,
          userId,
          action: 'BOX_CREATED',
          entityType: 'BOX',
          entityId: createdBox.id,
          boxId: createdBox.id,
          deviceId: deviceId || null,
          newState: {
            id: createdBox.id,
            barcode: createdBox.barcode,
            clientId: createdBox.clientId,
            departmentId: createdBox.departmentId,
            capacity: createdBox.capacity,
            description: createdBox.description
          },
          tx
        });
      }

      return createdBox;
    });
  }

  static async updateBox(
    companyId: string,
    boxId: string,
    clientId?: string,
    departmentId?: string | null,
    description?: string | null,
    status?: BoxStatus,
    capacity?: number | null
  ) {
    const box = await prisma.box.findFirst({
      where: { id: boxId, companyId }
    });

    if (!box) {
      const error: AppError = new Error('Box not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    // If client is changing, verify tenant ownership
    if (clientId && clientId !== box.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, companyId }
      });
      if (!client) {
        const error: AppError = new Error('Client not found or access denied');
        error.statusCode = 404;
        error.code = ErrorCode.NOT_FOUND;
        throw error;
      }
    }

    // If department is changing, verify association
    const finalClientId = clientId || box.clientId;
    if (departmentId && departmentId !== box.departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, clientId: finalClientId }
      });
      if (!department) {
        const error: AppError = new Error('Department does not belong to the selected Client');
        error.statusCode = 400;
        error.code = ErrorCode.VALIDATION_ERROR;
        throw error;
      }
    }

    return prisma.box.update({
      where: { id: boxId },
      data: {
        clientId: clientId !== undefined ? clientId : box.clientId,
        departmentId: departmentId !== undefined ? departmentId : box.departmentId,
        description: description !== undefined ? description : box.description,
        status: status !== undefined ? status : box.status,
        capacity: capacity !== undefined ? capacity : box.capacity
      }
    });
  }

  static async deleteBox(companyId: string, boxId: string) {
    const box = await prisma.box.findFirst({
      where: { id: boxId, companyId }
    });

    if (!box) {
      const error: AppError = new Error('Box not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.BOX_NOT_FOUND;
      throw error;
    }

    return prisma.$transaction(async (tx) => {
      // 1. Cascade-delete InventoryVerificationScans first (depends on InventoryVerificationSession & FileRecord)
      await tx.inventoryVerificationScan.deleteMany({ where: { boxId } });
      // 2. Delete InventoryVerificationSessions
      await tx.inventoryVerificationSession.deleteMany({ where: { boxId } });
      // 3. Delete FreshBoxMoveScans
      await tx.freshBoxMoveScan.deleteMany({ where: { boxId } });
      // 4. Delete Transfers linked to this box
      await tx.transfer.deleteMany({ where: { boxId } });
      // 5. Clear AuditLog entries
      await tx.auditLog.deleteMany({ where: { boxId } });
      // 6. Delete FileRecords (has FK to Box, must come after their own dependents)
      await tx.fileRecord.deleteMany({ where: { boxId } });
      // 7. Finally delete the Box
      return tx.box.delete({
        where: { id: boxId }
      });
    });
  }

  static async resolveBoxBarcode(companyId: string, barcode: string) {
    const box = await prisma.box.findFirst({
      where: { barcode, companyId },
      include: {
        client: true,
        department: true,
        currentLocation: {
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
            }
          }
        },
        _count: { select: { fileRecords: true } }
      }
    });

    if (!box) {
      const error: AppError = new Error(`Box barcode '${barcode}' not found`);
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return box;
  }

  // ==========================================
  // FILE RECORD CRUD & RESOLUTION
  // ==========================================

  static async listFilesByBox(companyId: string, boxId: string) {
    const box = await prisma.box.findFirst({
      where: { id: boxId, companyId }
    });
    if (!box) {
      const error: AppError = new Error('Box not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }
    return prisma.fileRecord.findMany({
      where: { boxId },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createFileRecord(
    companyId: string,
    boxId: string,
    title?: string,
    barcode?: string,
    userId?: string,
    deviceId?: string | null
  ) {
    return FileRecordService.createFileRecord(
      companyId,
      boxId,
      barcode,
      title,
      'ACTIVE',
      userId,
      deviceId
    );
  }

  static async updateFileRecord(companyId: string, fileRecordId: string, title?: string, status?: FileRecordStatus) {
    const file = await prisma.fileRecord.findFirst({
      where: { id: fileRecordId, companyId }
    });

    if (!file) {
      const error: AppError = new Error('FileRecord not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.fileRecord.update({
      where: { id: fileRecordId },
      data: {
        title: title !== undefined ? title : file.title,
        status: status !== undefined ? status : file.status
      }
    });
  }

  static async resolveFileBarcode(companyId: string, barcode: string) {
    const file = await prisma.fileRecord.findFirst({
      where: { barcode, companyId },
      include: {
        box: {
          include: {
            client: true,
            department: true,
            currentLocation: true
          }
        }
      }
    });

    if (!file) {
      const error: AppError = new Error(`File barcode '${barcode}' not found`);
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return file;
  }

  // ==========================================
  // GLOBAL SEARCH
  // ==========================================

  static async search(companyId: string, query: string) {
    const [boxes, files] = await prisma.$transaction([
      prisma.box.findMany({
        where: {
          companyId,
          OR: [
            { barcode: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        include: { client: true, department: true, currentLocation: true },
        take: 20
      }),
      prisma.fileRecord.findMany({
        where: {
          companyId,
          OR: [
            { barcode: { contains: query, mode: 'insensitive' } },
            { title: { contains: query, mode: 'insensitive' } }
          ]
        },
        include: { box: true },
        take: 20
      })
    ]);

    return { boxes, files };
  }
}
