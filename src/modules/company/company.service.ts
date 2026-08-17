import bcrypt from 'bcryptjs';
import { RoleName, UserStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class CompanyService {
  static async listCompanies(page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;
    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.company.count()
    ]);

    return {
      data: companies,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  static async getCompany(companyId: string, id: string) {
    const company = await prisma.company.findFirst({
      where: { id }
    });

    if (!company) {
      const error: AppError = new Error('Company not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.COMPANY_NOT_FOUND;
      throw error;
    }

    return company;
  }

  static async createCompany(
    name: string,
    code: string,
    isActive?: boolean,
    admin?: {
      fullName: string;
      email: string;
      password: string;
      phone?: string;
    }
  ) {
    const normalizedCode = code.trim().toUpperCase();
    const existing = await prisma.company.findUnique({
      where: { code: normalizedCode }
    });

    if (existing) {
      const error: AppError = new Error(`Company code '${normalizedCode}' is already taken`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    if (admin) {
      const normalizedEmail = admin.email.trim().toLowerCase();
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail }
      });
      if (existingUser) {
        const error: AppError = new Error(`Email '${admin.email}' is already registered.`);
        error.statusCode = 400;
        error.code = ErrorCode.DUPLICATE_EMAIL;
        throw error;
      }
    }

    return prisma.$transaction(async (tx) => {
      // 1. Create company
      const company = await tx.company.create({
        data: {
          name: name.trim(),
          code: normalizedCode,
          isActive: isActive !== undefined ? isActive : true
        }
      });

      let adminUser = null;
      if (admin) {
        // 2. Find COMPANY_ADMIN role
        const companyAdminRole = await tx.role.findFirst({
          where: { name: RoleName.COMPANY_ADMIN }
        });

        if (!companyAdminRole) {
          const error: AppError = new Error('COMPANY_ADMIN role not found in database');
          error.statusCode = 500;
          throw error;
        }

        // 3. Hash password
        const passwordHash = await bcrypt.hash(admin.password, 10);
        const employeeCode = `ADM-${normalizedCode}-${Date.now().toString().slice(-4)}`;

        // 4. Create admin user in same transaction
        const user = await tx.user.create({
          data: {
            companyId: company.id,
            roleId: companyAdminRole.id,
            employeeCode,
            fullName: admin.fullName.trim(),
            email: admin.email.trim().toLowerCase(),
            phone: admin.phone?.trim() || null,
            passwordHash,
            status: UserStatus.ACTIVE
          },
          include: { role: true }
        });

        adminUser = {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          employeeCode: user.employeeCode,
          role: user.role.name,
          status: user.status
        };
      }

      return {
        ...company,
        admin: adminUser
      };
    });
  }

  static async updateCompany(companyId: string, id: string, name?: string, isActive?: boolean) {
    const company = await prisma.company.findFirst({
      where: { id }
    });

    if (!company) {
      const error: AppError = new Error('Company not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.COMPANY_NOT_FOUND;
      throw error;
    }

    return prisma.company.update({
      where: { id },
      data: {
        name: name !== undefined ? name : company.name,
        isActive: isActive !== undefined ? isActive : company.isActive
      }
    });
  }

  static async deleteCompany(companyId: string, id: string) {
    const company = await prisma.company.findFirst({
      where: { id }
    });

    if (!company) {
      const error: AppError = new Error('Company not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.COMPANY_NOT_FOUND;
      throw error;
    }

    try {
      return await prisma.company.delete({
        where: { id }
      });
    } catch (e: any) {
      // Prisma foreign key constraint violation code is P2003
      if (e.code === 'P2003') {
        const error: AppError = new Error('Cannot delete company because it has active branches, users, sites, or clients associated with it. Please suspend the company instead.');
        error.statusCode = 400;
        error.code = ErrorCode.VALIDATION_ERROR;
        throw error;
      }
      throw e;
    }
  }
}
