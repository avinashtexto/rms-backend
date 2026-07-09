import { Response, NextFunction } from 'express';
import { BranchService } from './branch.service';
import { listBranchesQuerySchema, createBranchSchema, updateBranchSchema } from './branch.validation';
import { AuthenticatedRequest } from '../auth/auth.types';
import { BranchRepository } from './branch.repository';

export class BranchController {
  static async listBranches(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const userId = req.user!.id;
      const query = listBranchesQuerySchema.parse(req.query);
      
      const result = await BranchService.listBranches({
        page: query.page,
        pageSize: query.pageSize,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        filters: {
          companyId,
          search: query.search,
          isActive: query.isActive,
          startDate: query.startDate ? new Date(query.startDate) : undefined,
          endDate: query.endDate ? new Date(query.endDate) : undefined
        }
      });
      
      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBranchById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const branchId = req.params.id as string;
      
      const branch = await BranchService.getBranchById(branchId, companyId);
      
      res.status(200).json({
        success: true,
        data: branch
      });
    } catch (error) {
      next(error);
    }
  }

  static async createBranch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const userId = req.user!.id;
      const data = createBranchSchema.parse(req.body);
      
      const branch = await BranchService.createBranch(
        userId,
        companyId,
        {
          name: data.name,
          code: data.code,
          address: data.address,
          city: data.city,
          state: data.state,
          country: data.country,
          zipCode: data.zipCode,
          phone: data.phone,
          isActive: data.isActive
        }
      );
      
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
      const userId = req.user!.id;
      const branchId = req.params.id as string;
      const data = updateBranchSchema.parse(req.body);
      
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.code !== undefined) updateData.code = data.code;
      if (data.address !== undefined) updateData.address = data.address;
      if (data.city !== undefined) updateData.city = data.city;
      if (data.state !== undefined) updateData.state = data.state;
      if (data.country !== undefined) updateData.country = data.country;
      if (data.zipCode !== undefined) updateData.zipCode = data.zipCode;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      
      const branch = await BranchService.updateBranch(
        userId,
        companyId,
        branchId,
        updateData
      );
      
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
      const userId = req.user!.id;
      const branchId = req.params.id as string;
      
      await BranchService.deleteBranch(userId, companyId, branchId);
      
      res.status(200).json({
        success: true,
        message: 'Branch deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
