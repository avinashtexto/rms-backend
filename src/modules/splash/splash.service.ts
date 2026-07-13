import { prisma } from '../../lib/prisma';
import { SplashStatusResponse } from './splash.types';

export class SplashService {
  static async getStatus(deviceId?: string): Promise<SplashStatusResponse> {
    let deviceStatus: 'APPROVED' | 'PENDING' | 'BLOCKED' | 'RETIRED' | 'UNREGISTERED' = 'UNREGISTERED';

    if (deviceId) {
      const device = await prisma.device.findUnique({
        where: { serialNumber: deviceId }
      });
      if (device) {
        deviceStatus = device.status as 'APPROVED' | 'PENDING' | 'BLOCKED' | 'RETIRED';
      }
    }

    // Load defaults or company settings if available
    return {
      deviceStatus,
      config: {
        minAppVersion: '1.0.0',
        latestAppVersion: '1.0.0',
        maintenanceMode: false,
        features: {
          gpsTracking: true,
          biometricAuth: true,
          offlineSync: true
        }
      }
    };
  }
}
