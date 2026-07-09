import { BranchRepository } from './branch.repository';
import { prisma } from '../../lib/prisma';

// Mock Prisma client
jest.mock('../../lib/prisma', () => ({
  prisma: {
    branch: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
  }
}));

describe('BranchRepository', () => {
  const mockCompanyId = 'company-123';
  const mockBranchId = 'branch-123';
  const mockBranch = {
    id: mockBranchId,
    companyId: mockCompanyId,
    name: 'Test Branch',
    code: 'TEST',
    address: '123 Test St',
    city: 'Test City',
    state: 'TS',
    country: 'Test Country',
    zipCode: '12345',
    phone: '1234567890',
    isActive: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should find a branch by id', async () => {
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);

      const result = await BranchRepository.findById(mockBranchId);

      expect(prisma.branch.findFirst).toHaveBeenCalledWith({
        where: { id: mockBranchId, deletedAt: null },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      });
      expect(result).toEqual(mockBranch);
    });

    it('should return null if branch not found', async () => {
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await BranchRepository.findById(mockBranchId);

      expect(result).toBeNull();
    });
  });

  describe('findByCompanyAndCode', () => {
    it('should find a branch by company and code', async () => {
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue(mockBranch);

      const result = await BranchRepository.findByCompanyAndCode(mockCompanyId, 'TEST');

      expect(prisma.branch.findUnique).toHaveBeenCalledWith({
        where: {
          companyId_code: {
            companyId: mockCompanyId,
            code: 'TEST'
          }
        }
      });
      expect(result).toEqual(mockBranch);
    });
  });

  describe('findByCompanyAndId', () => {
    it('should find a branch by company and id', async () => {
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);

      const result = await BranchRepository.findByCompanyAndId(mockCompanyId, mockBranchId);

      expect(prisma.branch.findFirst).toHaveBeenCalledWith({
        where: { id: mockBranchId, companyId: mockCompanyId }
      });
      expect(result).toEqual(mockBranch);
    });
  });

  describe('list', () => {
    it('should list branches with pagination', async () => {
      const mockBranches = [mockBranch];
      (prisma.branch.findMany as jest.Mock).mockResolvedValue(mockBranches);
      (prisma.branch.count as jest.Mock).mockResolvedValue(1);

      const result = await BranchRepository.list({
        page: 1,
        pageSize: 20
      });

      expect(prisma.branch.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      });
      expect(result).toEqual({
        data: mockBranches,
        meta: {
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1
        }
      });
    });

    it('should filter by search term', async () => {
      (prisma.branch.findMany as jest.Mock).mockResolvedValue([mockBranch]);
      (prisma.branch.count as jest.Mock).mockResolvedValue(1);

      await BranchRepository.list({
        page: 1,
        pageSize: 20,
        filters: { search: 'Test' }
      });

      expect(prisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            OR: expect.arrayContaining([
              expect.objectContaining({ name: { contains: 'Test', mode: 'insensitive' } })
            ])
          })
        })
      );
    });

    it('should filter by isActive status', async () => {
      (prisma.branch.findMany as jest.Mock).mockResolvedValue([mockBranch]);
      (prisma.branch.count as jest.Mock).mockResolvedValue(1);

      await BranchRepository.list({
        page: 1,
        pageSize: 20,
        filters: { isActive: true }
      });

      expect(prisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            isActive: true
          })
        })
      );
    });
  });

  describe('create', () => {
    it('should create a new branch', async () => {
      const createData = {
        companyId: mockCompanyId,
        name: 'New Branch',
        code: 'NEW'
      };
      (prisma.branch.create as jest.Mock).mockResolvedValue(mockBranch);

      const result = await BranchRepository.create(createData);

      expect(prisma.branch.create).toHaveBeenCalledWith({
        data: createData,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      });
      expect(result).toEqual(mockBranch);
    });
  });

  describe('update', () => {
    it('should update a branch', async () => {
      const updateData = { name: 'Updated Name' };
      const updatedBranch = { ...mockBranch, name: 'Updated Name' };
      (prisma.branch.update as jest.Mock).mockResolvedValue(updatedBranch);

      const result = await BranchRepository.update(mockBranchId, updateData);

      expect(prisma.branch.update).toHaveBeenCalledWith({
        where: { id: mockBranchId },
        data: updateData,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      });
      expect(result).toEqual(updatedBranch);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a branch', async () => {
      (prisma.branch.update as jest.Mock).mockResolvedValue(mockBranch);

      await BranchRepository.softDelete(mockBranchId);

      expect(prisma.branch.update).toHaveBeenCalledWith({
        where: { id: mockBranchId },
        data: { deletedAt: expect.any(Date) }
      });
    });
  });

  describe('hasDependencies', () => {
    it('should return true if branch has dependencies', async () => {
      (prisma.site.count as jest.Mock).mockResolvedValue(5);

      const result = await BranchRepository.hasDependencies(mockBranchId);

      expect(result).toEqual({
        hasDependencies: true,
        details: {
          sites: 5
        }
      });
    });

    it('should return false if branch has no dependencies', async () => {
      (prisma.site.count as jest.Mock).mockResolvedValue(0);

      const result = await BranchRepository.hasDependencies(mockBranchId);

      expect(result).toEqual({
        hasDependencies: false,
        details: {
          sites: 0
        }
      });
    });
  });

  describe('countByCompany', () => {
    it('should count branches by company', async () => {
      (prisma.branch.count as jest.Mock).mockResolvedValue(10);

      const result = await BranchRepository.countByCompany(mockCompanyId);

      expect(prisma.branch.count).toHaveBeenCalledWith({
        where: { companyId: mockCompanyId, deletedAt: null }
      });
      expect(result).toBe(10);
    });
  });
});
