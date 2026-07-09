import { Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { createUserSchema, updateUserSchema, resetPasswordSchema, listUsersQuerySchema } from './user.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class UserController {
  static async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const query = listUsersQuerySchema.parse(req.query);
      const result = await UserService.listUsers(
        companyId,
        { roleId: query.roleId, status: query.status },
        query.page,
        query.pageSize
      );
      res.status(200).json({
        success: true,
        data: result.users,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUserById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const userId = req.params.id as string;
      const user = await UserService.getUserById(companyId, userId);
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  static async createUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const data = createUserSchema.parse(req.body);
      const user = await UserService.createUser(companyId, data);
      res.status(201).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const userId = req.params.id as string;
      const data = updateUserSchema.parse(req.body);
      const user = await UserService.updateUser(companyId, userId, data);
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  static async deactivateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const userId = req.params.id as string;
      const result = await UserService.deactivateUser(companyId, userId);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const userId = req.params.id as string;
      await UserService.deleteUser(companyId, userId);
      res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const userId = req.params.id as string;
      const data = resetPasswordSchema.parse(req.body);
      const result = await UserService.resetPassword(companyId, userId, data.password);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}
