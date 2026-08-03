import bcrypt from 'bcryptjs';
import { Prisma, RoleName, UserStatus, WorkflowAction } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { AccessActor, ListUsersQuery, mapUserResponse, userPublicSelect } from './users.types';
import { mobileAssignableRoles } from './users.validation';

export class UsersService {
  private static resolveCompanyScope(actor: AccessActor, companyId?: string): string | undefined {
    if (actor.roleName === RoleName.SUPER_ADMIN) {
      return companyId;
    }
    return actor.companyId;
  }

  private static async writeUserAudit(
    actor: AccessActor,
    targetUserId: string,
    action: WorkflowAction,
    previousState: unknown,
    newState: unknown
  ) {
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { companyId: true }
    });
    if (!target) return;

    await prisma.auditLog.create({
      data: {
        companyId: target.companyId,
        userId: actor.id,
        action,
        previousState: previousState as Prisma.InputJsonValue,
        newState: newState as Prisma.InputJsonValue
      }
    });
  }

  private static assertCanManageTarget(actor: AccessActor, targetRole: RoleName, targetCompanyId: string) {
    if (actor.roleName !== RoleName.SUPER_ADMIN && targetCompanyId !== actor.companyId) {
      const error: AppError = new Error('Access denied');
      error.statusCode = 403;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }

    if (actor.roleName === RoleName.COMPANY_ADMIN && targetRole === RoleName.SUPER_ADMIN) {
      const error: AppError = new Error('Company administrators cannot manage super admin users');
      error.statusCode = 403;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }
  }

  private static assertAssignableRole(actor: AccessActor, role: RoleName) {
    if (role === RoleName.SUPER_ADMIN && actor.roleName !== RoleName.SUPER_ADMIN) {
      const error: AppError = new Error('Only super administrators can assign the SUPER_ADMIN role');
      error.statusCode = 403;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }
  }

  private static async resolveRoleId(companyId: string, roleName: RoleName) {
    const role = await prisma.role.findFirst({
      where: {
        name: roleName,
        OR: [{ companyId }, { companyId: null }]
      },
      orderBy: { companyId: 'desc' }
    });

    if (!role) {
      const error: AppError = new Error(`Role '${roleName}' is not configured`);
      error.statusCode = 400;
      error.code = ErrorCode.ROLE_NOT_FOUND;
      throw error;
    }

    return role.id;
  }

  static async list(query: ListUsersQuery, actor: AccessActor) {
    const scopedCompanyId = UsersService.resolveCompanyScope(actor, query.companyId);
    const skip = (query.page - 1) * query.limit;

    const where: Prisma.UserWhereInput = {
      ...(scopedCompanyId && { companyId: scopedCompanyId }),
      ...(actor.roleName === RoleName.COMPANY_ADMIN && { role: { name: { not: RoleName.SUPER_ADMIN } } }),
      ...(query.role && { role: { name: query.role } }),
      ...(query.isActive !== undefined && {
        status: query.isActive ? UserStatus.ACTIVE : UserStatus.SUSPENDED
      }),
      ...(query.warehouseId && {
        warehouseAssignments: { some: { warehouseId: query.warehouseId } }
      }),
      ...(query.search && {
        OR: [
          { employeeCode: { contains: query.search, mode: 'insensitive' } },
          { fullName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } }
        ]
      })
    };

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: userPublicSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit
      }),
      prisma.user.count({ where })
    ]);

    return {
      data: users.map(mapUserResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    };
  }

  static async get(userId: string, actor: AccessActor) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userPublicSelect
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    UsersService.assertCanManageTarget(actor, user.role.name, user.companyId);

    if (actor.roleName === RoleName.COMPANY_ADMIN && user.role.name === RoleName.SUPER_ADMIN) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    return mapUserResponse(user);
  }

  static async create(
    data: {
      username: string;
      fullName: string;
      email: string;
      password: string;
      role: RoleName;
      phone?: string;
      warehouseIds: string[];
    },
    actor: AccessActor,
    companyId?: string
  ) {
    const targetCompanyId =
      actor.roleName === RoleName.SUPER_ADMIN ? companyId ?? actor.companyId : actor.companyId;

    UsersService.assertAssignableRole(actor, data.role);

    const roleId = await UsersService.resolveRoleId(targetCompanyId, data.role);
    const emailLower = data.email.trim().toLowerCase();

    const existingEmail = await prisma.user.findUnique({ where: { email: emailLower } });
    if (existingEmail) {
      const error: AppError = new Error(`Email '${data.email}' is already registered`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_EMAIL;
      throw error;
    }

    const existingCode = await prisma.user.findUnique({
      where: {
        companyId_employeeCode: {
          companyId: targetCompanyId,
          employeeCode: data.username
        }
      }
    });
    if (existingCode) {
      const error: AppError = new Error(`Username '${data.username}' already exists in this company`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    if (data.warehouseIds.length > 0) {
      const warehouses = await prisma.warehouse.findMany({
        where: { id: { in: data.warehouseIds }, companyId: targetCompanyId }
      });
      if (warehouses.length !== data.warehouseIds.length) {
        const error: AppError = new Error('One or more warehouses are invalid for this company');
        error.statusCode = 400;
        error.code = ErrorCode.VALIDATION_ERROR;
        throw error;
      }
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          companyId: targetCompanyId,
          roleId,
          employeeCode: data.username,
          fullName: data.fullName,
          email: emailLower,
          phone: data.phone,
          passwordHash,
          status: UserStatus.ACTIVE
        },
        select: userPublicSelect
      });

      if (data.warehouseIds.length > 0) {
        await tx.userWarehouseAssignment.createMany({
          data: data.warehouseIds.map((warehouseId) => ({
            userId: created.id,
            warehouseId
          }))
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        select: userPublicSelect
      });
    });

    await UsersService.writeUserAudit(actor, user.id, WorkflowAction.USER_CREATED, null, mapUserResponse(user));

    return mapUserResponse(user);
  }

  static async update(
    userId: string,
    data: {
      fullName?: string;
      email?: string;
      phone?: string | null;
      role?: RoleName;
      isActive?: boolean;
    },
    actor: AccessActor
  ) {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    });

    if (!existing) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    UsersService.assertCanManageTarget(actor, existing.role.name, existing.companyId);

    if (data.role) {
      UsersService.assertAssignableRole(actor, data.role);
    }

    if (data.email && data.email !== existing.email) {
      const duplicate = await prisma.user.findUnique({ where: { email: data.email } });
      if (duplicate) {
        const error: AppError = new Error(`Email '${data.email}' is already registered`);
        error.statusCode = 400;
        error.code = ErrorCode.DUPLICATE_EMAIL;
        throw error;
      }
    }

    const roleId = data.role
      ? await UsersService.resolveRoleId(existing.companyId, data.role)
      : existing.roleId;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.role !== undefined && { roleId }),
        ...(data.isActive !== undefined && {
          status: data.isActive ? UserStatus.ACTIVE : UserStatus.SUSPENDED
        })
      },
      select: userPublicSelect
    });

    await UsersService.writeUserAudit(
      actor,
      userId,
      WorkflowAction.USER_UPDATED,
      {
        fullName: existing.fullName,
        email: existing.email,
        status: existing.status,
        role: existing.role.name
      },
      mapUserResponse(updated)
    );

    return mapUserResponse(updated);
  }

  static async resetPassword(userId: string, newPassword: string, actor: AccessActor) {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    });

    if (!existing) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    UsersService.assertCanManageTarget(actor, existing.role.name, existing.companyId);

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    await UsersService.writeUserAudit(actor, userId, WorkflowAction.USER_UPDATED, null, {
      passwordReset: true
    });

    return { message: 'Password reset successfully' };
  }

  static async updateAssignments(userId: string, warehouseIds: string[], actor: AccessActor) {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        warehouseAssignments: {
          include: { warehouse: { select: { id: true, code: true, name: true } } }
        }
      }
    });

    if (!existing) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    UsersService.assertCanManageTarget(actor, existing.role.name, existing.companyId);

    const warehouses = await prisma.warehouse.findMany({
      where: { id: { in: warehouseIds }, companyId: existing.companyId }
    });
    if (warehouses.length !== warehouseIds.length) {
      const error: AppError = new Error('One or more warehouses are invalid for this company');
      error.statusCode = 400;
      error.code = ErrorCode.VALIDATION_ERROR;
      throw error;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.userWarehouseAssignment.deleteMany({ where: { userId } });
      if (warehouseIds.length > 0) {
        await tx.userWarehouseAssignment.createMany({
          data: warehouseIds.map((warehouseId) => ({ userId, warehouseId }))
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: userPublicSelect
      });
    });

    await UsersService.writeUserAudit(
      actor,
      userId,
      WorkflowAction.USER_UPDATED,
      {
        warehouseIds: existing.warehouseAssignments.map((assignment) => assignment.warehouse.id)
      },
      {
        warehouseIds
      }
    );

    return mapUserResponse(updated);
  }

  static async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userPublicSelect
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    return mapUserResponse(user);
  }

  static async updateMe(
    userId: string,
    data: { fullName?: string; email?: string; phone?: string | null }
  ) {
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    if (data.email && data.email !== existing.email) {
      const duplicate = await prisma.user.findUnique({ where: { email: data.email } });
      if (duplicate) {
        const error: AppError = new Error(`Email '${data.email}' is already registered`);
        error.statusCode = 400;
        error.code = ErrorCode.DUPLICATE_EMAIL;
        throw error;
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone })
      },
      select: userPublicSelect
    });

    return mapUserResponse(updated);
  }
}
