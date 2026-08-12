import { prisma } from '../../lib/prisma';
import { InventoryMovementAction } from '@prisma/client';

export class InventoryMovementService {
  static async listHistory(companyId: string) {
    return prisma.inventoryMovementHistory.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  static async recordMovement(companyId: string, userId: string, data: {
    barcode: string;
    action: InventoryMovementAction;
    issuedTo?: string;
    approvedBy?: string;
    reason?: string;
    remarks?: string;
    documentUrl?: string;
  }) {
    const { barcode, action, issuedTo, approvedBy, reason, remarks, documentUrl } = data;
    const entityType = barcode.startsWith('BOX') ? 'BOX' : 'FILE_RECORD';

    // Transaction to update entity status & record immutable movement history
    const result = await prisma.$transaction(async (tx) => {
      // Create History Log
      const history = await tx.inventoryMovementHistory.create({
        data: {
          companyId,
          barcode,
          entityType,
          action,
          issuedTo,
          approvedBy,
          reason,
          remarks,
          documentUrl,
          performedById: userId
        }
      });

      // Update Box / FileRecord / Barcode Master status
      if (entityType === 'BOX') {
        const newBoxStatus = action === 'DESTROY' ? 'DESTROYED' : action === 'TEMP_OUT' ? 'IN_TRANSIT' : 'ACTIVE';
        await tx.box.updateMany({
          where: { companyId, barcode },
          data: { status: newBoxStatus as any }
        });
      } else {
        const newFileStatus = action === 'DESTROY' ? 'DESTROYED' : action === 'PERM_OUT' ? 'ARCHIVED' : 'ACTIVE';
        await tx.fileRecord.updateMany({
          where: { companyId, barcode },
          data: { status: newFileStatus as any }
        });
      }

      // Update BarcodeMaster repository status
      const barcodeStatus = action === 'DESTROY' ? 'DESTROYED' : action === 'TEMP_OUT' || action === 'PERM_OUT' ? 'INACTIVE' : 'ACTIVE';
      await tx.barcodeMaster.updateMany({
        where: { companyId, barcode },
        data: { status: barcodeStatus as any }
      });

      return history;
    });

    return result;
  }
}
