import { z } from 'zod';

export const listVendorsQuerySchema = z.object({
  page: z.preprocess((val) => (val === undefined || val === '' ? 1 : parseInt(val as string, 10)), z.number().int().min(1).default(1)),
  pageSize: z.preprocess((val) => (val === undefined || val === '' ? 20 : parseInt(val as string, 10)), z.number().int().min(1).max(100).default(20)),
  search: z.string().optional(),
  status: z.enum(['ALL', 'ACTIVE', 'INACTIVE']).optional().default('ALL'),
  companyId: z.string().optional()
});

export const createVendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required').max(255),
  code: z.string().min(1, 'Vendor code is required').max(50).toUpperCase(),
  contactEmail: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable().or(z.literal('')),
  address: z.string().max(500).optional().nullable().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
  companyId: z.string().optional()
});

export const updateVendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required').max(255).optional(),
  contactEmail: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable().or(z.literal('')),
  address: z.string().max(500).optional().nullable().or(z.literal('')),
  isActive: z.boolean().optional()
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type ListVendorsQueryInput = z.infer<typeof listVendorsQuerySchema>;
