import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class SettingService {
  static async listReasonCodes(companyId: string, appliesTo?: string) {
    return prisma.reasonCode.findMany({
      where: {
        companyId,
        ...(appliesTo && { appliesTo }),
        isActive: true
      },
      orderBy: { code: 'asc' }
    });
  }

  static async createReasonCode(companyId: string, code: string, label: string, appliesTo: string) {
    const existing = await prisma.reasonCode.findUnique({
      where: {
        companyId_code: {
          companyId,
          code
        }
      }
    });

    if (existing) {
      const error: AppError = new Error(`Reason code '${code}' already exists`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.reasonCode.create({
      data: {
        companyId,
        code,
        label,
        appliesTo
      }
    });
  }

  static async getCompanySettings(companyId: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      const error: AppError = new Error('Company not found');
      error.statusCode = 404;
      error.code = ErrorCode.COMPANY_NOT_FOUND;
      throw error;
    }

    return company;
  }

  static async updateCompanySettings(companyId: string, name?: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      const error: AppError = new Error('Company not found');
      error.statusCode = 404;
      error.code = ErrorCode.COMPANY_NOT_FOUND;
      throw error;
    }

    return prisma.company.update({
      where: { id: companyId },
      data: {
        name: name !== undefined ? name : company.name
      }
    });
  }
}
