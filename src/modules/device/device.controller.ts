import { Response, NextFunction } from 'express';
import { DeviceService } from './device.service';
import { registerDeviceSchema, updateDeviceStatusSchema, assignDeviceSchema, updateDeviceSchema } from './device.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class DeviceController {
  static async listDevices(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const page = parseInt(req.query.page as string, 10) || 1;
      const pageSize = parseInt(req.query.pageSize as string, 10) || 20;
      const result = await DeviceService.listDevices(companyId, page, pageSize);
      res.status(200).json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  static async getDeviceById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const deviceId = req.params.deviceId as string;
      const device = await DeviceService.getDeviceById(companyId, deviceId);
      res.status(200).json({ success: true, data: device });
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


  static async deleteDevice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const deviceId = req.params.deviceId as string;
      await DeviceService.deleteDevice(companyId, deviceId);
      res.status(200).json({
        success: true,
        message: 'Device deleted successfully'
      });
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

  static async updateDevice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const deviceId = req.params.deviceId as string;
      const data = updateDeviceSchema.parse(req.body);
      const device = await DeviceService.updateDevice(companyId, deviceId, data);
      res.status(200).json({ success: true, data: device });
    } catch (error) {
      next(error);
    }
  }
}
