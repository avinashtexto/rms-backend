import { z } from 'zod';

export const createNotificationSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.enum([
    'DUPLICATE_SCAN',
    'WRONG_LOCATION',
    'WRONG_BOX',
    'INVENTORY_PENDING',
    'SYNC_FAILED',
    'LOW_BATTERY',
    'GPS_DISABLED'
  ]),
  targetUserId: z.string().optional() // If omitted or "ALL", broadcasts to company users
});

export const notificationQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(20),
  search: z.string().optional(),
  type: z.string().optional(),
  isRead: z.coerce.boolean().optional()
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>;
