import { z } from 'zod';

export const listCompaniesQuerySchema = z.object({
  page: z.preprocess((val) => (val === undefined || val === '' ? 1 : parseInt(val as string, 10)), z.number().int().min(1).default(1)),
  pageSize: z.preprocess((val) => (val === undefined || val === '' ? 20 : parseInt(val as string, 10)), z.number().int().min(1).max(100).default(20))
});

export const createCompanySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2).max(10).toUpperCase()
});

export const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional()
});
