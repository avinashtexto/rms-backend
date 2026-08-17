import { z } from 'zod';

export const listWarehousesQuerySchema = z.object({
  page: z.preprocess((val) => (val === undefined || val === '' ? 1 : parseInt(val as string, 10)), z.number().int().min(1).default(1)),
  pageSize: z.preprocess((val) => (val === undefined || val === '' ? 20 : parseInt(val as string, 10)), z.number().int().min(1).max(100).default(20))
});

export const createWarehouseSchema = z.object({
  siteId: z.string().uuid('Invalid site ID'),
  name: z.string().min(1, 'Warehouse name is required').max(255, 'Warehouse name must be less than 255 characters'),
  code: z.string().min(1, 'Warehouse code is required').max(50, 'Warehouse code must be less than 50 characters'),
  address: z.preprocess((val) => val === '' ? undefined : val, z.string().max(500).optional()),
  city: z.preprocess((val) => val === '' ? undefined : val, z.string().max(100).optional()),
  state: z.preprocess((val) => val === '' ? undefined : val, z.string().max(100).optional()),
  country: z.preprocess((val) => val === '' ? undefined : val, z.string().max(100).optional()),
  zipCode: z.preprocess((val) => val === '' || val === null || val === undefined ? undefined : val, z.coerce.number().int().positive().optional()),
  phone: z.preprocess((val) => val === '' || val === null || val === undefined ? undefined : val, z.string().regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits with optional leading +').optional()),
  isActive: z.boolean().default(true),
  admin: z.object({
    fullName: z.string().min(1, 'Admin full name is required'),
    email: z.string().email('Valid admin email is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    phone: z.string().optional()
  }).optional()
});

export const updateWarehouseSchema = z.object({
  siteId: z.preprocess((val) => {
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
  zipCode: z.preprocess((val) => val === '' || val === null || val === undefined ? undefined : val, z.coerce.number().int().positive().optional()),
  phone: z.preprocess((val) => val === '' || val === null || val === undefined ? undefined : val, z.string().regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits with optional leading +').optional()),
  isActive: z.boolean().optional()
});
