import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class SettingService {
  static async listReasonCodes(companyId: string, appliesTo?: string) {
    return prisma.reasonCode.findMany({
      where: {
        companyId,
        ...(appliesTo && { appliesTo }),
        isActive: true
      },
      orderBy: { code: 'asc' }
    });
  }

  static async createReasonCode(companyId: string, code: string, label: string, appliesTo: string) {
    const existing = await prisma.reasonCode.findUnique({
      where: {
        companyId_code: {
          companyId,
          code
        }
      }
    });

    if (existing) {
      const error: AppError = new Error(`Reason code '${code}' already exists`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.reasonCode.create({
      data: {
        companyId,
        code,
        label,
        appliesTo
      }
    });
  }

  private static parsePreferences(raw: unknown) {
    const source =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    const capacity = source.defaultLocationCapacity;
    const timezone = source.timezone;

    return {
      defaultLocationCapacity:
        typeof capacity === 'number' && capacity >= 1 && capacity <= 99 ? capacity : 1,
      timezone: typeof timezone === 'string' && timezone.length > 0 ? timezone : 'UTC'
    };
  }

  static async getCompanySettings(companyId: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      const error: AppError = new Error('Company not found');
      error.statusCode = 404;
      error.code = ErrorCode.COMPANY_NOT_FOUND;
      throw error;
    }

    const preferences = SettingService.parsePreferences(company.preferences);

    return {
      id: company.id,
      name: company.name,
      code: company.code,
      isActive: company.isActive,
      defaultLocationCapacity: preferences.defaultLocationCapacity,
      timezone: preferences.timezone,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt
    };
  }

  static async updateCompanySettings(
    companyId: string,
    data: {
      name?: string;
      defaultLocationCapacity?: number;
      timezone?: string;
    }
  ) {
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      const error: AppError = new Error('Company not found');
      error.statusCode = 404;
      error.code = ErrorCode.COMPANY_NOT_FOUND;
      throw error;
    }

    const currentPreferences = SettingService.parsePreferences(company.preferences);
    const nextPreferences = {
      defaultLocationCapacity:
        data.defaultLocationCapacity ?? currentPreferences.defaultLocationCapacity,
      timezone: data.timezone ?? currentPreferences.timezone
    };

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        name: data.name !== undefined ? data.name : company.name,
        preferences: nextPreferences
      }
    });

    const preferences = SettingService.parsePreferences(updated.preferences);

    return {
      id: updated.id,
      name: updated.name,
      code: updated.code,
      isActive: updated.isActive,
      defaultLocationCapacity: preferences.defaultLocationCapacity,
      timezone: preferences.timezone,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };
  }
}
