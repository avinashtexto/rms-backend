import { Response, NextFunction } from 'express';
import { BranchService } from './branch.service';
import { createBranchSchema, updateBranchSchema } from './branch.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class BranchController {
  static async listBranches(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const branches = await BranchService.listBranches(companyId);
      res.status(200).json({
        success: true,
        data: branches
      });
    } catch (error) {
      next(error);
    }
  }

  static async createBranch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const data = createBranchSchema.parse(req.body);
      const branch = await BranchService.createBranch(companyId, data.name, data.code);
      res.status(201).json({
        success: true,
        data: branch
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateBranch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const branchId = req.params.branchId as string;
      const data = updateBranchSchema.parse(req.body);
      const branch = await BranchService.updateBranch(companyId, branchId, data.name, data.isActive);
      res.status(200).json({
        success: true,
        data: branch
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteBranch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const branchId = req.params.branchId as string;
      await BranchService.deleteBranch(companyId, branchId);
      res.status(200).json({
        success: true,
        message: 'Branch deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
