import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { FreshBoxMoveService } from '../workflow/fresh-box-move.service';
import { InventoryVerifyService } from '../workflow/inventory-verify.service';
import { RefileService } from '../workflow/refile.service';

export class SyncService {
  static async syncBatch(
    companyId: string,
    operatorId: string,
    deviceId: string | undefined,
    events: any[]
  ) {
    let syncedCount = 0;
    let conflictCount = 0;

    for (const event of events) {
      try {
        if (event.eventType === 'FRESH_BOX_MOVE') {
          await FreshBoxMoveService.submitScan(companyId, operatorId, event.sessionId, {
            locationBarcode: event.payload.locationBarcode,
            boxBarcode: event.payload.boxBarcode,
            clientEventId: event.clientEventId,
            gpsLat: event.payload.gpsLat,
            gpsLng: event.payload.gpsLng,
            scannedAt: event.scannedAt
          });
        } else if (event.eventType === 'INVENTORY_VERIFY') {
          await InventoryVerifyService.submitScan(companyId, operatorId, event.sessionId, {
            fileBarcode: event.payload.fileBarcode,
            clientEventId: event.clientEventId,
            scannedAt: event.scannedAt
          });
        } else if (event.eventType === 'REFILE') {
          await RefileService.submitRefileScan(companyId, operatorId, {
            fileBarcode: event.payload.fileBarcode,
            scannedBoxBarcode: event.payload.scannedBoxBarcode,
            scannedLocationBarcode: event.payload.scannedLocationBarcode,
            clientEventId: event.clientEventId,
            scannedAt: event.scannedAt
          });
        }
        syncedCount++;
      } catch (err: any) {
        // If it's a known conflict / business logic error, record it in SyncConflict table
        conflictCount++;
        
        let serverState: any = {};
        // Retrieve current server state for Box/FileRecord if barcodes are provided
        if (event.payload.boxBarcode) {
          const dbBox = await prisma.box.findUnique({ where: { barcode: event.payload.boxBarcode } });
          if (dbBox) serverState.box = dbBox;
        }
        if (event.payload.fileBarcode) {
          const dbFile = await prisma.fileRecord.findUnique({ where: { barcode: event.payload.fileBarcode } });
          if (dbFile) serverState.fileRecord = dbFile;
        }

        await prisma.syncConflict.create({
          data: {
            userId: operatorId,
            entityType: event.eventType,
            entityId: event.payload.boxBarcode || event.payload.fileBarcode || 'UNKNOWN',
            clientEventId: event.clientEventId,
            conflictReason: err.message || 'Sync Validation Failed',
            payloadA: event.payload,
            payloadB: serverState
          }
        });
      }
    }

    return {
      syncedCount,
      conflictCount
    };
  }

  static async listConflicts(companyId: string) {
    return prisma.syncConflict.findMany({
      where: {
        resolvedAt: null,
        user: { companyId }
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getSyncStatus(companyId: string, deviceId: string) {
    const conflictsCount = await prisma.syncConflict.count({
      where: {
        resolvedAt: null,
        user: { companyId, devices: { some: { id: deviceId } } }
      }
    });

    return {
      deviceId,
      pendingConflicts: conflictsCount
    };
  }

  static async resolveConflict(
    companyId: string,
    operatorId: string,
    conflictId: string,
    resolution: 'CLIENT_WIN' | 'SERVER_WIN'
  ) {
    const conflict = await prisma.syncConflict.findFirst({
      where: { id: conflictId, user: { companyId } }
    });

    if (!conflict) {
      const error: AppError = new Error('Conflict record not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    if (conflict.resolvedAt) {
      return conflict;
    }

    return prisma.$transaction(async (tx) => {
      if (resolution === 'CLIENT_WIN') {
        // If client wins, we force apply the location change or record update
        if (conflict.entityType === 'FRESH_BOX_MOVE') {
          const payload = conflict.payloadA as any;
          const box = await tx.box.findUnique({ where: { barcode: payload.boxBarcode } });
          const location = await tx.location.findUnique({ where: { barcode: payload.locationBarcode } });
          
          if (box && location) {
            const oldLocationId = box.currentLocationId;
            await tx.box.update({
              where: { id: box.id },
              data: { currentLocationId: location.id }
            });
            await tx.location.update({
              where: { id: location.id },
              data: { isOccupied: true }
            });
            if (oldLocationId) {
              await tx.location.update({
                where: { id: oldLocationId },
                data: { isOccupied: false }
              });
            }
          }
        } else if (conflict.entityType === 'REFILE') {
          const payload = conflict.payloadA as any;
          const file = await tx.fileRecord.findUnique({ where: { barcode: payload.fileBarcode } });
          if (file) {
            await tx.fileRecord.update({
              where: { id: file.id },
              data: { status: 'ACTIVE' }
            });
          }
        }
      }

      return tx.syncConflict.update({
        where: { id: conflictId },
        data: {
          resolvedAt: new Date(),
          resolvedById: operatorId
        }
      });
    });
  }
}
