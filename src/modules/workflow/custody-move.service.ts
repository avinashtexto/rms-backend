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
      boxBarcode: string;
      destinationLocation: string;
      reason?: string;
    }
  ) {
    const box = await prisma.box.findFirst({
      where: { barcode: data.boxBarcode, companyId },
      include: {
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
        }
      }
    });

    if (!box) {
      const error: AppError = new Error('Box not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    const sourceWarehouse = box.currentLocation?.shelf?.rack?.room?.warehouse;
    if (!sourceWarehouse) {
      const error: AppError = new Error('Source warehouse not found for box location');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    // Find destination warehouse by name
    const destinationWarehouse = await prisma.warehouse.findFirst({
      where: { name: data.destinationLocation, companyId }
    });

    if (!destinationWarehouse) {
      const error: AppError = new Error('Destination warehouse not found');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.$transaction(async (tx) => {
      // Create transfer record
      const transfer = await tx.transfer.create({
        data: {
          boxId: box.id,
          fromWarehouseId: sourceWarehouse.id,
          toWarehouseId: destinationWarehouse.id,
          initiatedById: operatorId,
          status: TransferStatus.PENDING_ACCEPTANCE
        },
        include: {
          box: true,
          fromWarehouse: true,
          toWarehouse: true,
          initiatedBy: true
        }
      });

      // Update box status to IN_TRANSIT
      await tx.box.update({
        where: { id: box.id },
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
          boxId: box.id,
          warehouseId: sourceWarehouse.id,
          action: WorkflowAction.TRANSFER_INITIATE,
          previousState: { status: box.status, locationId: box.currentLocationId },
          newState: { status: BoxStatus.IN_TRANSIT }
        }
      });

      return {
        id: transfer.id,
        transferCode: `TRF-${transfer.id.substring(0, 8).toUpperCase()}`,
        boxBarcode: transfer.box.barcode,
        boxName: transfer.box.description,
        sourceLocation: transfer.fromWarehouse.name,
        destinationLocation: transfer.toWarehouse.name,
        status: transfer.status,
        reason: data.reason || null,
        assignedTo: transfer.initiatedBy.fullName,
        startedAt: transfer.initiatedAt.toISOString(),
        completedAt: transfer.resolvedAt?.toISOString(),
        createdAt: transfer.initiatedAt.toISOString()
      };
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

  static async getAssignedTransfers(companyId: string, operatorId: string) {
    const transfers = await prisma.transfer.findMany({
      where: {
        OR: [
          { initiatedById: operatorId },
          { acceptedById: operatorId }
        ],
        fromWarehouse: { companyId }
      },
      include: {
        box: {
          include: {
            currentLocation: true
          }
        },
        fromWarehouse: true,
        toWarehouse: true,
        initiatedBy: true,
        acceptedBy: true
      },
      orderBy: {
        initiatedAt: 'desc'
      }
    });

    return transfers.map(transfer => ({
      id: transfer.id,
      transferCode: `TRF-${transfer.id.substring(0, 8).toUpperCase()}`,
      boxBarcode: transfer.box.barcode,
      boxName: transfer.box.description,
      sourceLocation: transfer.fromWarehouse.name,
      destinationLocation: transfer.toWarehouse.name,
      status: transfer.status,
      reason: null,
      assignedTo: transfer.initiatedBy.fullName,
      startedAt: transfer.initiatedAt.toISOString(),
      completedAt: transfer.resolvedAt?.toISOString(),
      createdAt: transfer.initiatedAt.toISOString()
    }));
  }

  static async completeTransfer(companyId: string, operatorId: string, transferId: string) {
    const transfer = await prisma.transfer.findFirst({
      where: {
        id: transferId,
        fromWarehouse: { companyId }
      },
      include: {
        box: true,
        fromWarehouse: true,
        toWarehouse: true,
        initiatedBy: true
      }
    });

    if (!transfer) {
      const error: AppError = new Error('Transfer request not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    if (transfer.status !== TransferStatus.ACCEPTED) {
      const error: AppError = new Error('Transfer must be accepted before completion');
      error.statusCode = 400;
      error.code = ErrorCode.VALIDATION_ERROR;
      throw error;
    }

    return prisma.$transaction(async (tx) => {
      const updatedTransfer = await tx.transfer.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.COMPLETED,
          resolvedAt: new Date()
        },
        include: {
          box: true,
          fromWarehouse: true,
          toWarehouse: true,
          initiatedBy: true
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
          previousState: { status: TransferStatus.ACCEPTED },
          newState: { status: TransferStatus.COMPLETED }
        }
      });

      return {
        id: updatedTransfer.id,
        transferCode: `TRF-${updatedTransfer.id.substring(0, 8).toUpperCase()}`,
        boxBarcode: updatedTransfer.box.barcode,
        boxName: updatedTransfer.box.description,
        sourceLocation: updatedTransfer.fromWarehouse.name,
        destinationLocation: updatedTransfer.toWarehouse.name,
        status: updatedTransfer.status,
        reason: null,
        assignedTo: updatedTransfer.initiatedBy.fullName,
        startedAt: updatedTransfer.initiatedAt.toISOString(),
        completedAt: updatedTransfer.resolvedAt?.toISOString(),
        createdAt: updatedTransfer.initiatedAt.toISOString()
      };
    });
  }

  static async scanBox(companyId: string, barcode: string) {
    const box = await prisma.box.findFirst({
      where: {
        barcode,
        companyId
      },
      include: {
        currentLocation: true
      }
    });

    if (!box) {
      return null;
    }

    // Return a mock transfer object for the scanned box
    return {
      id: '',
      transferCode: '',
      boxBarcode: box.barcode,
      boxName: box.description,
      sourceLocation: box.currentLocation?.name || 'Unknown',
      destinationLocation: '',
      status: TransferStatus.PENDING_ACCEPTANCE,
      reason: null,
      assignedTo: '',
      startedAt: null,
      completedAt: null,
      createdAt: box.createdAt.toISOString()
    };
  }

  static async listTransfers(companyId: string, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;
    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where: { box: { companyId } },
        include: {
          box: {
            select: {
              id: true,
              barcode: true,
              description: true
            }
          },
          fromWarehouse: {
            select: {
              id: true,
              name: true
            }
          },
          toWarehouse: {
            select: {
              id: true,
              name: true
            }
          },
          initiatedBy: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        },
        orderBy: { initiatedAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.transfer.count({
        where: { box: { companyId } }
      })
    ]);

    return {
      data: transfers,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }
}
