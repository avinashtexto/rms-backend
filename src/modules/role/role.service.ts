import { prisma } from '../../lib/prisma';
import { RoleName } from '@prisma/client';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class RoleService {
  static async listRoles(companyId: string) {
    return prisma.role.findMany({
      where: {
        OR: [
          { companyId },
          { companyId: null } // System system roles
        ]
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });
  }

  static async createRole(companyId: string, name: RoleName, label: string) {
    const existing = await prisma.role.findFirst({
      where: { companyId, name }
    });

    if (existing) {
      const error: AppError = new Error(`Role '${name}' already exists for this company`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.role.create({
      data: {
        companyId,
        name,
        label
      }
    });
  }

  static async updateRole(companyId: string, roleId: string, label: string) {
    const role = await prisma.role.findFirst({
      where: { id: roleId, companyId }
    });

    if (!role) {
      const error: AppError = new Error('Role not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.ROLE_NOT_FOUND;
      throw error;
    }

    return prisma.role.update({
      where: { id: roleId },
      data: { label }
    });
  }

  static async listPermissions() {
    return prisma.permission.findMany();
  }

  static async assignPermissions(companyId: string, roleId: string, permissionIds: string[], isSuperAdmin: boolean) {
    // Find role to ensure it exists and belongs to the company
    const role = await prisma.role.findFirst({
      where: isSuperAdmin ? { id: roleId } : { id: roleId, companyId }
    });

    if (!role) {
      const error: AppError = new Error('Role not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.ROLE_NOT_FOUND;
      throw error;
    }

    // Run in a transaction
    return prisma.$transaction(async (tx) => {
      // 1. Delete all current permissions for this role
      await tx.rolePermission.deleteMany({
        where: { roleId }
      });

      // 2. Insert new permissions
      if (permissionIds.length > 0) {
        const dataToCreate = permissionIds.map(pId => ({
          roleId,
          permissionId: pId
        }));
        await tx.rolePermission.createMany({
          data: dataToCreate
        });
      }

      // Return updated role with permissions
      return tx.role.findUnique({
        where: { id: roleId },
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      });
    });
  }
}
