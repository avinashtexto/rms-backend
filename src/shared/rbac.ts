import { RoleName } from '@prisma/client';

/**
 * Canonical permission keys used across RBAC middleware, seed, and admin panel.
 * Warehouse Manager admin-panel tier uses WAREHOUSE_MANAGER_ADMIN_PERMISSIONS only
 * (read-only, warehouse-scoped — no device workflows).
 */
export const Permission = {
  // Warehouse Manager — admin-panel monitoring tier (NEW)
  MASTERS_READ: 'masters:read',
  WAREHOUSE_MONITOR: 'warehouse:monitor',
  WAREHOUSE_REPORTS: 'warehouse:reports',
  LIVE_FEED_VIEW: 'live-feed:view',

  // Shared read permissions
  AUDIT_VIEW: 'audit:view',
  DASHBOARD_VIEW: 'dashboard:view',
  REPORT_VIEW: 'report:view',

  // Legacy / other roles (reference — not assigned to WH Manager admin tier)
  WORKFLOW_EXECUTE: 'workflow:execute',
  SYNC_MANAGE: 'sync:manage',
} as const;

export type PermissionKey = (typeof Permission)[keyof typeof Permission];

export const UserRole = RoleName;

/**
 * Warehouse Manager on the Admin Panel: read-only monitoring + reports for assigned
 * warehouse(s). No device workflows, no sync upload, no master mutations.
 *
 * Applied to role matrix in Step 2; seeded in Step 13.
 */
export const WAREHOUSE_MANAGER_ADMIN_PERMISSIONS: readonly PermissionKey[] = [
  Permission.MASTERS_READ,
  Permission.WAREHOUSE_MONITOR,
  Permission.WAREHOUSE_REPORTS,
  Permission.LIVE_FEED_VIEW,
  Permission.AUDIT_VIEW,
] as const;

/** @deprecated Device-era keys — retained for reference until Step 2 matrix swap */
export const WAREHOUSE_MANAGER_LEGACY_DEVICE_PERMISSIONS = [
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
