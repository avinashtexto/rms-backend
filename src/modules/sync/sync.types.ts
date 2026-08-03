export type SyncOperationType =
  | 'INTAKE'
  | 'FRESH_BOX'
  | 'INVENTORY'
  | 'REFILE'
  | 'SEGREGATION'
  | 'LOOKUP';

export type SyncOperationStatus = 'ok' | 'rejected' | 'duplicate';

export interface SyncOperationInput {
  type: SyncOperationType;
  payload: Record<string, unknown>;
}

export interface SyncOperationResult {
  clientOpId: string;
  status: SyncOperationStatus;
  operationId?: string;
  error?: string;
}

export interface SyncUser {
  id: string;
  companyId: string;
}
