import { prisma } from '../../lib/prisma';
import { WorkOrderType, WorkOrderPriority, WorkOrderStatus } from '@prisma/client';

export class WorkOrderService {
  static async list(companyId: string) {
    return prisma.workOrder.findMany({
      where: { companyId },
      include: {
        assignedUser: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async create(companyId: string, data: {
    type: WorkOrderType;
    priority?: WorkOrderPriority;
    assignedUserId?: string;
    startDate?: string;
    endDate?: string;
    remarks?: string;
    barcodes?: string[];
  }) {
    const orderNumber = `WO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    return prisma.workOrder.create({
      data: {
        companyId,
        orderNumber,
        type: data.type,
        priority: data.priority || 'MEDIUM',
        assignedUserId: data.assignedUserId || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        remarks: data.remarks || null,
        items: {
          create: (data.barcodes || []).map((code) => ({
            barcode: code,
            entityType: code.startsWith('BOX') ? 'BOX' : 'FILE_RECORD'
          }))
        }
      },
      include: { items: true }
    });
  }

  static async updateStatus(id: string, status: WorkOrderStatus) {
    return prisma.workOrder.update({
      where: { id },
      data: { status }
    });
  }

  static async delete(id: string) {
    return prisma.workOrder.delete({ where: { id } });
  }
}
