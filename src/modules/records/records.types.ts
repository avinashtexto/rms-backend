import { BoxStatus, FileRecordStatus } from '@prisma/client';

export interface RecordsUser {
  id: string;
  companyId: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface LocationBreadcrumbItem {
  type: 'branch' | 'site' | 'warehouse' | 'room' | 'rack' | 'shelf' | 'location';
  id: string;
  code: string;
  name: string;
}

export interface ListBoxesQuery {
  page: number;
  limit: number;
  search?: string;
  sortBy: 'barcode' | 'description' | 'status' | 'updatedAt';
  order: 'asc' | 'desc';
  status?: BoxStatus;
  clientId?: string;
  locationId?: string;
  warehouseId?: string;
}

export interface ListFilesQuery {
  page: number;
  limit: number;
  search?: string;
  sortBy: 'barcode' | 'title' | 'status' | 'updatedAt';
  order: 'asc' | 'desc';
  status?: FileRecordStatus;
  boxId?: string;
  clientId?: string;
}
