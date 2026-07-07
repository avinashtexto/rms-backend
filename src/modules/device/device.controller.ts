import { Response, NextFunction } from 'express';
import { DeviceService } from './device.service';
import { registerDeviceSchema, updateDeviceStatusSchema, assignDeviceSchema } from './device.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class DeviceController {
  static async listDevices(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const devices = await DeviceService.listDevices(companyId);
      res.status(200).json({ success: true, data: devices });
    } catch (error) {
      next(error);
    }
  }

  static async registerDevice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const data = registerDeviceSchema.parse(req.body);
      const device = await DeviceService.registerDevice(companyId, data.serialNumber, data.model);
      res.status(201).json({ success: true, data: device });
    } catch (error) {
      next(error);
    }
  }

  static async approveDevice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const deviceId = req.params.deviceId as string;
      const device = await DeviceService.approveDevice(companyId, deviceId);
      res.status(200).json({ success: true, data: device });
    } catch (error) {
      next(error);
    }
  }

  static async updateDeviceStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const deviceId = req.params.deviceId as string;
      const data = updateDeviceStatusSchema.parse(req.body);
      const device = await DeviceService.updateDeviceStatus(companyId, deviceId, data.status);
      res.status(200).json({ success: true, data: device });
    } catch (error) {
      next(error);
    }
  }

  static async assignDevice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const deviceId = req.params.deviceId as string;
      const data = assignDeviceSchema.parse(req.body);
      const device = await DeviceService.assignDevice(companyId, deviceId, data.assignedUserId);
      res.status(200).json({ success: true, data: device });
    } catch (error) {
      next(error);
    }
  }
}
