export interface SplashStatusQuery {
  deviceId?: string;
  appVersion?: string;
}

export interface SplashStatusResponse {
  deviceStatus: 'APPROVED' | 'PENDING' | 'BLOCKED' | 'RETIRED' | 'UNREGISTERED';
  config: {
    minAppVersion: string;
    latestAppVersion: string;
    maintenanceMode: boolean;
    features: {
      gpsTracking: boolean;
      biometricAuth: boolean;
      offlineSync: boolean;
    };
  };
}
