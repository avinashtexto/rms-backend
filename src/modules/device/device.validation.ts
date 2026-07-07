import { z } from 'zod';
import { DeviceStatus } from '@prisma/client';

export const registerDeviceSchema = z.object({
  serialNumber: z.string().min(1),
  model: z.string().min(1)
});

export const updateDeviceStatusSchema = z.object({
  status: z.nativeEnum(DeviceStatus)
});

export const assignDeviceSchema = z.object({
  assignedUserId: z.string().uuid().nullable().optional()
});
