import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  it('exposes report query methods', () => {
    expect(typeof ReportsService.summary).toBe('function');
    expect(typeof ReportsService.operationsByDay).toBe('function');
    expect(typeof ReportsService.productivity).toBe('function');
    expect(typeof ReportsService.occupancy).toBe('function');
    expect(typeof ReportsService.missingFiles).toBe('function');
    expect(typeof ReportsService.clientHoldings).toBe('function');
    expect(typeof ReportsService.export).toBe('function');
    expect(typeof ReportsService.exportStatus).toBe('function');
  });
});
