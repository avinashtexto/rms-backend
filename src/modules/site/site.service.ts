import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class SiteService {
  /** Public method — no company scoping. Returns id + name of every active site for the login dropdown. */
  static async listAllActiveSites() {
    return prisma.site.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' }
    });
  }

  static async listSites(companyId: string, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;
    const [sites, total] = await Promise.all([
      prisma.site.findMany({
        where: { companyId },
        include: {
          branch: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.site.count({ where: { companyId } })
    ]);

    return {
      data: sites,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  static async getSiteById(companyId: string, siteId: string) {
    const site = await prisma.site.findFirst({
      where: { id: siteId, companyId },
      include: {
        branch: true
      }
    });

    if (!site) {
      const error: AppError = new Error('Site not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.SITE_NOT_FOUND;
      throw error;
    }

    return site;
  }

  static async createSite(
    companyId: string,
    branchId: string,
    name: string,
    code: string,
    address?: string,
    city?: string,
    state?: string,
    country?: string,
    phone?: string,
    isActive?: boolean
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
        city,
        state,
        country,
        phone,
        isActive: isActive !== undefined ? isActive : true
      }
    });
  }

  static async updateSite(
    companyId: string,
    siteId: string,
    branchId?: string,
    name?: string,
    code?: string,
    address?: string,
    city?: string,
    state?: string,
    country?: string,
    phone?: string,
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

    const data: any = {
      name: name !== undefined ? name : site.name,
      code: code !== undefined ? code : site.code,
      address: address !== undefined ? address : site.address,
      city: city !== undefined ? city : site.city,
      state: state !== undefined ? state : site.state,
      country: country !== undefined ? country : site.country,
      phone: phone !== undefined ? phone : site.phone,
      isActive: isActive !== undefined ? isActive : site.isActive
    };

    if (branchId !== undefined && branchId !== site.branchId) {
      if (branchId) {
        const branch = await prisma.branch.findFirst({
          where: { id: branchId, companyId }
        });

        if (!branch) {
          const error: AppError = new Error('Branch not found or access denied');
          error.statusCode = 404;
          error.code = ErrorCode.NOT_FOUND;
          throw error;
        }

        const existing = await prisma.site.findFirst({
          where: {
            branchId,
            code: site.code,
            id: { not: siteId }
          }
        });

        if (existing) {
          const error: AppError = new Error(`Site with code '${site.code}' already exists under the new Branch`);
          error.statusCode = 400;
          error.code = ErrorCode.DUPLICATE_CODE;
          throw error;
        }

        data.branchId = branchId;
      }
    }

    return prisma.site.update({
      where: { id: siteId },
      data
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
