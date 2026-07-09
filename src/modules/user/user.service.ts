import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { UserStatus } from '@prisma/client';

export class UserService {
  static async listUsers(
    companyId: string,
    filters: { roleId?: string; status?: UserStatus },
    page: number = 1,
    pageSize: number = 20
  ) {
    const skip = (page - 1) * pageSize;
    
    const where: any = {
      companyId,
      ...(filters.roleId && { roleId: filters.roleId }),
      ...(filters.status && { status: filters.status })
    };

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          employeeCode: true,
          fullName: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          role: {
            select: {
              id: true,
              name: true,
              label: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.user.count({ where })
    ]);

    return {
      users,
      meta: {
        page,
        pageSize,
        total
      }
    };
  }

  static async getUserById(companyId: string, userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            name: true,
            label: true
          }
        }
      }
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    return user;
  }

  static async createUser(companyId: string, data: any) {
    const emailLower = data.email.trim().toLowerCase();
    // 1. Check unique email system-wide
    const existingEmail = await prisma.user.findUnique({
      where: { email: emailLower }
    });
    if (existingEmail) {
      const error: AppError = new Error(`Email '${data.email}' is already registered`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_EMAIL;
      throw error;
    }

    // 2. Check unique employeeCode within company
    const existingCode = await prisma.user.findUnique({
      where: {
        companyId_employeeCode: {
          companyId,
          employeeCode: data.employeeCode
        }
      }
    });
    if (existingCode) {
      const error: AppError = new Error(`Employee code '${data.employeeCode}' already exists in this company`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        companyId,
        roleId: data.roleId,
        employeeCode: data.employeeCode,
        fullName: data.fullName,
        email: emailLower,
        phone: data.phone,
        passwordHash
      },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            name: true,
            label: true
          }
        }
      }
    });

    return user;
  }

  static async updateUser(companyId: string, userId: string, data: any) {
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId }
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName !== undefined ? data.fullName : user.fullName,
        phone: data.phone !== undefined ? data.phone : user.phone,
        roleId: data.roleId !== undefined ? data.roleId : user.roleId,
        status: data.status !== undefined ? data.status : user.status
      },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            name: true,
            label: true
          }
        }
      }
    });

    return updatedUser;
  }

  static async deactivateUser(companyId: string, userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId }
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    return prisma.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' },
      select: {
        id: true,
        status: true
      }
    });
  }

  static async deleteUser(companyId: string, userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId }
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    return prisma.user.delete({
      where: { id: userId }
    });
  }

  static async resetPassword(companyId: string, userId: string, newPassword: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId }
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    return { message: 'Password reset successfully' };
  }
}
