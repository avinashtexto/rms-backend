import { prisma } from '../../lib/prisma';

export class FileTypeService {
  static async list(companyId: string) {
    return prisma.fileType.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async create(companyId: string, data: { name: string; code: string; description?: string; defaultRetentionYears?: number }) {
    const existing = await prisma.fileType.findFirst({
      where: { companyId, code: data.code }
    });
    if (existing) throw new Error(`File type '${data.code}' already exists`);

    return prisma.fileType.create({
      data: {
        companyId,
        name: data.name,
        code: data.code,
        description: data.description,
        defaultRetentionYears: data.defaultRetentionYears || 5
      }
    });
  }

  static async update(id: string, data: Partial<{ name: string; description: string; defaultRetentionYears: number; isActive: boolean }>) {
    return prisma.fileType.update({
      where: { id },
      data
    });
  }

  static async delete(id: string) {
    return prisma.fileType.delete({ where: { id } });
  }
}
