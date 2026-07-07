import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class BranchService {
  static async listBranches(companyId: string) {
    return prisma.branch.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createBranch(companyId: string, name: string, code: string) {
    const existing = await prisma.branch.findUnique({
      where: {
        companyId_code: {
          companyId,
          code
        }
      }
    });

    if (existing) {
      const error: AppError = new Error(`Branch with code '${code}' already exists`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.branch.create({
      data: {
        companyId,
        name,
        code
      }
    });
  }

  static async updateBranch(companyId: string, branchId: string, name?: string, isActive?: boolean) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, companyId }
    });

    if (!branch) {
      const error: AppError = new Error('Branch not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.branch.update({
      where: { id: branchId },
      data: {
        name: name !== undefined ? name : branch.name,
        isActive: isActive !== undefined ? isActive : branch.isActive
      }
    });
  }

  static async deleteBranch(companyId: string, branchId: string) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, companyId }
    });

    if (!branch) {
      const error: AppError = new Error('Branch not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.branch.delete({
      where: { id: branchId }
    });
  }
}
