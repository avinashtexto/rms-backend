import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';

export interface BranchListFilters {
  search?: string;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
  companyId?: string;
}

export interface BranchListOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: BranchListFilters;
}

export interface BranchCreateData {
  companyId: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: number;
  phone?: string;
  isActive?: boolean;
}

export interface BranchUpdateData {
  name?: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: number;
  phone?: string;
  isActive?: boolean;
}

export class BranchRepository {
  static async findById(id: string) {
    return prisma.branch.findFirst({
      where: { id, deletedAt: null },
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

  static async findByCompanyAndCode(companyId: string, code: string) {
    return prisma.branch.findUnique({
      where: {
        companyId_code: {
          companyId,
          code
        }
      }
    });
  }

  static async findByCompanyAndId(companyId: string, id: string) {
    return prisma.branch.findFirst({
      where: { id, companyId, deletedAt: null }
    });
  }

  static async list(options: BranchListOptions) {
    const { page, pageSize, sortBy = 'createdAt', sortOrder = 'desc', filters = {} } = options;
    const skip = (page - 1) * pageSize;

    const where: Prisma.BranchWhereInput = {
      deletedAt: null
    };

    if (filters.companyId) {
      where.companyId = filters.companyId;
    }

    // Search filter
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
        { state: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    // Status filter
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const [branches, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      }),
      prisma.branch.count({ where })
    ]);

    return {
      data: branches,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  static async create(data: BranchCreateData) {
    return prisma.branch.create({
      data,
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

  static async update(id: string, data: BranchUpdateData) {
    return prisma.branch.update({
      where: { id },
      data,
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

  static async softDelete(id: string) {
    return prisma.branch.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  static async hardDelete(id: string) {
    return prisma.branch.delete({
      where: { id }
    });
  }

  static async hasDependencies(id: string) {
    const [sitesCount] = await Promise.all([
      prisma.site.count({
        where: { branchId: id }
      })
    ]);

    return {
      hasDependencies: sitesCount > 0,
      details: {
        sites: sitesCount
      }
    };
  }

  static async countByCompany(companyId: string) {
    return prisma.branch.count({
      where: { companyId, deletedAt: null }
    });
  }
}
