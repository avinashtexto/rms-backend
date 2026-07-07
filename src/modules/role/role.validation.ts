import { z } from 'zod';
import { RoleName } from '@prisma/client';

export const createRoleSchema = z.object({
  name: z.nativeEnum(RoleName),
  label: z.string().min(1)
});

export const updateRoleSchema = z.object({
  label: z.string().min(1)
});

export const assignPermissionsSchema = z.object({
  permissionIds: z.array(z.string())
});
