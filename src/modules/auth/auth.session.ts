import { RoleName, UserStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export interface SessionContext {
  companyId: string;
  branchId: string | null;
  warehouseId: string | null;
}

export interface EntityRef {
  id: string;
  name: string;
  code?: string;
}

export interface SessionScopeOptions {
  companyId?: string;
  branchId?: string | null;
  warehouseId?: string | null;
}

type UserWithRole = {
  id: string;
  companyId: string;
  roleId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  role: { id: string; name: RoleName; label: string };
  company: { id: string; name: string; code: string; isActive?: boolean };
  warehouseAssignments: Array<{
    warehouse: {
      id: string;
      code: string;
      name: string;
      companyId: string;
      isActive: boolean;
      site: {
        id: string;
        branchId: string;
        branch: { id: string; name: string; code: string; isActive: boolean };
      } | null;
    };
  }>;
};

export async function loadUserForSession(userId: string): Promise<UserWithRole | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
      company: true,
      warehouseAssignments: {
        include: {
          warehouse: {
            include: {
              site: {
                include: {
                  branch: true
                }
              }
            }
          }
        }
      }
    }
  });
}

export async function getPermissionsForRole(roleId: string): Promise<string[]> {
  const permissions = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true }
  });
  return permissions.map((rp) => rp.permission.key);
}

export async function getAccessibleWarehouses(
  user: UserWithRole,
  companyId: string,
  branchId?: string | null
) {
  const isAdmin =
    user.role.name === RoleName.SUPER_ADMIN || user.role.name === RoleName.COMPANY_ADMIN;

  let warehouses = isAdmin
    ? await prisma.warehouse.findMany({
        where: { companyId, isActive: true },
        include: {
          site: {
            include: { branch: true }
          }
        },
        orderBy: { name: 'asc' }
      })
    : user.warehouseAssignments
        .map((a) => a.warehouse)
        .filter((w) => w.companyId === companyId && w.isActive);

  if (branchId) {
    warehouses = warehouses.filter((w) => w.site?.branchId === branchId);
  }

  return warehouses;
}

export async function getAccessibleBranches(user: UserWithRole, companyId: string) {
  const warehouses = await getAccessibleWarehouses(user, companyId);
  const branchIds = new Set<string>();
  for (const w of warehouses) {
    if (w.site?.branchId) branchIds.add(w.site.branchId);
  }

  if (branchIds.size === 0) {
    return prisma.branch.findMany({
      where: { companyId, isActive: true, deletedAt: null },
      orderBy: { name: 'asc' }
    });
  }

  return prisma.branch.findMany({
    where: {
      companyId,
      isActive: true,
      deletedAt: null,
      id: { in: Array.from(branchIds) }
    },
    orderBy: { name: 'asc' }
  });
}

export async function getAccessibleCompanies(user: UserWithRole) {
  if (user.role.name === RoleName.SUPER_ADMIN) {
    return prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true }
    });
  }

  return prisma.company.findMany({
    where: { id: user.companyId, isActive: true },
    select: { id: true, name: true, code: true }
  });
}

export async function assertActiveCompany(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company || !company.isActive) {
    const error: AppError = new Error('Company is inactive or not found');
    error.statusCode = 403;
    error.code = ErrorCode.FORBIDDEN;
    throw error;
  }
  return company;
}

export async function assertActiveBranch(branchId: string, companyId: string) {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, companyId, isActive: true, deletedAt: null }
  });
  if (!branch) {
    const error: AppError = new Error('Branch is inactive or not found');
    error.statusCode = 403;
    error.code = ErrorCode.FORBIDDEN;
    throw error;
  }
  return branch;
}

export async function assertWarehouseAccess(
  user: UserWithRole,
  warehouseId: string,
  companyId: string
) {
  const warehouses = await getAccessibleWarehouses(user, companyId);
  const warehouse = warehouses.find((w) => w.id === warehouseId);
  if (!warehouse) {
    const error: AppError = new Error('Invalid warehouse or access denied');
    error.statusCode = 403;
    error.code = ErrorCode.FORBIDDEN;
    throw error;
  }
  if (!warehouse.isActive) {
    const error: AppError = new Error('Warehouse is inactive');
    error.statusCode = 403;
    error.code = ErrorCode.FORBIDDEN;
    throw error;
  }
  return warehouse;
}

export async function resolveSessionContext(
  user: UserWithRole,
  options: SessionScopeOptions = {}
): Promise<SessionContext> {
  let companyId = options.companyId ?? user.companyId;

  if (user.role.name !== RoleName.SUPER_ADMIN && companyId !== user.companyId) {
    const error: AppError = new Error('Cannot access this company');
    error.statusCode = 403;
    error.code = ErrorCode.FORBIDDEN;
    throw error;
  }

  await assertActiveCompany(companyId);

  const isEnterpriseAdmin =
    user.role.name === RoleName.SUPER_ADMIN || user.role.name === RoleName.COMPANY_ADMIN;

  const warehouses = await getAccessibleWarehouses(user, companyId, options.branchId);

  if (warehouses.length === 0) {
    if (!isEnterpriseAdmin) {
      const hasAssignedWh = user.warehouseAssignments && user.warehouseAssignments.length > 0;
      const error: AppError = new Error(
        hasAssignedWh
          ? 'Assigned warehouse is inactive or deactivated'
          : 'No warehouse access assigned for this user'
      );
      error.statusCode = 403;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }

    const branches = await getAccessibleBranches(user, companyId);
    return {
      companyId,
      branchId: branches[0]?.id ?? null,
      warehouseId: null
    };
  }

  let warehouse =
    options.warehouseId
      ? warehouses.find((w) => w.id === options.warehouseId)
      : warehouses[0];

  if (!warehouse) {
    if (!isEnterpriseAdmin) {
      const error: AppError = new Error('Invalid warehouse for current branch');
      error.statusCode = 403;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }
    warehouse = warehouses[0];
  }

  let branchId = options.branchId ?? warehouse?.site?.branchId ?? null;

  if (branchId) {
    await assertActiveBranch(branchId, companyId);
  } else {
    const branches = await getAccessibleBranches(user, companyId);
    branchId = branches[0]?.id ?? null;
  }

  return {
    companyId,
    branchId,
    warehouseId: warehouse ? warehouse.id : null
  };
}

export function mapWarehouseRef(
  warehouse: { id: string; code: string; name: string }
): EntityRef {
  return { id: warehouse.id, code: warehouse.code, name: warehouse.name };
}

export function mapBranchRef(branch: { id: string; name: string; code?: string }): EntityRef {
  return { id: branch.id, name: branch.name, code: branch.code };
}

export function mapCompanyRef(company: { id: string; name: string; code?: string }): EntityRef {
  return { id: company.id, name: company.name, code: company.code };
}
