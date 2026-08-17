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
}
