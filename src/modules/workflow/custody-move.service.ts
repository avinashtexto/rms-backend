import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { BoxStatus, TransferStatus, WorkflowAction } from '@prisma/client';

export class CustodyMoveService {
  static async segregateBox(
    companyId: string,
    operatorId: string,
    data: {
      oldBoxId: string;
      newBoxId: string;
      fileRecordIds: string[];
    }
  ) {
    // 1. Verify boxes belong to company
    const [oldBox, newBox] = await Promise.all([
      prisma.box.findFirst({ where: { id: data.oldBoxId, companyId } }),
      prisma.box.findFirst({ where: { id: data.newBoxId, companyId } })
    ]);

    if (!oldBox || !newBox) {
      const error: AppError = new Error('One or both boxes not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    // 2. Verify files belong to old box
    const files = await prisma.fileRecord.findMany({
      where: {
        id: { in: data.fileRecordIds },
        boxId: data.oldBoxId,
        companyId
      }
    });

    if (files.length !== data.fileRecordIds.length) {
      const error: AppError = new Error('Some files do not belong to the source box');
      error.statusCode = 400;
      error.code = ErrorCode.VALIDATION_ERROR;
      throw error;
    }

    return prisma.$transaction(async (tx) => {
      // Create segregation session
      const session = await tx.segregationSession.create({
        data: {
          operatorId,
          oldBoxId: data.oldBoxId,
          newBoxId: data.newBoxId
        }
      });

      // Move each file and create audit + move records
      for (const file of files) {
        const clientEventId = `SEG-MOVE-${session.id.substring(0, 8)}-${file.id.substring(0, 8)}`;
        
        await tx.fileRecord.update({
          where: { id: file.id },
          data: { boxId: data.newBoxId }
        });

        await tx.segregationFileMove.create({
          data: {
            sessionId: session.id,
            fileRecordId: file.id,
            clientEventId
          }
        });

        await tx.auditLog.create({
          data: {
            companyId,
            userId: operatorId,
            boxId: data.newBoxId,
            fileRecordId: file.id,
            action: WorkflowAction.SEGREGATION,
            previousState: { boxId: data.oldBoxId },
            newState: { boxId: data.newBoxId }
          }
        });
      }

      return session;
    });
  }

  static async mergeBoxes(companyId: string, operatorId: string, fromBoxId: string, toBoxId: string) {
    const [fromBox, toBox] = await Promise.all([
      prisma.box.findFirst({ where: { id: fromBoxId, companyId }, include: { fileRecords: true } }),
      prisma.box.findFirst({ where: { id: toBoxId, companyId } })
    ]);

    if (!fromBox || !toBox) {
      const error: AppError = new Error('One or both boxes not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    if (fromBox.status === BoxStatus.MERGED) {
      const error: AppError = new Error('Source box is already merged');
      error.statusCode = 400;
      error.code = ErrorCode.VALIDATION_ERROR;
      throw error;
    }

    const fileCount = fromBox.fileRecords.length;

    return prisma.$transaction(async (tx) => {
      // Move all files to target box
      await tx.fileRecord.updateMany({
        where: { boxId: fromBoxId },
        data: { boxId: toBoxId }
      });

      // Update source box status to MERGED
      await tx.box.update({
        where: { id: fromBoxId },
        data: {
          status: BoxStatus.MERGED,
          mergedIntoBoxId: toBoxId,
          currentLocationId: null // clear location since it's merged
        }
      });

      // If the source box was in a location, set location occupancy to false
      if (fromBox.currentLocationId) {
        await tx.location.update({
          where: { id: fromBox.currentLocationId },
          data: { isOccupied: false }
        });
      }

      const session = await tx.mergeSession.create({
        data: {
          operatorId,
          fromBoxId,
          toBoxId,
          fileCountMoved: fileCount
        }
      });

      // Audit log for merge
      await tx.auditLog.create({
        data: {
          companyId,
          userId: operatorId,
          boxId: fromBoxId,
          action: WorkflowAction.MERGE,
          previousState: { status: fromBox.status, locationId: fromBox.currentLocationId },
          newState: { status: BoxStatus.MERGED, mergedIntoBoxId: toBoxId }
        }
      });

      return session;
    });
  }

  static async initiateTransfer(
    companyId: string,
    operatorId: string,
    data: {
      boxId: string;
      fromWarehouseId: string;
      toWarehouseId: string;
    }
  ) {
    const box = await prisma.box.findFirst({
      where: { id: data.boxId, companyId }
    });

    if (!box) {
      const error: AppError = new Error('Box not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    const [fromWh, toWh] = await Promise.all([
      prisma.warehouse.findFirst({ where: { id: data.fromWarehouseId, companyId } }),
      prisma.warehouse.findFirst({ where: { id: data.toWarehouseId, companyId } })
    ]);

    if (!fromWh || !toWh) {
      const error: AppError = new Error('One or both warehouses not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.$transaction(async (tx) => {
      // Create transfer record
      const transfer = await tx.transfer.create({
        data: {
          boxId: data.boxId,
          fromWarehouseId: data.fromWarehouseId,
          toWarehouseId: data.toWarehouseId,
          initiatedById: operatorId,
          status: TransferStatus.PENDING_ACCEPTANCE
        }
      });

      // Update box status to IN_TRANSIT
      await tx.box.update({
        where: { id: data.boxId },
        data: {
          status: BoxStatus.IN_TRANSIT,
          currentLocationId: null // clear location during transit
        }
      });

      // If box was in a location, set location occupancy to false
      if (box.currentLocationId) {
        await tx.location.update({
          where: { id: box.currentLocationId },
          data: { isOccupied: false }
        });
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          companyId,
          userId: operatorId,
          boxId: data.boxId,
          warehouseId: data.fromWarehouseId,
          action: WorkflowAction.TRANSFER_INITIATE,
          previousState: { status: box.status, locationId: box.currentLocationId },
          newState: { status: BoxStatus.IN_TRANSIT }
        }
      });

      return transfer;
    });
  }

  static async acceptTransfer(companyId: string, operatorId: string, transferId: string) {
    const transfer = await prisma.transfer.findFirst({
      where: {
        id: transferId,
        fromWarehouse: { companyId }
      },
      include: { box: true }
    });

    if (!transfer) {
      const error: AppError = new Error('Transfer request not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    if (transfer.status !== TransferStatus.PENDING_ACCEPTANCE) {
      const error: AppError = new Error('Transfer is already completed or rejected');
      error.statusCode = 400;
      error.code = ErrorCode.VALIDATION_ERROR;
      throw error;
    }

    return prisma.$transaction(async (tx) => {
      // Update transfer status
      const updatedTransfer = await tx.transfer.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.ACCEPTED,
          acceptedById: operatorId,
          resolvedAt: new Date()
        }
      });

      // Re-activate Box under new Warehouse context
      await tx.box.update({
        where: { id: transfer.boxId },
        data: {
          status: BoxStatus.ACTIVE
        }
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          companyId,
          userId: operatorId,
          boxId: transfer.boxId,
          warehouseId: transfer.toWarehouseId,
          action: WorkflowAction.TRANSFER_ACCEPT,
          previousState: { status: BoxStatus.IN_TRANSIT },
          newState: { status: BoxStatus.ACTIVE }
        }
      });

      return updatedTransfer;
    });
  }
}
