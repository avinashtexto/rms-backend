import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { BoxStatus, FileRecordStatus } from '@prisma/client';

export class BoxService {
  // ==========================================
  // BOX CRUD & RESOLUTION
  // ==========================================
  
  static async listBoxes(
    companyId: string,
    filters: { clientId?: string; departmentId?: string | null; status?: BoxStatus; locationId?: string },
    page: number = 1,
    pageSize: number = 20
  ) {
    const skip = (page - 1) * pageSize;
    const where: any = {
      companyId,
      ...(filters.clientId && { clientId: filters.clientId }),
      ...(filters.departmentId !== undefined && { departmentId: filters.departmentId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.locationId && { currentLocationId: filters.locationId })
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
      const error: AppError = new Error('Box not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return box;
  }

  static async createBox(
    companyId: string,
    clientId: string,
    departmentId?: string | null,
    barcode?: string,
    description?: string | null
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

    // Auto-generate barcode if missing
    let finalBarcode = barcode;
    if (!finalBarcode) {
      finalBarcode = `BOX-${client.code}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }

    // Check barcode uniqueness
    const existing = await prisma.box.findUnique({
      where: { barcode: finalBarcode }
    });
    if (existing) {
      const error: AppError = new Error(`Box with barcode '${finalBarcode}' already exists`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.box.create({
      data: {
        companyId,
        clientId,
        departmentId,
        barcode: finalBarcode,
        description
      }
    });
  }

  static async updateBox(
    companyId: string,
    boxId: string,
    clientId?: string,
    departmentId?: string | null,
    description?: string | null,
    status?: BoxStatus
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
        status: status !== undefined ? status : box.status
      }
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

  static async createFileRecord(companyId: string, boxId: string, title: string, barcode?: string) {
    const box = await prisma.box.findFirst({
      where: { id: boxId, companyId }
    });
    if (!box) {
      const error: AppError = new Error('Box not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    // Auto-generate barcode if missing
    let finalBarcode = barcode;
    if (!finalBarcode) {
      finalBarcode = `FILE-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    }

    // Check barcode uniqueness
    const existing = await prisma.fileRecord.findUnique({
      where: { barcode: finalBarcode }
    });
    if (existing) {
      const error: AppError = new Error(`FileRecord with barcode '${finalBarcode}' already exists`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.fileRecord.create({
      data: {
        companyId,
        boxId,
        title,
        barcode: finalBarcode
      }
    });
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
