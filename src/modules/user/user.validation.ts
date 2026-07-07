import { z } from 'zod';
import { UserStatus } from '@prisma/client';

export const createUserSchema = z.object({
  roleId: z.string().uuid(),
  employeeCode: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6)
});

export const updateUserSchema = z.object({
  roleId: z.string().uuid().optional(),
  fullName: z.string().min(1).optional(),
  phone: z.string().optional(),
  status: z.nativeEnum(UserStatus).optional()
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
