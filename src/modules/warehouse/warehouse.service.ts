import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class WarehouseService {
  static async listWarehouses(companyId: string, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;
    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        where: { companyId },
        include: {
          site: {
            include: {
              branch: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.warehouse.count({ where: { companyId } })
    ]);

    return {
      data: warehouses,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  static async getWarehouseById(companyId: string, warehouseId: string) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId },
      include: {
        site: {
          include: {
            branch: true
          }
        }
      }
    });

    if (!warehouse) {
      const error: AppError = new Error('Warehouse not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.WAREHOUSE_NOT_FOUND;
      throw error;
    }

    return warehouse;
  }

  static async createWarehouse(
    companyId: string,
    siteId: string,
    name: string,
    code: string,
    address?: string,
    city?: string,
    state?: string,
    country?: string,
    zipCode?: number,
    phone?: string,
    isActive?: boolean
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

    const data: any = {
      companyId,
      siteId,
      name,
      code,
      isActive: isActive !== undefined ? isActive : true
    };

    if (address !== undefined) data.address = address;
    if (city !== undefined) data.city = city;
    if (state !== undefined) data.state = state;
    if (country !== undefined) data.country = country;
    if (zipCode !== undefined) data.zipCode = zipCode;
    if (phone !== undefined) data.phone = phone;

    return prisma.warehouse.create({
      data
    });
  }

  static async updateWarehouse(
    companyId: string,
    warehouseId: string,
    siteId?: string,
    name?: string,
    code?: string,
    address?: string,
    city?: string,
    state?: string,
    country?: string,
    zipCode?: number,
    phone?: string,
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

    const data: any = {
      name: name !== undefined ? name : warehouse.name,
      code: code !== undefined ? code : warehouse.code,
      address: address !== undefined ? address : warehouse.address,
      city: city !== undefined ? city : warehouse.city,
      state: state !== undefined ? state : warehouse.state,
      country: country !== undefined ? country : warehouse.country,
      zipCode: zipCode !== undefined ? zipCode : warehouse.zipCode,
      phone: phone !== undefined ? phone : warehouse.phone,
      isActive: isActive !== undefined ? isActive : warehouse.isActive
    };

    if (siteId !== undefined && siteId !== warehouse.siteId) {
      if (siteId) {
        // Validate site belongs to the company (via branch)
        const site = await prisma.site.findFirst({
          where: {
            id: siteId,
            branch: { companyId }
          }
        });

        if (!site) {
          const error: AppError = new Error('Site not found or access denied');
          error.statusCode = 404;
          error.code = ErrorCode.NOT_FOUND;
          throw error;
        }

        // Check unique constraint [siteId, code]
        const existing = await prisma.warehouse.findFirst({
          where: {
            siteId,
            code: warehouse.code,
            id: { not: warehouseId }
          }
        });

        if (existing) {
          const error: AppError = new Error(`Warehouse with code '${warehouse.code}' already exists under the new Site`);
          error.statusCode = 400;
          error.code = ErrorCode.DUPLICATE_CODE;
          throw error;
        }

        data.siteId = siteId;
      } else {
        // If siteId is set to null/empty
        // Check uniqueness by companyId and code
        const existing = await prisma.warehouse.findFirst({
          where: {
            companyId,
            code: warehouse.code,
            siteId: null,
            id: { not: warehouseId }
          }
        });

        if (existing) {
          const error: AppError = new Error(`Warehouse with code '${warehouse.code}' already exists`);
          error.statusCode = 400;
          error.code = ErrorCode.DUPLICATE_CODE;
          throw error;
        }

        data.siteId = null;
      }
    }

    return prisma.warehouse.update({
      where: { id: warehouseId },
      data
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
