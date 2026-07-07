import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { WorkflowAction } from '@prisma/client';

export class FreshBoxMoveService {
  static async startSession(operatorId: string, deviceId?: string | null) {
    return prisma.freshBoxMoveSession.create({
      data: {
        operatorId,
        deviceId
      }
    });
  }

  static async submitScan(
    companyId: string,
    operatorId: string,
    sessionId: string,
    data: {
      locationBarcode: string;
      boxBarcode: string;
      clientEventId: string;
      gpsLat?: number | null;
      gpsLng?: number | null;
      scannedAt: Date;
    }
  ) {
    // 1. Verify session exists and is active
    const session = await prisma.freshBoxMoveSession.findUnique({
      where: { id: sessionId },
      include: { operator: true }
    });

    if (!session) {
      const error: AppError = new Error('Session not found');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    if (session.endedAt) {
      const error: AppError = new Error('Session is already ended');
      error.statusCode = 400;
      error.code = ErrorCode.VALIDATION_ERROR;
      throw error;
    }

    // 2. Idempotency Check
    const existingScan = await prisma.freshBoxMoveScan.findUnique({
      where: { clientEventId: data.clientEventId },
      include: { box: true, location: true }
    });
    if (existingScan) {
      return existingScan;
    }

    // 3. Resolve Location and verify tenant ownership
    const location = await prisma.location.findUnique({
      where: { barcode: data.locationBarcode },
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
    });

    if (!location) {
      const error: AppError = new Error(`Location with barcode '${data.locationBarcode}' not found`);
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    if (location.shelf.rack.room.warehouse.companyId !== companyId) {
      const error: AppError = new Error('Access denied: Location belongs to another company');
      error.statusCode = 403;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }

    // 4. Resolve Box and verify tenant ownership
    const box = await prisma.box.findUnique({
      where: { barcode: data.boxBarcode }
    });

    if (!box) {
      const error: AppError = new Error(`Box with barcode '${data.boxBarcode}' not found`);
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    if (box.companyId !== companyId) {
      const error: AppError = new Error('Access denied: Box belongs to another company');
      error.statusCode = 403;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }

    const previousLocationId = box.currentLocationId;

    // 5. Execute state changes inside a transaction
    return prisma.$transaction(async (tx) => {
      // Update Box current location
      const updatedBox = await tx.box.update({
        where: { id: box.id },
        data: { currentLocationId: location.id }
      });

      // Mark new location as occupied
      await tx.location.update({
        where: { id: location.id },
        data: { isOccupied: true }
      });

      // Mark old location as unoccupied (if changed and not null)
      if (previousLocationId && previousLocationId !== location.id) {
        await tx.location.update({
          where: { id: previousLocationId },
          data: { isOccupied: false }
        });
      }

      // Create scan log
      const scan = await tx.freshBoxMoveScan.create({
        data: {
          sessionId,
          locationId: location.id,
          boxId: box.id,
          clientEventId: data.clientEventId,
          gpsLat: data.gpsLat,
          gpsLng: data.gpsLng,
          scannedAt: data.scannedAt
        },
        include: {
          location: true,
          box: true
        }
      });

      // Create immutable Audit Log entry
      await tx.auditLog.create({
        data: {
          companyId,
          userId: operatorId,
          deviceId: session.deviceId,
          warehouseId: location.shelf.rack.room.warehouse.id,
          locationId: location.id,
          boxId: box.id,
          action: WorkflowAction.FRESH_BOX_MOVE,
          previousState: { currentLocationId: previousLocationId },
          newState: { currentLocationId: location.id },
          gpsLat: data.gpsLat,
          gpsLng: data.gpsLng
        }
      });

      return scan;
    });
  }

  static async endSession(companyId: string, sessionId: string) {
    const session = await prisma.freshBoxMoveSession.findFirst({
      where: { id: sessionId, operator: { companyId } }
    });

    if (!session) {
      const error: AppError = new Error('Session not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.freshBoxMoveSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() }
    });
  }

  static async getSessionDetails(companyId: string, sessionId: string) {
    const session = await prisma.freshBoxMoveSession.findFirst({
      where: { id: sessionId, operator: { companyId } },
      include: {
        scans: {
          include: {
            box: {
              select: {
                id: true,
                barcode: true,
                description: true,
                client: { select: { id: true, name: true, code: true } }
              }
            },
            location: {
              select: {
                id: true,
                barcode: true,
                name: true
              }
            }
          },
          orderBy: { scannedAt: 'asc' }
        },
        operator: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
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
}
