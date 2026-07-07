import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { WorkflowAction } from '@prisma/client';

export class RefileService {
  static async submitRefileScan(
    companyId: string,
    operatorId: string,
    data: {
      fileBarcode: string;
      scannedBoxBarcode: string;
      scannedLocationBarcode: string;
      clientEventId: string;
      scannedAt: Date;
    }
  ) {
    // 1. Idempotency Check
    const existing = await prisma.refileEvent.findUnique({
      where: { clientEventId: data.clientEventId },
      include: { fileRecord: true, scannedLocation: true }
    });
    if (existing) {
      return existing;
    }

    // 2. Resolve File
    const file = await prisma.fileRecord.findUnique({
      where: { barcode: data.fileBarcode },
      include: { box: true }
    });
    if (!file) {
      const error: AppError = new Error(`File with barcode '${data.fileBarcode}' not found`);
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }
    if (file.companyId !== companyId) {
      const error: AppError = new Error('Access denied: File belongs to another company');
      error.statusCode = 403;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }

    // 3. Resolve Scanned Box
    const scannedBox = await prisma.box.findUnique({
      where: { barcode: data.scannedBoxBarcode }
    });
    if (!scannedBox) {
      const error: AppError = new Error(`Box with barcode '${data.scannedBoxBarcode}' not found`);
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }
    if (scannedBox.companyId !== companyId) {
      const error: AppError = new Error('Access denied: Scanned Box belongs to another company');
      error.statusCode = 403;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }

    // 4. Resolve Scanned Location
    const scannedLocation = await prisma.location.findUnique({
      where: { barcode: data.scannedLocationBarcode }
    });
    if (!scannedLocation) {
      const error: AppError = new Error(`Location with barcode '${data.scannedLocationBarcode}' not found`);
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    // 5. Evaluate Refile match logic
    let action: WorkflowAction = WorkflowAction.REFILE_SUCCESS;
    
    // Check Box match
    if (file.boxId !== scannedBox.id) {
      action = WorkflowAction.REFILE_REJECT_WRONG_BOX;
    } else if (scannedBox.currentLocationId !== scannedLocation.id) {
      // Check Location match
      action = WorkflowAction.REFILE_REJECT_WRONG_LOCATION;
    }

    // 6. Execute state update and logging inside transaction
    return prisma.$transaction(async (tx) => {
      // If success, update file record status to ACTIVE
      if (action === WorkflowAction.REFILE_SUCCESS) {
        await tx.fileRecord.update({
          where: { id: file.id },
          data: { status: 'ACTIVE' }
        });
      }

      // Create refile event log
      const event = await tx.refileEvent.create({
        data: {
          operatorId,
          fileRecordId: file.id,
          expectedBoxId: file.boxId,
          expectedLocationId: file.box.currentLocationId || '',
          scannedLocationId: scannedLocation.id,
          scannedBoxId: scannedBox.id,
          action,
          clientEventId: data.clientEventId,
          scannedAt: data.scannedAt
        },
        include: {
          fileRecord: true,
          scannedLocation: true
        }
      });

      // Create Audit Log entry
      await tx.auditLog.create({
        data: {
          companyId,
          userId: operatorId,
          boxId: scannedBox.id,
          fileRecordId: file.id,
          locationId: scannedLocation.id,
          action,
          newState: {
            fileBarcode: data.fileBarcode,
            scannedBoxBarcode: data.scannedBoxBarcode,
            scannedLocationBarcode: data.scannedLocationBarcode,
            status: action
          }
        }
      });

      return event;
    });
  }
}
