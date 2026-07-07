import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class WarehouseService {
  static async listWarehouses(companyId: string) {
    return prisma.warehouse.findMany({
      where: { companyId },
      include: {
        site: {
          include: {
            branch: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createWarehouse(
    companyId: string,
    siteId: string,
    name: string,
    code: string,
    latitude?: number,
    longitude?: number
  ) {
    // Multi-tenant check: verify site belongs to the tenant company (via branch relation)
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        branch: {
          companyId
        }
      }
    });

    if (!site) {
      const error: AppError = new Error('Site not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    // Check unique constraint: [siteId, code]
    const existing = await prisma.warehouse.findFirst({
      where: { siteId, code }
    });

    if (existing) {
      const error: AppError = new Error(`Warehouse with code '${code}' already exists under this Site`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.warehouse.create({
      data: {
        companyId,
        siteId,
        name,
        code,
        latitude,
        longitude
      }
    });
  }

  static async updateWarehouse(
    companyId: string,
    warehouseId: string,
    name?: string,
    latitude?: number,
    longitude?: number,
    isActive?: boolean
  ) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId }
    });

    if (!warehouse) {
      const error: AppError = new Error('Warehouse not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.WAREHOUSE_NOT_FOUND;
      throw error;
    }

    return prisma.warehouse.update({
      where: { id: warehouseId },
      data: {
        name: name !== undefined ? name : warehouse.name,
        latitude: latitude !== undefined ? latitude : warehouse.latitude,
        longitude: longitude !== undefined ? longitude : warehouse.longitude,
        isActive: isActive !== undefined ? isActive : warehouse.isActive
      }
    });
  }

  static async deleteWarehouse(companyId: string, warehouseId: string) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId }
    });

    if (!warehouse) {
      const error: AppError = new Error('Warehouse not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.WAREHOUSE_NOT_FOUND;
      throw error;
    }

    return prisma.warehouse.delete({
      where: { id: warehouseId }
    });
  }
}
