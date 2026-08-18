import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    companyId: string;
    roleId: string;
    roleName: string;
    branchId?: string | null;
    warehouseId?: string | null;
    deviceId?: string | null;
  };
}
