import { RoleName } from '@prisma/client';

/** Roles allowed to sign in via the web admin panel API (`/admin/auth/login`). */
export const ADMIN_PANEL_ROLES: RoleName[] = [
  RoleName.SUPER_ADMIN,
  RoleName.COMPANY_ADMIN,
  RoleName.WAREHOUSE_MANAGER,
];

/** Permissions granted to Warehouse Manager for warehouse-scoped admin panel access. */
export const WAREHOUSE_MANAGER_PERMISSION_KEYS = [
  'dashboard:view',
  'warehouse:view',
  'warehouse:manage',
  'storage:view',
  'storage:manage',
  'box:view',
  'box:manage',
  'file:view',
  'file:manage',
  'workflow:execute',
  'report:view',
  'audit:view',
  'device:view',
  'sync:manage',
] as const;
