import { z } from 'zod';

export const listCompaniesQuerySchema = z.object({
  page: z.preprocess((val) => (val === undefined || val === '' ? 1 : parseInt(val as string, 10)), z.number().int().min(1).default(1)),
  pageSize: z.preprocess((val) => (val === undefined || val === '' ? 20 : parseInt(val as string, 10)), z.number().int().min(1).max(100).default(20))
});

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  code: z.string().min(2, 'Company code must be at least 2 characters').max(10, 'Company code must be at most 10 characters').toUpperCase(),
  isActive: z.boolean().default(true).optional(),
  admin: z.object({
    fullName: z.string().min(1, 'Admin full name is required'),
    email: z.string().email('Valid admin email is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    phone: z.string().optional()
  }).optional()
});

export const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional()
});
