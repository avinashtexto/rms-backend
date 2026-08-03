import { OperationType } from '@prisma/client';

export type OperationStatus = 'COMPLETED' | 'REJECTED';

export interface OperationsActor {
  id: string;
  companyId: string;
}

export interface ListOperationsQuery {
  page: number;
  limit: number;
  type?: OperationType;
  status?: OperationStatus;
  mine?: boolean;
  from?: Date;
  to?: Date;
  warehouseId?: string;
  hasMissing?: boolean;
}

export interface OperationSummary {
  id: string;
  type: OperationType;
  status: OperationStatus;
  performedAt: Date;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  summary: string;
  reasonCode?: string;
  fileBarcode?: string;
  boxBarcode?: string;
  warehouseName?: string;
  verifiedCount?: number;
  missingCount?: number;
  warningsCount?: number;
  oldBoxBarcode?: string;
  newBoxBarcode?: string;
  outCount?: number;
  inCount?: number;
}
