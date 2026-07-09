import { z } from 'zod';

export const listSitesQuerySchema = z.object({
  page: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1).default(1)),
  pageSize: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1).max(100).default(20))
});

export const createSiteSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
  name: z.string().min(1, 'Site name is required').max(255, 'Site name must be less than 255 characters'),
  code: z.string().min(1, 'Site code is required').max(50, 'Site code must be less than 50 characters'),
  address: z.preprocess((val) => val === '' ? undefined : val, z.string().max(500).optional()),
  city: z.preprocess((val) => val === '' ? undefined : val, z.string().max(100).optional()),
  state: z.preprocess((val) => val === '' ? undefined : val, z.string().max(100).optional()),
  country: z.preprocess((val) => val === '' ? undefined : val, z.string().max(100).optional()),
  phone: z.preprocess((val) => val === '' || val === null || val === undefined ? undefined : val, z.string().regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits with optional leading +').optional()),
  isActive: z.boolean().default(true)
});

export const updateSiteSchema = z.object({
  branchId: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined || val === 'null' || val === 'undefined') {
      return undefined;
    }
    return val;
  }, z.string().uuid().optional()),
  name: z.string().min(1).max(255).optional(),
  code: z.string().min(1).max(50).optional(),
  address: z.preprocess((val) => val === '' ? undefined : val, z.string().max(500).optional()),
  city: z.preprocess((val) => val === '' ? undefined : val, z.string().max(100).optional()),
  state: z.preprocess((val) => val === '' ? undefined : val, z.string().max(100).optional()),
  country: z.preprocess((val) => val === '' ? undefined : val, z.string().max(100).optional()),
  phone: z.preprocess((val) => val === '' || val === null || val === undefined ? undefined : val, z.string().regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits with optional leading +').optional()),
  isActive: z.boolean().optional()
});
