import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class CompanyService {
  static async listCompanies() {
    return prisma.company.findMany({
      orderBy: { createdAt: 'desc' }
    });
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

  static async updateCompany(id: string, name?: string, isActive?: boolean) {
    const company = await prisma.company.findUnique({
      where: { id }
    });

    if (!company) {
      const error: AppError = new Error('Company not found');
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

  static async deleteCompany(id: string) {
    const company = await prisma.company.findUnique({
      where: { id }
    });

    if (!company) {
      const error: AppError = new Error('Company not found');
      error.statusCode = 404;
      error.code = ErrorCode.COMPANY_NOT_FOUND;
      throw error;
    }

    return prisma.company.delete({
      where: { id }
    });
  }
}
