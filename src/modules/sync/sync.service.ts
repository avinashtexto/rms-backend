import { WorkflowAction } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { ScanService } from '../scan/scan.service';
import { FreshBoxMoveService } from '../workflow/fresh-box-move.service';
import { InventoryVerifyService } from '../workflow/inventory-verify.service';
import { RefileService } from '../workflow/refile.service';
import { CustodyMoveService } from '../workflow/custody-move.service';
import {
  SyncOperationInput,
  SyncOperationResult,
  SyncUser
} from './sync.types';

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`payload.${field} is required`);
  }
  return value;
}

function asStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`payload.${field} must be an array of strings`);
  }
  return value;
}

function withOfflineSource(payload: Record<string, unknown>): Record<string, unknown> {
  return { ...payload, source: 'OFFLINE_SYNC' };
}

function getClientOpId(payload: Record<string, unknown>): string {
  return asString(payload.clientOpId, 'clientOpId');
}

function toRejected(clientOpId: string, err: unknown): SyncOperationResult {
  const message = err instanceof Error ? err.message : 'Unknown error';
  return { clientOpId, status: 'rejected', error: message };
}

async function findAuditByClientOpId(
  companyId: string,
  userId: string,
  action: WorkflowAction,
  clientOpId: string
) {
  const recent = await prisma.auditLog.findMany({
    where: {
      companyId,
      userId,
      action
    },
    orderBy: { createdAt: 'desc' },
    take: 200
  });

  return recent.find((entry) => {
    const state = entry.newState;
    return (
      state &&
      typeof state === 'object' &&
      'clientOpId' in state &&
      (state as { clientOpId?: string }).clientOpId === clientOpId
    );
  });
}

export class SyncService {
  static async processOperations(
    user: SyncUser,
    operations: SyncOperationInput[]
  ): Promise<SyncOperationResult[]> {
    const results: SyncOperationResult[] = [];

    for (const operation of operations) {
      const payload = withOfflineSource(operation.payload);
      let clientOpId: string;

      try {
        clientOpId = getClientOpId(payload);
      } catch (err) {
        results.push({
          clientOpId: 'unknown',
          status: 'rejected',
          error: err instanceof Error ? err.message : 'clientOpId is required'
        });
        continue;
      }

      try {
        const result = await SyncService.dispatchOperation(user, operation.type, payload);
        results.push(result);
      } catch (err) {
        results.push(toRejected(clientOpId, err));
      }
    }

    return results;
  }

  private static async dispatchOperation(
    user: SyncUser,
    type: SyncOperationInput['type'],
    payload: Record<string, unknown>
  ): Promise<SyncOperationResult> {
    const clientOpId = getClientOpId(payload);

    switch (type) {
      case 'FRESH_BOX':
        return SyncService.processFreshBox(user, payload);
      case 'INVENTORY':
        return SyncService.processInventory(user, payload);
      case 'REFILE':
        return SyncService.processRefile(user, payload);
      case 'SEGREGATION':
        return SyncService.processSegregation(user, payload);
      case 'LOOKUP':
        return SyncService.processLookup(user, payload);
      case 'INTAKE':
        throw new Error('INTAKE workflow is not available on this server build');
      default:
        throw new Error(`Unsupported operation type: ${type as string}`);
    }
  }

  private static async processFreshBox(
    user: SyncUser,
    payload: Record<string, unknown>
  ): Promise<SyncOperationResult> {
    const clientOpId = getClientOpId(payload);

    const existing = await findAuditByClientOpId(
      user.companyId,
      user.id,
      WorkflowAction.FRESH_BOX_MOVE,
      clientOpId
    );
    if (existing) {
      return { clientOpId, status: 'duplicate', operationId: existing.id };
    }

    const result = await FreshBoxMoveService.submitWorkflow(user.companyId, user.id, {
      clientOpId,
      performedAt: typeof payload.performedAt === 'string' ? payload.performedAt : undefined,
      latitude: typeof payload.latitude === 'number' ? payload.latitude : undefined,
      longitude: typeof payload.longitude === 'number' ? payload.longitude : undefined,
      locationBarcode: asString(payload.locationBarcode, 'locationBarcode'),
      boxBarcodes: asStringArray(payload.boxBarcodes, 'boxBarcodes')
    });

    return { clientOpId, status: 'ok', operationId: result.operationId };
  }

  private static async processInventory(
    user: SyncUser,
    payload: Record<string, unknown>
  ): Promise<SyncOperationResult> {
    const clientOpId = getClientOpId(payload);
    const boxBarcode = asString(payload.boxBarcode, 'boxBarcode');
    const fileBarcodes = asStringArray(payload.fileBarcodes, 'fileBarcodes');
    const performedAt =
      typeof payload.performedAt === 'string' ? new Date(payload.performedAt) : new Date();

    const existingMarker = await prisma.inventoryVerificationScan.findUnique({
      where: { clientEventId: clientOpId }
    });
    if (existingMarker) {
      return {
        clientOpId,
        status: 'duplicate',
        operationId: existingMarker.sessionId
      };
    }

    const box = await prisma.box.findFirst({
      where: { barcode: boxBarcode, companyId: user.companyId, status: 'ACTIVE' }
    });
    if (!box) {
      throw new Error(`Box barcode '${boxBarcode}' not found`);
    }

    const session = await InventoryVerifyService.startSession(user.companyId, user.id, box.id);

    for (let index = 0; index < fileBarcodes.length; index++) {
      await InventoryVerifyService.submitScan(user.companyId, user.id, session.id, {
        fileBarcode: fileBarcodes[index],
        clientEventId: index === 0 ? clientOpId : `${clientOpId}-${index}`,
        scannedAt: performedAt
      });
    }

    const ended = await InventoryVerifyService.endSession(user.companyId, session.id);

    return { clientOpId, status: 'ok', operationId: ended.id };
  }

  private static async processRefile(
    user: SyncUser,
    payload: Record<string, unknown>
  ): Promise<SyncOperationResult> {
    const clientOpId = getClientOpId(payload);

    const existing = await prisma.refileEvent.findUnique({
      where: { clientEventId: clientOpId }
    });
    if (existing) {
      return { clientOpId, status: 'duplicate', operationId: existing.id };
    }

    const scannedAt =
      typeof payload.performedAt === 'string' ? new Date(payload.performedAt) : new Date();

    const result = await RefileService.submitRefileScan(user.companyId, user.id, {
      fileBarcode: asString(payload.fileBarcode, 'fileBarcode'),
      scannedBoxBarcode: asString(payload.boxBarcode, 'boxBarcode'),
      scannedLocationBarcode: asString(payload.locationBarcode, 'locationBarcode'),
      clientEventId: clientOpId,
      scannedAt
    });

    return { clientOpId, status: 'ok', operationId: result.id };
  }

  private static async processSegregation(
    user: SyncUser,
    payload: Record<string, unknown>
  ): Promise<SyncOperationResult> {
    const clientOpId = getClientOpId(payload);
    const oldBoxBarcode = asString(payload.oldBoxBarcode, 'oldBoxBarcode');
    const newBoxBarcode = asString(payload.newBoxBarcode, 'newBoxBarcode');
    const fileBarcodes = asStringArray(payload.fileBarcodes, 'fileBarcodes');

    const existing = await findAuditByClientOpId(
      user.companyId,
      user.id,
      WorkflowAction.SEGREGATION,
      clientOpId
    );
    if (existing) {
      return { clientOpId, status: 'duplicate', operationId: existing.id };
    }

    const [oldBox, newBox] = await Promise.all([
      prisma.box.findFirst({
        where: { barcode: oldBoxBarcode, companyId: user.companyId, status: 'ACTIVE' }
      }),
      prisma.box.findFirst({
        where: { barcode: newBoxBarcode, companyId: user.companyId, status: 'ACTIVE' }
      })
    ]);

    if (!oldBox || !newBox) {
      throw new Error('One or both segregation boxes were not found');
    }

    if (oldBox.id === newBox.id) {
      throw new Error('Source and destination boxes must be different');
    }

    const files = await prisma.fileRecord.findMany({
      where: {
        companyId: user.companyId,
        boxId: oldBox.id,
        barcode: { in: fileBarcodes },
        status: 'ACTIVE'
      }
    });

    if (files.length !== fileBarcodes.length) {
      throw new Error('Some segregation files do not belong to the source box');
    }

    const session = await CustodyMoveService.segregateBox(user.companyId, user.id, {
      oldBoxId: oldBox.id,
      newBoxId: newBox.id,
      fileRecordIds: files.map((file) => file.id)
    });

    await prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        boxId: newBox.id,
        action: WorkflowAction.SEGREGATION,
        newState: {
          clientOpId,
          source: 'OFFLINE_SYNC',
          oldBoxBarcode,
          newBoxBarcode,
          fileBarcodes,
          sessionId: session.id
        }
      }
    });

    return { clientOpId, status: 'ok', operationId: session.id };
  }

  private static async processLookup(
    user: SyncUser,
    payload: Record<string, unknown>
  ): Promise<SyncOperationResult> {
    const clientOpId = getClientOpId(payload);
    const result = await ScanService.submitScan(user.companyId, user.id, {
      clientOpId,
      barcode: asString(payload.barcode, 'barcode'),
      latitude: typeof payload.latitude === 'number' ? payload.latitude : undefined,
      longitude: typeof payload.longitude === 'number' ? payload.longitude : undefined,
      scannedAt: typeof payload.performedAt === 'string' ? payload.performedAt : undefined
    });

    return { clientOpId, status: 'ok', operationId: result.id };
  }

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
        conflictCount++;

        let serverState: any = {};
        if (event.payload.boxBarcode) {
          const dbBox = await prisma.box.findUnique({ where: { barcode: event.payload.boxBarcode } });
          if (dbBox) serverState.box = dbBox;
        }
        if (event.payload.fileBarcode) {
          const dbFile = await prisma.fileRecord.findUnique({
            where: { barcode: event.payload.fileBarcode }
          });
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
        if (conflict.entityType === 'FRESH_BOX_MOVE') {
          const payload = conflict.payloadA as any;
          const box = await tx.box.findUnique({ where: { barcode: payload.boxBarcode } });
          const location = await tx.location.findUnique({
            where: { barcode: payload.locationBarcode }
          });

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
