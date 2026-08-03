import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('exposes list and get methods', () => {
    expect(typeof AuditService.listAuditLogs).toBe('function');
    expect(typeof AuditService.getAuditLogById).toBe('function');
  });
});
