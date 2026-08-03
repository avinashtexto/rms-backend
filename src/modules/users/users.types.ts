import { RoleName, UserStatus } from '@prisma/client';

export interface AccessActor {
  id: string;
  companyId: string;
  roleName: RoleName;
}

export interface ListUsersQuery {
  page: number;
  limit: number;
  search?: string;
  role?: RoleName;
  warehouseId?: string;
  isActive?: boolean;
  companyId?: string;
}

export const userPublicSelect = {
  id: true,
  companyId: true,
  employeeCode: true,
  fullName: true,
  email: true,
  phone: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: {
      id: true,
      name: true,
      label: true
    }
  },
  warehouseAssignments: {
    include: {
      warehouse: {
        select: {
          id: true,
          code: true,
          name: true
        }
      }
    }
  },
  _count: {
    select: {
      warehouseAssignments: true
    }
  }
} as const;

export function mapUserResponse(user: {
  id: string;
  companyId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  role: { id: string; name: RoleName; label: string };
  warehouseAssignments?: Array<{
    warehouse: { id: string; code: string; name: string };
  }>;
  _count?: { warehouseAssignments: number };
}) {
  return {
    id: user.id,
    companyId: user.companyId,
    username: user.employeeCode,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    isActive: user.status === 'ACTIVE',
    status: user.status,
    role: user.role,
    warehouses: (user.warehouseAssignments ?? []).map((assignment) => assignment.warehouse),
    warehousesCount: user._count?.warehouseAssignments ?? user.warehouseAssignments?.length ?? 0,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
