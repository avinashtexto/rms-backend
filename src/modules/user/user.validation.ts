import { z } from 'zod';
import { UserStatus } from '@prisma/client';

export const createUserSchema = z.object({
  roleId: z.string().uuid(),
  employeeCode: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().optional(),
  password: z.string().min(6)
});

export const updateUserSchema = z.object({
  roleId: z.string().uuid().nullable().optional().transform(val => val === null ? undefined : val),
  fullName: z.string().min(1).max(255).nullable().optional().transform(val => val === null ? undefined : val),
  phone: z.string().nullable().optional().transform(val => val === null || val === '' ? undefined : val),
  status: z.nativeEnum(UserStatus).nullable().optional().transform(val => val === null ? undefined : val)
});

export const resetPasswordSchema = z.object({
  password: z.string().min(6)
});

export const listUsersQuerySchema = z.object({
  roleId: z.string().uuid().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  page: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1).default(1)),
  pageSize: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1).max(100).default(20))
});
