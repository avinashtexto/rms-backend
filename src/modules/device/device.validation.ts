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
  assignedUserId: z.string().uuid().nullable().optional().transform(val => val === null ? undefined : val)
});

export const updateDeviceSchema = z.object({
  serialNumber: z.string().optional(),
  model: z.string().optional(),
  status: z.nativeEnum(DeviceStatus).optional(),
  assignedUserId: z.string().optional().transform(val => (val === '' || val === null) ? null : val),
  userId: z.string().optional().transform(val => (val === '' || val === null) ? null : val),
  isActive: z.boolean().optional()
}).transform((val) => {
  const result: any = {
    serialNumber: val.serialNumber,
    model: val.model,
    status: val.status,
  };
  
  if (val.assignedUserId !== undefined) {
    result.assignedUserId = val.assignedUserId;
  } else if (val.userId !== undefined) {
    result.assignedUserId = val.userId;
  }

  if (val.isActive !== undefined) {
    result.status = val.isActive ? DeviceStatus.APPROVED : DeviceStatus.BLOCKED;
  }
  
  Object.keys(result).forEach(key => {
    if (result[key] === undefined) delete result[key];
  });
  return result;
});
