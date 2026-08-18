import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { CreateVendorInput, ListVendorsQueryInput, UpdateVendorInput } from './vendor.validation';

export class VendorService {
  static async list(user: { id: string; companyId?: string; role?: { name: string } }, query: ListVendorsQueryInput) {
    const isSuperAdmin = user.role?.name === 'SUPER_ADMIN';
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (isSuperAdmin) {
      if (query.companyId) {
        where.companyId = query.companyId;
      }
    } else {
      if (!user.companyId) {
        const error: AppError = new Error('Company context is required');
        error.statusCode = 403;
        error.code = ErrorCode.FORBIDDEN;
        throw error;
      }
      where.companyId = user.companyId;
    }

    if (query.status === 'ACTIVE') {
      where.isActive = true;
    } else if (query.status === 'INACTIVE') {
      where.isActive = false;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { code: { contains: term, mode: 'insensitive' } },
        { contactEmail: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } }
      ];
    }

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.vendor.count({ where })
    ]);

    return {
      data: vendors,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1
      }
    };
  }

  static async getById(user: { id: string; companyId?: string; role?: { name: string } }, id: string) {
    const isSuperAdmin = user.role?.name === 'SUPER_ADMIN';
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    if (!vendor) {
      const error: AppError = new Error('Vendor not found');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    if (!isSuperAdmin && vendor.companyId !== user.companyId) {
      const error: AppError = new Error('Access denied to vendor outside company scope');
      error.statusCode = 403;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }

    return vendor;
  }

  static async create(user: { id: string; companyId?: string; role?: { name: string } }, data: CreateVendorInput) {
    const isSuperAdmin = user.role?.name === 'SUPER_ADMIN';
    const targetCompanyId = isSuperAdmin ? (data.companyId || user.companyId) : user.companyId;

    if (!targetCompanyId) {
      const error: AppError = new Error('Company is required to create a vendor');
      error.statusCode = 400;
      error.code = ErrorCode.BAD_REQUEST;
      throw error;
    }

    const code = data.code.trim().toUpperCase();

    const existing = await prisma.vendor.findUnique({
      where: {
        companyId_code: {
          companyId: targetCompanyId,
          code
        }
      }
    });

    if (existing) {
      const error: AppError = new Error(`Vendor with code '${code}' already exists`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.vendor.create({
      data: {
        companyId: targetCompanyId,
        name: data.name.trim(),
        code,
        contactEmail: data.contactEmail?.trim() || null,
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });
  }

  static async update(user: { id: string; companyId?: string; role?: { name: string } }, id: string, data: UpdateVendorInput) {
    const isSuperAdmin = user.role?.name === 'SUPER_ADMIN';
    const vendor = await prisma.vendor.findUnique({
      where: { id }
    });

    if (!vendor) {
      const error: AppError = new Error('Vendor not found');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    if (!isSuperAdmin && vendor.companyId !== user.companyId) {
      const error: AppError = new Error('Access denied to update vendor outside company scope');
      error.statusCode = 403;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail?.trim() || null;
    if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
    if (data.address !== undefined) updateData.address = data.address?.trim() || null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.vendor.update({
      where: { id },
      data: updateData,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });
  }

  static async delete(user: { id: string; companyId?: string; role?: { name: string } }, id: string) {
    const isSuperAdmin = user.role?.name === 'SUPER_ADMIN';
    const vendor = await prisma.vendor.findUnique({
      where: { id }
    });

    if (!vendor) {
      const error: AppError = new Error('Vendor not found');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    if (!isSuperAdmin && vendor.companyId !== user.companyId) {
      const error: AppError = new Error('Access denied to delete vendor outside company scope');
      error.statusCode = 403;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }

    return prisma.vendor.delete({
      where: { id }
    });
  }
}
