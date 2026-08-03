import { UsersService } from './users.service';

describe('UsersService', () => {
  it('exposes user management methods', () => {
    expect(typeof UsersService.list).toBe('function');
    expect(typeof UsersService.create).toBe('function');
    expect(typeof UsersService.updateAssignments).toBe('function');
  });
});
