import { z } from 'zod';

const emailOrEmpty = z
  .string()
  .email()
  .optional()
  .nullable()
  .or(z.literal('').transform(() => null));

const phoneOrEmpty = z
  .string()
  .optional()
  .nullable()
  .or(z.literal('').transform(() => null));

export const createClientSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2).max(10).toUpperCase(),
  contactEmail: emailOrEmpty,
  contactPhone: phoneOrEmpty
});

export const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  contactEmail: emailOrEmpty,
  contactPhone: phoneOrEmpty,
  isActive: z.boolean().optional()
});

export const createDepartmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2).max(10).toUpperCase()
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional()
});
