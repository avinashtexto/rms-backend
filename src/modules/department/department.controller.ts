import { Response, NextFunction } from 'express';
import { DepartmentService } from './department.service';
import { createDepartmentSchema, updateDepartmentSchema } from './department.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class DepartmentController {
  static async listDepartments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const clientId = req.query.clientId as string | undefined;
      const departments = await DepartmentService.listDepartments(clientId);
      res.status(200).json({
        success: true,
        data: departments
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const departmentId = req.params.id as string;
      const department = await DepartmentService.getDepartment(departmentId);
      res.status(200).json({
        success: true,
        data: department
      });
    } catch (error) {
      next(error);
    }
  }

  static async createDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = createDepartmentSchema.parse(req.body);
      const department = await DepartmentService.createDepartment(data.clientId, data.name, data.code);
      res.status(201).json({
        success: true,
        data: department
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const departmentId = req.params.id as string;
      const data = updateDepartmentSchema.parse(req.body);
      const department = await DepartmentService.updateDepartment(departmentId, data.name, data.isActive);
      res.status(200).json({
        success: true,
        data: department
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const departmentId = req.params.id as string;
      await DepartmentService.deleteDepartment(departmentId);
      res.status(200).json({
        success: true,
        message: 'Department deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
