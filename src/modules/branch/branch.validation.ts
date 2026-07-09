import { z } from 'zod';

export const listBranchesQuerySchema = z.object({
  page: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1).default(1)),
  pageSize: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1).max(100).default(20)),
  search: z.string().optional(),
  isActive: z.preprocess((val) => val === 'true' ? true : val === 'false' ? false : undefined, z.boolean().optional()),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(['name', 'code', 'city', 'state', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const createBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(255, 'Branch name must be less than 255 characters'),
  code: z.string().min(1, 'Branch code is required').max(50, 'Branch code must be less than 50 characters'),
  address: z.preprocess((val) => val === '' || val === null || val === undefined ? undefined : val, z.string().max(500).optional()),
  city: z.preprocess((val) => val === '' || val === null || val === undefined ? undefined : val, z.string().max(100).optional()),
  state: z.preprocess((val) => val === '' || val === null || val === undefined ? undefined : val, z.string().max(100).optional()),
  country: z.preprocess((val) => val === '' || val === null || val === undefined ? undefined : val, z.string().max(100).optional()),
  zipCode: z.preprocess((val) => val === '' || val === null || val === undefined ? undefined : val, z.coerce.number().int().positive().optional()),
  phone: z.preprocess((val) => val === '' || val === null || val === undefined ? undefined : val, z.string().regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits with optional leading +').optional()),
  isActive: z.boolean().default(true)
});

export const updateBranchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  code: z.string().min(1).max(50).optional(),
  address: z.string().max(500).nullable().optional().transform(val => val === null ? undefined : val),
  city: z.string().max(100).nullable().optional().transform(val => val === null ? undefined : val),
  state: z.string().max(100).nullable().optional().transform(val => val === null ? undefined : val),
  country: z.string().max(100).nullable().optional().transform(val => val === null ? undefined : val),
  zipCode: z.coerce.number().int().positive().nullable().optional().transform(val => val === null ? undefined : val),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits with optional leading +').nullable().optional().transform(val => val === null || val === '' ? undefined : val),
  isActive: z.boolean().optional()
});
