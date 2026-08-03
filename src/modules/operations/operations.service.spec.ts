import { OperationsService } from './operations.service';

describe('OperationsService', () => {
  it('exposes list and get methods', () => {
    expect(typeof OperationsService.list).toBe('function');
    expect(typeof OperationsService.get).toBe('function');
  });
});
