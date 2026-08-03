import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../auth/auth.types';
import { UsersService } from './users.service';
import { DevicesManagementService } from './devices.service';
import { MetaService } from './meta.service';
import {
  createUserSchema,
  listDevicesQuerySchema,
  listUsersQuerySchema,
  resetPasswordSchema,
  updateAssignmentsSchema,
  updateDeviceSchema,
  updateMeSchema,
  updateUserSchema
} from './users.validation';
import { RoleName } from '@prisma/client';

function actorFromRequest(req: AuthenticatedRequest) {
  return {
    id: req.user!.id,
    companyId: req.user!.companyId,
    roleName: req.user!.roleName as RoleName
  };
}

export class UsersController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = listUsersQuerySchema.parse(req.query);
      const result = await UsersService.list(query, actorFromRequest(req));
      res.status(200).json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  static async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await UsersService.get(req.params.id as string, actorFromRequest(req));
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = createUserSchema.parse(req.body);
      const user = await UsersService.create(data, actorFromRequest(req), req.body.companyId);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = updateUserSchema.parse(req.body);
      const user = await UsersService.update(req.params.id as string, data, actorFromRequest(req));
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = resetPasswordSchema.parse(req.body);
      const result = await UsersService.resetPassword(
        req.params.id as string,
        data.newPassword,
        actorFromRequest(req)
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async updateAssignments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = updateAssignmentsSchema.parse(req.body);
      const user = await UsersService.updateAssignments(
        req.params.id as string,
        data.warehouseIds,
        actorFromRequest(req)
      );
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  static async updateMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = updateMeSchema.parse(req.body);
      const user = await UsersService.updateMe(req.user!.id, data);
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }
}

export class DevicesManagementController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = listDevicesQuerySchema.parse(req.query);
      const result = await DevicesManagementService.list(query, actorFromRequest(req));
      res.status(200).json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  static async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const device = await DevicesManagementService.get(req.params.id as string, actorFromRequest(req));
      res.status(200).json({ success: true, data: device });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = updateDeviceSchema.parse(req.body);
      const device = await DevicesManagementService.update(
        req.params.id as string,
        data,
        actorFromRequest(req)
      );
      res.status(200).json({ success: true, data: device });
    } catch (error) {
      next(error);
    }
  }
}

export class MetaController {
  static async getPermissions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const matrix = await MetaService.getPermissionsMatrix();
      res.status(200).json({ success: true, data: matrix });
    } catch (error) {
      next(error);
    }
  }
}
