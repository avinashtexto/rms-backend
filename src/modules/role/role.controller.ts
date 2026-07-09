import { Response, NextFunction } from 'express';
import { RoleService } from './role.service';
import { createRoleSchema, updateRoleSchema, assignPermissionsSchema } from './role.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class RoleController {
  static async listRoles(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const roles = await RoleService.listRoles(companyId);
      res.status(200).json({
        success: true,
        data: roles
      });
    } catch (error) {
      next(error);
    }
  }

  static async createRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const data = createRoleSchema.parse(req.body);
      const role = await RoleService.createRole(companyId, data.name, data.label);
      res.status(201).json({
        success: true,
        data: role
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const roleId = req.params.id as string;
      const data = updateRoleSchema.parse(req.body);
      const role = await RoleService.updateRole(companyId, roleId, data.label);
      res.status(200).json({
        success: true,
        data: role
      });
    } catch (error) {
      next(error);
    }
  }

  static async listPermissions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const permissions = await RoleService.listPermissions();
      res.status(200).json({
        success: true,
        data: permissions
      });
    } catch (error) {
      next(error);
    }
  }

  static async assignPermissions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const isSuperAdmin = req.user!.roleName === 'SUPER_ADMIN';
      const roleId = req.params.id as string;
      const data = assignPermissionsSchema.parse(req.body);
      const result = await RoleService.assignPermissions(companyId, roleId, data.permissionIds, isSuperAdmin);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const roleId = req.params.id as string;
      await RoleService.deleteRole(companyId, roleId);
      res.status(200).json({
        success: true,
        message: 'Role deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
