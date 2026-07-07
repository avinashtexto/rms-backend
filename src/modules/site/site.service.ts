import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class SiteService {
  static async listSites(companyId: string) {
    return prisma.site.findMany({
      where: { companyId },
      include: {
        branch: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createSite(
    companyId: string,
    branchId: string,
    name: string,
    code: string,
    address?: string,
    latitude?: number,
    longitude?: number
  ) {
    // Verify branch belongs to current company
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, companyId }
    });

    if (!branch) {
      const error: AppError = new Error('Branch not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    // Check unique constraint: [branchId, code]
    const existing = await prisma.site.findUnique({
      where: {
        branchId_code: {
          branchId,
          code
        }
      }
    });

    if (existing) {
      const error: AppError = new Error(`Site with code '${code}' already exists under this Branch`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.site.create({
      data: {
        companyId,
        branchId,
        name,
        code,
        address,
        latitude,
        longitude
      }
    });
  }

  static async updateSite(
    companyId: string,
    siteId: string,
    name?: string,
    address?: string,
    latitude?: number,
    longitude?: number,
    isActive?: boolean
  ) {
    const site = await prisma.site.findFirst({
      where: { id: siteId, companyId }
    });

    if (!site) {
      const error: AppError = new Error('Site not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.site.update({
      where: { id: siteId },
      data: {
        name: name !== undefined ? name : site.name,
        address: address !== undefined ? address : site.address,
        latitude: latitude !== undefined ? latitude : site.latitude,
        longitude: longitude !== undefined ? longitude : site.longitude,
        isActive: isActive !== undefined ? isActive : site.isActive
      }
    });
  }

  static async deleteSite(companyId: string, siteId: string) {
    const site = await prisma.site.findFirst({
      where: { id: siteId, companyId }
    });

    if (!site) {
      const error: AppError = new Error('Site not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.site.delete({
      where: { id: siteId }
    });
  }
}
