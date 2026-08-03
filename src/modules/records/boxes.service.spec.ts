import { BoxesRecordsService } from './boxes.service';

describe('BoxesRecordsService', () => {
  it('exposes list, get, update, and timeline methods', () => {
    expect(typeof BoxesRecordsService.list).toBe('function');
    expect(typeof BoxesRecordsService.get).toBe('function');
    expect(typeof BoxesRecordsService.update).toBe('function');
    expect(typeof BoxesRecordsService.timeline).toBe('function');
  });
});
