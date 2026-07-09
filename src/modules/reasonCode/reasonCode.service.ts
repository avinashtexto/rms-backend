import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class ReasonCodeService {
  static async listReasonCodes(companyId?: string) {
    return prisma.reasonCode.findMany({
      where: companyId ? { companyId } : undefined,
      include: {
        company: true
      },
      orderBy: { code: 'asc' }
    });
  }

  static async getReasonCode(id: string) {
    const reasonCode = await prisma.reasonCode.findUnique({
      where: { id },
      include: {
        company: true
      }
    });

    if (!reasonCode) {
      const error: AppError = new Error('Reason code not found');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return reasonCode;
  }

  static async createReasonCode(companyId: string, code: string, label: string, appliesTo: string, isActive: boolean = true) {
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      const error: AppError = new Error('Company not found');
      error.statusCode = 404;
      error.code = ErrorCode.COMPANY_NOT_FOUND;
      throw error;
    }

    const existing = await prisma.reasonCode.findFirst({
      where: { companyId, code }
    });

    if (existing) {
      const error: AppError = new Error(`Reason code '${code}' is already taken for this company`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.reasonCode.create({
      data: { companyId, code, label, appliesTo, isActive },
      include: {
        company: true
      }
    });
  }

  static async updateReasonCode(id: string, label?: string, appliesTo?: string, isActive?: boolean) {
    const reasonCode = await prisma.reasonCode.findUnique({
      where: { id }
    });

    if (!reasonCode) {
      const error: AppError = new Error('Reason code not found');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.reasonCode.update({
      where: { id },
      data: {
        label: label !== undefined ? label : reasonCode.label,
        appliesTo: appliesTo !== undefined ? appliesTo : reasonCode.appliesTo,
        isActive: isActive !== undefined ? isActive : reasonCode.isActive
      },
      include: {
        company: true
      }
    });
  }

  static async deleteReasonCode(id: string) {
    const reasonCode = await prisma.reasonCode.findUnique({
      where: { id }
    });

    if (!reasonCode) {
      const error: AppError = new Error('Reason code not found');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.reasonCode.delete({
      where: { id }
    });
  }
}
