import { BranchService } from './branch.service';
import { BranchRepository } from './branch.repository';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

// Mock dependencies
jest.mock('./branch.repository');
jest.mock('../../lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: jest.fn()
    }
  }
}));

describe('BranchService', () => {
  const mockCompanyId = 'company-123';
  const mockUserId = 'user-123';
  const mockBranchId = 'branch-123';
  const mockBranch = {
    id: mockBranchId,
    companyId: mockCompanyId,
    name: 'Test Branch',
    code: 'TEST',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listBranches', () => {
    it('should list branches with options', async () => {
      const mockResult = {
        data: [mockBranch],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
      };
      (BranchRepository.list as jest.Mock).mockResolvedValue(mockResult);

      const result = await BranchService.listBranches({
        page: 1,
        pageSize: 20
      });

      expect(BranchRepository.list).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getBranchById', () => {
    it('should get branch by id', async () => {
      (BranchRepository.findById as jest.Mock).mockResolvedValue(mockBranch);

      const result = await BranchService.getBranchById(mockBranchId, mockCompanyId);

      expect(BranchRepository.findById).toHaveBeenCalledWith(mockBranchId);
      expect(result).toEqual(mockBranch);
    });

    it('should throw error if branch not found', async () => {
      (BranchRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(BranchService.getBranchById(mockBranchId, mockCompanyId))
        .rejects.toThrow('Branch not found or access denied');
    });

    it('should throw error if branch belongs to different company', async () => {
      const otherBranch = { ...mockBranch, companyId: 'other-company' };
      (BranchRepository.findById as jest.Mock).mockResolvedValue(otherBranch);

      await expect(BranchService.getBranchById(mockBranchId, mockCompanyId))
        .rejects.toThrow('Branch not found or access denied');
    });
  });

  describe('createBranch', () => {
    it('should create a new branch', async () => {
      const createData = {
        companyId: mockCompanyId,
        name: 'New Branch',
        code: 'NEW'
      };
      (BranchRepository.findByCompanyAndCode as jest.Mock).mockResolvedValue(null);
      (BranchRepository.create as jest.Mock).mockResolvedValue(mockBranch);

      const result = await BranchService.createBranch(mockUserId, mockCompanyId, createData);

      expect(BranchRepository.findByCompanyAndCode).toHaveBeenCalledWith(mockCompanyId, 'NEW');
      expect(BranchRepository.create).toHaveBeenCalledWith(createData);
      expect(result).toEqual(mockBranch);
    });

    it('should throw error if branch code already exists', async () => {
      const createData = {
        companyId: mockCompanyId,
        name: 'New Branch',
        code: 'EXISTING'
      };
      (BranchRepository.findByCompanyAndCode as jest.Mock).mockResolvedValue(mockBranch);

      await expect(BranchService.createBranch(mockUserId, mockCompanyId, createData))
        .rejects.toThrow("Branch with code 'EXISTING' already exists");
    });
  });

  describe('updateBranch', () => {
    it('should update a branch', async () => {
      const updateData = { name: 'Updated Name' };
      const updatedBranch = { ...mockBranch, name: 'Updated Name' };
      (BranchRepository.findByCompanyAndId as jest.Mock).mockResolvedValue(mockBranch);
      (BranchRepository.findByCompanyAndCode as jest.Mock).mockResolvedValue(null);
      (BranchRepository.update as jest.Mock).mockResolvedValue(updatedBranch);

      const result = await BranchService.updateBranch(mockUserId, mockCompanyId, mockBranchId, updateData);

      expect(BranchRepository.findByCompanyAndId).toHaveBeenCalledWith(mockCompanyId, mockBranchId);
      expect(BranchRepository.update).toHaveBeenCalledWith(mockBranchId, updateData);
      expect(result).toEqual(updatedBranch);
    });

    it('should throw error if branch not found', async () => {
      (BranchRepository.findByCompanyAndId as jest.Mock).mockResolvedValue(null);

      await expect(BranchService.updateBranch(mockUserId, mockCompanyId, mockBranchId, { name: 'Test' }))
        .rejects.toThrow('Branch not found or access denied');
    });

    it('should throw error if code change conflicts', async () => {
      const updateData = { code: 'CONFLICT' };
      (BranchRepository.findByCompanyAndId as jest.Mock).mockResolvedValue(mockBranch);
      (BranchRepository.findByCompanyAndCode as jest.Mock).mockResolvedValue({ id: 'other-branch' });

      await expect(BranchService.updateBranch(mockUserId, mockCompanyId, mockBranchId, updateData))
        .rejects.toThrow("Branch with code 'CONFLICT' already exists");
    });
  });

  describe('deleteBranch', () => {
    it('should soft delete a branch', async () => {
      (BranchRepository.findByCompanyAndId as jest.Mock).mockResolvedValue(mockBranch);
      (BranchRepository.hasDependencies as jest.Mock).mockResolvedValue({
        hasDependencies: false,
        details: { sites: 0 }
      });
      (BranchRepository.softDelete as jest.Mock).mockResolvedValue(mockBranch);

      await BranchService.deleteBranch(mockUserId, mockCompanyId, mockBranchId);

      expect(BranchRepository.findByCompanyAndId).toHaveBeenCalledWith(mockCompanyId, mockBranchId);
      expect(BranchRepository.hasDependencies).toHaveBeenCalledWith(mockBranchId);
      expect(BranchRepository.softDelete).toHaveBeenCalledWith(mockBranchId);
    });

    it('should throw error if branch not found', async () => {
      (BranchRepository.findByCompanyAndId as jest.Mock).mockResolvedValue(null);

      await expect(BranchService.deleteBranch(mockUserId, mockCompanyId, mockBranchId))
        .rejects.toThrow('Branch not found or access denied');
    });

    it('should throw error if branch has dependencies', async () => {
      (BranchRepository.findByCompanyAndId as jest.Mock).mockResolvedValue(mockBranch);
      (BranchRepository.hasDependencies as jest.Mock).mockResolvedValue({
        hasDependencies: true,
        details: { sites: 5 }
      });

      await expect(BranchService.deleteBranch(mockUserId, mockCompanyId, mockBranchId))
        .rejects.toThrow('Cannot delete branch. It has 5 site(s) associated with it.');
    });
  });
});
