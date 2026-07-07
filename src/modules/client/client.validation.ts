import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2).max(10).toUpperCase(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().optional().nullable()
});

export const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
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
