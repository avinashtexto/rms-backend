import { z } from 'zod';
import { RoleName } from '@prisma/client';

const mobileAssignableRoles = [
  RoleName.WAREHOUSE_MANAGER,
  RoleName.SUPERVISOR,
  RoleName.OPERATOR
] as const;

export const listUsersQuerySchema = z.object({
  page: z.preprocess(
    (val) => (val === undefined ? 1 : parseInt(val as string, 10)),
    z.number().int().min(1).default(1)
  ),
  limit: z.preprocess(
    (val) => (val === undefined ? 20 : parseInt(val as string, 10)),
    z.number().int().min(1).max(200).default(20)
  ),
  search: z.string().trim().min(1).optional(),
  role: z.nativeEnum(RoleName).optional(),
  warehouseId: z.string().uuid().optional(),
  isActive: z
    .preprocess((val) => {
      if (val === undefined) return undefined;
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
  companyId: z.string().uuid().optional()
});

export const createUserSchema = z.object({
  username: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  role: z.nativeEnum(RoleName),
  phone: z.string().optional(),
  warehouseIds: z.array(z.string().uuid()).optional().default([])
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().optional().nullable(),
  role: z.nativeEnum(RoleName).optional(),
  isActive: z.boolean().optional()
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6)
});

export const updateAssignmentsSchema = z.object({
  warehouseIds: z.array(z.string().uuid())
});

export const updateMeSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().optional().nullable()
});

export const listDevicesQuerySchema = z.object({
  page: z.preprocess(
    (val) => (val === undefined ? 1 : parseInt(val as string, 10)),
    z.number().int().min(1).default(1)
  ),
  limit: z.preprocess(
    (val) => (val === undefined ? 20 : parseInt(val as string, 10)),
    z.number().int().min(1).max(200).default(20)
  ),
  search: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  isActive: z
    .preprocess((val) => {
      if (val === undefined) return undefined;
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
  companyId: z.string().uuid().optional()
});

export const updateDeviceSchema = z.object({
  isActive: z.boolean().optional(),
  label: z.string().min(1).optional().nullable()
});

export { mobileAssignableRoles };
