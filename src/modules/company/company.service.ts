import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class CompanyService {
  static async listCompanies(page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;
    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.company.count()
    ]);

    return {
      data: companies,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  static async getCompany(companyId: string, id: string) {
    const company = await prisma.company.findFirst({
      where: { id }
    });

    if (!company) {
      const error: AppError = new Error('Company not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.COMPANY_NOT_FOUND;
      throw error;
    }

    return company;
  }

  static async createCompany(name: string, code: string) {
    const existing = await prisma.company.findUnique({
      where: { code }
    });

    if (existing) {
      const error: AppError = new Error(`Company code '${code}' is already taken`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.company.create({
      data: { name, code }
    });
  }

  static async updateCompany(companyId: string, id: string, name?: string, isActive?: boolean) {
    const company = await prisma.company.findFirst({
      where: { id }
    });

    if (!company) {
      const error: AppError = new Error('Company not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.COMPANY_NOT_FOUND;
      throw error;
    }

    return prisma.company.update({
      where: { id },
      data: {
        name: name !== undefined ? name : company.name,
        isActive: isActive !== undefined ? isActive : company.isActive
      }
    });
  }

  static async deleteCompany(companyId: string, id: string) {
    const company = await prisma.company.findFirst({
      where: { id }
    });

    if (!company) {
      const error: AppError = new Error('Company not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.COMPANY_NOT_FOUND;
      throw error;
    }

    try {
      return await prisma.company.delete({
        where: { id }
      });
    } catch (e: any) {
      // Prisma foreign key constraint violation code is P2003
      if (e.code === 'P2003') {
        const error: AppError = new Error('Cannot delete company because it has active branches, users, sites, or clients associated with it. Please suspend the company instead.');
        error.statusCode = 400;
        error.code = ErrorCode.VALIDATION_ERROR;
        throw error;
      }
      throw e;
    }
  }
}
