import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { WorkflowAction } from '@prisma/client';
import { BranchRepository, BranchListOptions, BranchCreateData, BranchUpdateData } from './branch.repository';

export class BranchService {
  static async listBranches(options: BranchListOptions) {
    return BranchRepository.list(options);
  }

  static async getBranchById(id: string, companyId: string) {
    const branch = await BranchRepository.findById(id);
    
    if (!branch || branch.companyId !== companyId) {
      const error: AppError = new Error('Branch not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return branch;
  }

  static async createBranch(
    userId: string,
    companyId: string,
    data: Omit<BranchCreateData, 'companyId'>
  ) {
    const existing = await BranchRepository.findByCompanyAndCode(companyId, data.code);

    if (existing) {
      const error: AppError = new Error(`Branch with code '${data.code}' already exists`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    const branch = await BranchRepository.create({
      ...data,
      companyId
    });

    await this.createAuditLog(userId, companyId, WorkflowAction.BRANCH_CREATED, branch.id, null, branch);

    return branch;
  }

  static async updateBranch(
    userId: string,
    companyId: string,
    branchId: string,
    data: BranchUpdateData
  ) {
    const branch = await BranchRepository.findByCompanyAndId(companyId, branchId);

    if (!branch) {
      const error: AppError = new Error('Branch not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    // Check if code is being changed and if it conflicts
    if (data.code && data.code !== branch.code) {
      const existing = await BranchRepository.findByCompanyAndCode(companyId, data.code);
      if (existing) {
        const error: AppError = new Error(`Branch with code '${data.code}' already exists`);
        error.statusCode = 400;
        error.code = ErrorCode.DUPLICATE_CODE;
        throw error;
      }
    }

    const previousState = { ...branch };
    const updatedBranch = await BranchRepository.update(branchId, data);

    await this.createAuditLog(userId, companyId, WorkflowAction.BRANCH_UPDATED, branchId, previousState, updatedBranch);

    return updatedBranch;
  }

  static async deleteBranch(
    userId: string,
    companyId: string,
    branchId: string
  ) {
    const branch = await BranchRepository.findByCompanyAndId(companyId, branchId);

    if (!branch) {
      const error: AppError = new Error('Branch not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    // Check for dependencies
    const dependencies = await BranchRepository.hasDependencies(branchId);
    if (dependencies.hasDependencies) {
      const error: AppError = new Error(
        `Cannot delete branch. It has ${dependencies.details.sites} site(s) associated with it.`
      );
      error.statusCode = 400;
      error.code = ErrorCode.DEPENDENCY_EXISTS;
      throw error;
    }

    const previousState = { ...branch };
    await BranchRepository.softDelete(branchId);

    await this.createAuditLog(userId, companyId, WorkflowAction.BRANCH_DELETED, branchId, previousState, null);
  }

  private static async createAuditLog(
    userId: string,
    companyId: string,
    action: WorkflowAction,
    branchId: string,
    previousState: any = null,
    newState: any = null
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action,
          branchId,
          previousState: previousState ? JSON.parse(JSON.stringify(previousState)) : null,
          newState: newState ? JSON.parse(JSON.stringify(newState)) : null
        }
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }
}
