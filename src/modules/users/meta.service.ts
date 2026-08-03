import { RoleName } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export class MetaService {
  static async getPermissionsMatrix() {
    const [roles, permissions] = await Promise.all([
      prisma.role.findMany({
        include: {
          permissions: {
            include: { permission: true }
          }
        },
        orderBy: { name: 'asc' }
      }),
      prisma.permission.findMany({
        orderBy: { key: 'asc' }
      })
    ]);

    const roleNames = [
      RoleName.SUPER_ADMIN,
      RoleName.COMPANY_ADMIN,
      RoleName.WAREHOUSE_MANAGER,
      RoleName.SUPERVISOR,
      RoleName.OPERATOR,
      RoleName.VIEWER
    ];

    const matrix: Record<string, Record<string, boolean>> = {};

    for (const permission of permissions) {
      matrix[permission.key] = {};
      for (const roleName of roleNames) {
        const role = roles.find((entry) => entry.name === roleName);
        matrix[permission.key][roleName] = Boolean(
          role?.permissions.some((entry) => entry.permission.key === permission.key)
        );
      }
    }

    return {
      roles: roleNames,
      permissions: permissions.map((permission) => ({
        key: permission.key,
        description: permission.description
      })),
      matrix
    };
  }
}
