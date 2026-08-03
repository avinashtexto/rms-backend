import { OperationType } from '@prisma/client';

export type ReportExportType =
  | 'OPERATIONS_BY_DAY'
  | 'PRODUCTIVITY'
  | 'OCCUPANCY'
  | 'MISSING_FILES'
  | 'CLIENT_HOLDINGS';

export type ReportExportStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface ReportsActor {
  id: string;
  companyId: string;
}

export interface ReportDateFilters {
  from?: Date;
  to?: Date;
  warehouseId?: string;
}

export interface SummaryCacheEntry {
  expiresAt: number;
  data: {
    todayOperationsByType: Record<OperationType, number>;
    missingFilesCount: number;
    activeDevicesCount: number;
    rejectedRefilesCount: number;
  };
}

export interface ReportExportJob {
  id: string;
  companyId: string;
  reportType: ReportExportType;
  status: ReportExportStatus;
  filters: ReportDateFilters;
  csvData?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}
