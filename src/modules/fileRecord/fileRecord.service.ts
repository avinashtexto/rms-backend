import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { BarcodeMasterService } from '../barcode-master/barcode-master.service';
import { AuditService } from '../audit/audit.service';

export class FileRecordService {
  static async listFileRecords(companyId: string, boxId?: string, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;
    const where = {
      companyId,
      ...(boxId ? { boxId } : {})
    };
    const [data, total] = await Promise.all([
      prisma.fileRecord.findMany({
        where,
        include: {
          box: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.fileRecord.count({ where })
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  static async getFileRecord(id: string, companyId: string) {
    const fileRecord = await prisma.fileRecord.findFirst({
      where: { id, companyId },
      include: {
        box: true
      }
    });

    if (!fileRecord) {
      const error: AppError = new Error('File record not found');
      error.statusCode = 404;
      error.code = ErrorCode.FILE_RECORD_NOT_FOUND;
      throw error;
    }

    return fileRecord;
  }

  static async createFileRecord(
    companyId: string,
    boxId: string,
    barcode?: string,
    title?: string,
    status: 'ACTIVE' | 'ARCHIVED' | 'DESTROYED' = 'ACTIVE',
    userId?: string,
    deviceId?: string | null
  ) {
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
      // Auto-generate barcode if missing using sequential MAC+7digit logic
      let finalBarcode = barcode ? barcode.trim().toUpperCase() : '';
      if (!finalBarcode) {
        finalBarcode = await BarcodeMasterService.generateNextFileCode(tx);
      }

      // Check if provided barcode is a Box or Location barcode
      const isBox = await tx.box.findFirst({
        where: { companyId, barcode: { equals: finalBarcode, mode: 'insensitive' } }
      });
      const isBoxMaster = await tx.barcodeMaster.findFirst({
        where: { companyId, barcode: { equals: finalBarcode, mode: 'insensitive' }, type: 'BOX' }
      });
      if (isBox || isBoxMaster) {
        const error: AppError = new Error('Invalid barcode. Please scan a File barcode.');
        error.statusCode = 400;
        error.code = ErrorCode.INVALID_BARCODE_TYPE;
        throw error;
      }

      const existing = await tx.fileRecord.findUnique({
        where: { barcode: finalBarcode }
      });

      if (existing) {
        const error: AppError = new Error(`File record barcode '${finalBarcode}' is already taken`);
        error.statusCode = 400;
        error.code = ErrorCode.DUPLICATE_CODE;
        throw error;
      }

      const fileRecord = await tx.fileRecord.create({
        data: { companyId, boxId, barcode: finalBarcode, title, status },
        include: {
          box: true
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
            assignedToType: 'FILE_RECORD',
            assignedToId: fileRecord.id,
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
              type: 'FILE_RECORD',
              status: 'ASSIGNED',
              isAssigned: true,
              assignedToType: 'FILE_RECORD',
              assignedToId: fileRecord.id,
              assignedAt: new Date(),
              createdById: fallbackUserId,
              remarks: title || 'Auto-created with File Record'
            }
          });

          await tx.barcodeHistory.create({
            data: {
              barcodeMasterId: master.id,
              barcode: finalBarcode,
              action: 'CREATED',
              newStatus: 'ASSIGNED',
              userId: fallbackUserId,
              remarks: 'Auto-created with File Record'
            }
          });
        }
      }

      // Audit Log
      if (userId) {
        await AuditService.recordAuditLog({
          companyId,
          userId,
          action: 'FILE_RECORD_CREATED',
          entityType: 'FILE_RECORD',
          entityId: fileRecord.id,
          fileRecordId: fileRecord.id,
          boxId: fileRecord.boxId,
          deviceId: deviceId || null,
          newState: {
            id: fileRecord.id,
            barcode: fileRecord.barcode,
            fileCode: fileRecord.barcode,
            title: fileRecord.title,
            boxId: fileRecord.boxId,
            status: fileRecord.status
          },
          tx
        });
      }

      return {
        ...fileRecord,
        fileCode: fileRecord.barcode
      };
    });
  }

  static async updateFileRecord(id: string, companyId: string, title?: string, status?: 'ACTIVE' | 'ARCHIVED' | 'DESTROYED', boxId?: string) {
    const fileRecord = await prisma.fileRecord.findFirst({
      where: { id, companyId }
    });

    if (!fileRecord) {
      const error: AppError = new Error('File record not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.FILE_RECORD_NOT_FOUND;
      throw error;
    }

    if (boxId) {
      const box = await prisma.box.findFirst({
        where: { id: boxId, companyId }
      });

      if (!box) {
        const error: AppError = new Error('Box not found or access denied');
        error.statusCode = 404;
        error.code = ErrorCode.BOX_NOT_FOUND;
        throw error;
      }
    }

    return prisma.fileRecord.update({
      where: { id },
      data: {
        title: title !== undefined ? title : fileRecord.title,
        status: status !== undefined ? status : fileRecord.status,
        boxId: boxId !== undefined ? boxId : fileRecord.boxId
      },
      include: {
        box: true
      }
    });
  }

  static async deleteFileRecord(id: string, companyId: string, userId?: string) {
    const fileRecord = await prisma.fileRecord.findFirst({
      where: { id, companyId },
      include: {
        _count: {
          select: {
            refileEvents: true,
            inventoryVerificationScans: true,
            segregationMovedFiles: true,
            auditLogs: true
          }
        }
      }
    });

    if (!fileRecord) {
      const error: AppError = new Error('File record not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.FILE_RECORD_NOT_FOUND;
      throw error;
    }

    const hasDependencies =
      fileRecord._count.refileEvents > 0 ||
      fileRecord._count.inventoryVerificationScans > 0 ||
      fileRecord._count.segregationMovedFiles > 0;

    return prisma.$transaction(async (tx) => {
      // 1. Unassign BarcodeMaster if exists
      await tx.barcodeMaster.updateMany({
        where: { barcode: fileRecord.barcode },
        data: {
          isAssigned: false,
          status: 'UNASSIGNED',
          assignedToType: null,
          assignedToId: null,
          assignedAt: null
        }
      });

      if (hasDependencies) {
        // Soft delete / mark as DESTROYED to preserve historical refile and scan logs
        const updated = await tx.fileRecord.update({
          where: { id },
          data: { status: 'DESTROYED' }
        });

        if (userId) {
          await AuditService.recordAuditLog({
            companyId,
            userId,
            action: 'FILE_RECORD_DELETED',
            entityType: 'FILE_RECORD',
            entityId: id,
            fileRecordId: id,
            boxId: fileRecord.boxId,
            previousState: { status: fileRecord.status },
            newState: { status: 'DESTROYED', softDeleted: true },
            tx
          });
        }

        return { ...updated, mode: 'DEACTIVATED' };
      } else {
        // Clean foreign key audit logs and hard delete
        await tx.auditLog.deleteMany({
          where: { fileRecordId: id }
        });

        const deleted = await tx.fileRecord.delete({
          where: { id }
        });

        return { ...deleted, mode: 'HARD_DELETED' };
      }
    });
  }

  static async bulkGenerateFileRecords(
    companyId: string,
    boxId: string,
    prefix: string = 'FILE',
    startingNumber: number = 1,
    quantity: number = 20,
    padding: number = 4,
    titlePrefix?: string
  ) {
    const box = await prisma.box.findFirst({
      where: { id: boxId, companyId }
    });

    if (!box) {
      const error: AppError = new Error('Box not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.BOX_NOT_FOUND;
      throw error;
    }

    const safeQty = Math.min(Math.max(1, quantity), 500);
    const safeStart = Math.max(1, startingNumber);
    const safePadding = Math.min(Math.max(1, padding), 6);
    const cleanPrefix = (prefix || 'FILE').trim().toUpperCase();

    const results: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < safeQty; i++) {
        const num = safeStart + i;
        const numStr = String(num).padStart(safePadding, '0');
        const barcode = `${cleanPrefix}${numStr}`;
        const title = titlePrefix ? `${titlePrefix} #${numStr}` : `File Record ${barcode}`;

        const created = await tx.fileRecord.upsert({
          where: { barcode },
          create: {
            companyId,
            boxId,
            barcode,
            title,
            status: 'ACTIVE'
          },
          update: {
            boxId,
            title
          }
        });
        results.push(created);
      }
    });

    return {
      message: `Successfully generated ${results.length} file records for box ${box.barcode}`,
      count: results.length,
      fileRecords: results
    };
  }

  static async bulkActionFileRecords(
    companyId: string,
    ids: string[],
    action: 'ACTIVATE' | 'ARCHIVE' | 'DELETE',
    userId?: string
  ) {
    if (!Array.isArray(ids) || ids.length === 0) {
      const error: AppError = new Error('No file IDs provided');
      error.statusCode = 400;
      error.code = ErrorCode.VALIDATION_ERROR;
      throw error;
    }

    if (action === 'ACTIVATE') {
      const res = await prisma.fileRecord.updateMany({
        where: { id: { in: ids }, companyId },
        data: { status: 'ACTIVE' }
      });
      return { success: true, count: res.count, message: `${res.count} file records activated` };
    }

    if (action === 'ARCHIVE') {
      const res = await prisma.fileRecord.updateMany({
        where: { id: { in: ids }, companyId },
        data: { status: 'ARCHIVED' }
      });
      return { success: true, count: res.count, message: `${res.count} file records archived` };
    }

    if (action === 'DELETE') {
      return prisma.$transaction(async (tx) => {
        // Fetch files matching company scope with their dependency counts
        const files = await tx.fileRecord.findMany({
          where: { id: { in: ids }, companyId },
          include: {
            _count: {
              select: {
                refileEvents: true,
                inventoryVerificationScans: true,
                segregationMovedFiles: true,
                auditLogs: true
              }
            }
          }
        });

        let deletedCount = 0;
        let deactivatedCount = 0;

        for (const file of files) {
          const hasDependencies =
            file._count.refileEvents > 0 ||
            file._count.inventoryVerificationScans > 0 ||
            file._count.segregationMovedFiles > 0;

          // Unassign BarcodeMaster
          await tx.barcodeMaster.updateMany({
            where: { barcode: file.barcode },
            data: {
              isAssigned: false,
              status: 'UNASSIGNED',
              assignedToType: null,
              assignedToId: null,
              assignedAt: null
            }
          });

          if (hasDependencies) {
            // Soft delete / mark as DESTROYED
            await tx.fileRecord.update({
              where: { id: file.id },
              data: { status: 'DESTROYED' }
            });
            deactivatedCount++;

            if (userId) {
              await AuditService.recordAuditLog({
                companyId,
                userId,
                action: 'FILE_RECORD_DELETED',
                entityType: 'FILE_RECORD',
                entityId: file.id,
                fileRecordId: file.id,
                boxId: file.boxId,
                previousState: { status: file.status },
                newState: { status: 'DESTROYED', softDeleted: true },
                tx
              });
            }
          } else {
            // Safe to hard delete
            await tx.auditLog.deleteMany({
              where: { fileRecordId: file.id }
            });
            await tx.fileRecord.delete({
              where: { id: file.id }
            });
            deletedCount++;
          }
        }

        const totalAffected = deletedCount + deactivatedCount;
        return {
          success: true,
          count: totalAffected,
          data: {
            deleted: deletedCount,
            deactivated: deactivatedCount,
            total: totalAffected
          },
          message:
            deactivatedCount > 0
              ? `${totalAffected} file records processed (${deletedCount} deleted, ${deactivatedCount} deactivated due to refile/operational history)`
              : `${deletedCount} file records deleted`
        };
      });
    }

    throw new Error('Invalid bulk action');
  }

  static async bulkImportFileRecords(
    companyId: string,
    defaultBoxId: string,
    rows: { barcode: string; label?: string; boxBarcode?: string }[]
  ) {
    if (!Array.isArray(rows) || rows.length === 0) {
      const error: AppError = new Error('No rows provided for import');
      error.statusCode = 400;
      error.code = ErrorCode.VALIDATION_ERROR;
      throw error;
    }

    const defaultBox = await prisma.box.findFirst({
      where: { id: defaultBoxId, companyId }
    });

    if (!defaultBox) {
      const error: AppError = new Error('Default box not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.BOX_NOT_FOUND;
      throw error;
    }

    const results: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        let targetBoxId = defaultBox.id;
        if (row.boxBarcode) {
          const matchingBox = await tx.box.findFirst({
            where: { barcode: row.boxBarcode.trim(), companyId }
          });
          if (matchingBox) {
            targetBoxId = matchingBox.id;
          }
        }

        const barcode = row.barcode.trim();
        const title = row.label ? row.label.trim() : `File Record ${barcode}`;

        const file = await tx.fileRecord.upsert({
          where: { barcode },
          create: {
            companyId,
            boxId: targetBoxId,
            barcode,
            title,
            status: 'ACTIVE'
          },
          update: {
            boxId: targetBoxId,
            title
          }
        });
        results.push(file);
      }
    });

    return {
      message: `Successfully imported ${results.length} file records`,
      count: results.length,
      fileRecords: results
    };
  }
}
