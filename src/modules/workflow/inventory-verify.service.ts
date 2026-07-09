import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { WorkflowAction } from '@prisma/client';

export class InventoryVerifyService {
  static async startSession(companyId: string, operatorId: string, boxId: string) {
    // Verify box exists and belongs to company
    const box = await prisma.box.findFirst({
      where: { id: boxId, companyId }
    });
    if (!box) {
      const error: AppError = new Error('Box not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.inventoryVerificationSession.create({
      data: {
        operatorId,
        boxId
      }
    });
  }

  static async submitScan(
    companyId: string,
    operatorId: string,
    sessionId: string,
    data: {
      fileBarcode: string;
      clientEventId: string;
      scannedAt: Date;
    }
  ) {
    const session = await prisma.inventoryVerificationSession.findUnique({
      where: { id: sessionId },
      include: { box: true }
    });

    if (!session) {
      const error: AppError = new Error('Session not found');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    if (session.endedAt) {
      const error: AppError = new Error('Session has already ended');
      error.statusCode = 400;
      error.code = ErrorCode.VALIDATION_ERROR;
      throw error;
    }

    // Idempotency check
    const existing = await prisma.inventoryVerificationScan.findUnique({
      where: { clientEventId: data.clientEventId },
      include: { fileRecord: true }
    });
    if (existing) {
      return existing;
    }

    // Find the FileRecord
    const file = await prisma.fileRecord.findUnique({
      where: { barcode: data.fileBarcode },
      include: { box: true }
    });

    // Handle unexpected barcode (not matching any file record)
    if (!file) {
      return prisma.$transaction(async (tx) => {
        const scan = await tx.inventoryVerificationScan.create({
          data: {
            sessionId,
            boxId: session.boxId,
            fileRecordId: null,
            clientEventId: data.clientEventId,
            isExpected: false,
            scannedAt: data.scannedAt
          }
        });

        // Increment unexpected count
        await tx.inventoryVerificationSession.update({
          where: { id: sessionId },
          data: { unexpectedFileCount: { increment: 1 } }
        });

        // Audit Log
        await tx.auditLog.create({
          data: {
            companyId,
            userId: operatorId,
            boxId: session.boxId,
            action: WorkflowAction.INVENTORY_VERIFY,
            newState: { barcode: data.fileBarcode, error: 'FILE_NOT_FOUND', isExpected: false }
          }
        });

        return scan;
      });
    }

    // Tenant check
    if (file.companyId !== companyId) {
      const error: AppError = new Error('Access denied: File belongs to another company');
      error.statusCode = 403;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }

    const isExpected = file.boxId === session.boxId;

    return prisma.$transaction(async (tx) => {
      const scan = await tx.inventoryVerificationScan.create({
        data: {
          sessionId,
          boxId: session.boxId,
          fileRecordId: file.id,
          clientEventId: data.clientEventId,
          isExpected,
          scannedAt: data.scannedAt
        },
        include: { fileRecord: true }
      });

      // Update counters
      if (!isExpected) {
        await tx.inventoryVerificationSession.update({
          where: { id: sessionId },
          data: { unexpectedFileCount: { increment: 1 } }
        });
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          companyId,
          userId: operatorId,
          boxId: session.boxId,
          fileRecordId: file.id,
          action: WorkflowAction.INVENTORY_VERIFY,
          newState: { barcode: data.fileBarcode, isExpected }
        }
      });

      return scan;
    });
  }

  static async endSession(companyId: string, sessionId: string) {
    const session = await prisma.inventoryVerificationSession.findFirst({
      where: { id: sessionId, operator: { companyId } }
    });

    if (!session) {
      const error: AppError = new Error('Session not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    if (session.endedAt) {
      return session;
    }

    // Fetch all active files that should be in this box
    const expectedFiles = await prisma.fileRecord.findMany({
      where: { boxId: session.boxId, status: 'ACTIVE' }
    });

    // Fetch all files scanned during this session
    const scannedScans = await prisma.inventoryVerificationScan.findMany({
      where: { sessionId, isExpected: true, fileRecordId: { not: null } }
    });
    const scannedFileIds = new Set(scannedScans.map((s) => s.fileRecordId));

    // Find missing files (expected but not scanned)
    const missingFiles = expectedFiles.filter((f) => !scannedFileIds.has(f.id));

    return prisma.$transaction(async (tx) => {
      // Create missing flag scans
      for (const file of missingFiles) {
        const clientEventId = `IV-MISS-${session.id.substring(0, 8)}-${file.id.substring(0, 8)}`;
        
        // Double check uniqueness of the auto-generated clientEventId
        const existingScan = await tx.inventoryVerificationScan.findUnique({
          where: { clientEventId }
        });
        
        if (!existingScan) {
          await tx.inventoryVerificationScan.create({
            data: {
              sessionId,
              boxId: session.boxId,
              fileRecordId: file.id,
              clientEventId,
              isExpected: true,
              isMissingFlag: true,
              scannedAt: new Date()
            }
          });

          // Write missing audit log
          await tx.auditLog.create({
            data: {
              companyId,
              userId: session.operatorId,
              boxId: session.boxId,
              fileRecordId: file.id,
              action: WorkflowAction.INVENTORY_VERIFY,
              newState: { isMissingFlag: true }
            }
          });
        }
      }

      // Update session status and missing count
      return tx.inventoryVerificationSession.update({
        where: { id: sessionId },
        data: {
          endedAt: new Date(),
          missingFileCount: missingFiles.length
        },
        include: {
          scans: {
            include: { fileRecord: true }
          }
        }
      });
    });
  }

  static async getSessionDetails(companyId: string, sessionId: string) {
    const session = await prisma.inventoryVerificationSession.findFirst({
      where: { id: sessionId, operator: { companyId } },
      include: {
        box: true,
        scans: {
          include: { fileRecord: true },
          orderBy: { scannedAt: 'asc' }
        },
        operator: {
          select: { id: true, fullName: true, email: true }
        }
      }
    });

    if (!session) {
      const error: AppError = new Error('Session not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return session;
  }

  static async listSessions(companyId: string, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;
    const [sessions, total] = await Promise.all([
      prisma.inventoryVerificationSession.findMany({
        where: { operator: { companyId } },
        include: {
          box: {
            select: {
              id: true,
              barcode: true,
              description: true
            }
          },
          operator: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          },
          _count: {
            select: { scans: true }
          }
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.inventoryVerificationSession.count({
        where: { operator: { companyId } }
      })
    ]);

    return {
      data: sessions,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }
}
