import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

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

  static async createFileRecord(companyId: string, boxId: string, barcode: string, title?: string, status: 'ACTIVE' | 'ARCHIVED' | 'DESTROYED' = 'ACTIVE') {
    const box = await prisma.box.findFirst({
      where: { id: boxId, companyId }
    });

    if (!box) {
      const error: AppError = new Error('Box not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.BOX_NOT_FOUND;
      throw error;
    }

    const existing = await prisma.fileRecord.findUnique({
      where: { barcode }
    });

    if (existing) {
      const error: AppError = new Error(`File record barcode '${barcode}' is already taken`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.fileRecord.create({
      data: { companyId, boxId, barcode, title, status },
      include: {
        box: true
      }
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

  static async deleteFileRecord(id: string, companyId: string) {
    const fileRecord = await prisma.fileRecord.findFirst({
      where: { id, companyId }
    });

    if (!fileRecord) {
      const error: AppError = new Error('File record not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.FILE_RECORD_NOT_FOUND;
      throw error;
    }

    return prisma.fileRecord.delete({
      where: { id }
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

  static async bulkActionFileRecords(companyId: string, ids: string[], action: 'ACTIVATE' | 'ARCHIVE' | 'DELETE') {
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
      const res = await prisma.fileRecord.deleteMany({
        where: { id: { in: ids }, companyId }
      });
      return { success: true, count: res.count, message: `${res.count} file records deleted` };
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
