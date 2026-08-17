import {
  LocationNamingMode,
  MasterRecordStatus,
  Prisma,
  RackTemplate,
  WarehouseTemplateType,
  WorkflowAction
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import {
  ApplyRackTemplateInput,
  CloneRackTemplateInput,
  CreateRackTemplateInput,
  UpdateRackTemplateInput
} from './rack-template.validation';

export type PreviewNode = {
  label: string;
  children?: PreviewNode[];
};

type TemplateConfig = Pick<
  RackTemplate,
  | 'rowsCount'
  | 'racksCount'
  | 'levelsCount'
  | 'locRows'
  | 'locCols'
  | 'locationPerLevel'
  | 'rowPrefix'
  | 'rackPrefix'
  | 'levelPrefix'
  | 'locationPrefix'
  | 'locationPadding'
  | 'locationNaming'
>;

type ListFilters = {
  page: number;
  pageSize: number;
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  warehouseType?: WarehouseTemplateType | 'ALL';
};

function pad(value: number, size: number) {
  return String(value).padStart(size, '0');
}

function locationsPerLevel(template: TemplateConfig) {
  if (template.locationPerLevel && template.locationPerLevel > 0) {
    return template.locationPerLevel;
  }
  return Math.max(1, template.locRows) * Math.max(1, template.locCols);
}

function buildPreviewTree(template: TemplateConfig): PreviewNode[] {
  const tree: PreviewNode[] = [];
  const locCount = locationsPerLevel(template);

  for (let r = 1; r <= template.rowsCount; r++) {
    const rowLabel = `${template.rowPrefix}-${pad(r, 2)}`;
    const rowNode: PreviewNode = { label: rowLabel, children: [] };

    for (let k = 1; k <= template.racksCount; k++) {
      const rackLabel = `${template.rackPrefix}-${pad(k, 2)}`;
      const rackNode: PreviewNode = { label: rackLabel, children: [] };

      for (let l = 1; l <= template.levelsCount; l++) {
        const levelLabel = `${template.levelPrefix}-${pad(l, 2)}`;
        const levelNode: PreviewNode = { label: levelLabel, children: [] };

        for (let i = 1; i <= locCount; i++) {
          levelNode.children!.push({
            label: `${template.locationPrefix}${pad(i, template.locationPadding)}`
          });
        }

        rackNode.children!.push(levelNode);
      }

      rowNode.children!.push(rackNode);
    }

    tree.push(rowNode);
  }

  return tree;
}

export class RackTemplateService {
  private static async createAuditLog(
    userId: string,
    companyId: string,
    action: WorkflowAction,
    previousState: unknown = null,
    newState: unknown = null,
    warehouseId?: string
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action,
          warehouseId,
          previousState: previousState ? JSON.parse(JSON.stringify(previousState)) : null,
          newState: newState ? JSON.parse(JSON.stringify(newState)) : null
        }
      });
    } catch (error) {
      console.error('Failed to create rack template audit log:', error);
    }
  }

  private static async assertUniqueTemplate(
    companyId: string,
    code: string,
    name: string,
    excludeId?: string
  ) {
    const existing = await prisma.rackTemplate.findFirst({
      where: {
        companyId,
        deletedAt: null,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [{ code }, { name }]
      }
    });

    if (existing) {
      const error: AppError = new Error(
        existing.code === code
          ? `Template code '${code}' already exists`
          : `Template name '${name}' already exists`
      );
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }
  }

  private static async getTemplateForCompany(id: string, companyId: string) {
    const template = await prisma.rackTemplate.findFirst({
      where: { id, companyId, deletedAt: null }
    });
    if (!template) {
      const error: AppError = new Error('Rack template not found');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }
    return template;
  }

  static async listTemplates(companyId: string, filters: ListFilters) {
    const where: Prisma.RackTemplateWhereInput = {
      companyId,
      deletedAt: null,
      ...(filters.status && filters.status !== 'ALL' ? { status: filters.status } : {}),
      ...(filters.warehouseType && filters.warehouseType !== 'ALL'
        ? { warehouseType: filters.warehouseType }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { code: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } }
            ]
          }
        : {})
    };

    const [items, total] = await Promise.all([
      prisma.rackTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize
      }),
      prisma.rackTemplate.count({ where })
    ]);

    const creatorIds = [...new Set(items.map((item) => item.createdBy).filter(Boolean))] as string[];
    const creators =
      creatorIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: creatorIds } },
            select: { id: true, fullName: true, email: true }
          })
        : [];
    const creatorMap = new Map(creators.map((user) => [user.id, user]));

    return {
      data: items.map((item) => ({
        ...item,
        locationPerLevelDisplay: locationsPerLevel(item),
        createdByUser: item.createdBy ? creatorMap.get(item.createdBy) ?? null : null
      })),
      meta: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / filters.pageSize))
      }
    };
  }

  static async getTemplate(id: string, companyId: string) {
    return this.getTemplateForCompany(id, companyId);
  }

  static async createTemplate(companyId: string, userId: string, data: CreateRackTemplateInput) {
    await this.assertUniqueTemplate(companyId, data.code, data.name);

    const locationPerLevel = data.locationPerLevel ?? data.locRows ?? 1;
    const template = await prisma.rackTemplate.create({
      data: {
        companyId,
        name: data.name,
        code: data.code,
        description: data.description,
        warehouseType: data.warehouseType as WarehouseTemplateType,
        rowsCount: data.rowsCount,
        racksCount: data.racksCount,
        levelsCount: data.levelsCount,
        locationPerLevel,
        locRows: data.locRows ?? 1,
        locCols: data.locCols ?? locationPerLevel,
        rowPrefix: data.rowPrefix ?? 'ROW',
        rackPrefix: data.rackPrefix ?? 'R',
        levelPrefix: data.levelPrefix ?? 'L',
        locationPrefix: data.locationPrefix ?? 'LOC',
        locationPadding: data.locationPadding ?? 3,
        locationNaming: (data.locationNaming ?? 'AUTO') as LocationNamingMode,
        status: (data.status ?? 'ACTIVE') as MasterRecordStatus,
        createdBy: userId,
        updatedBy: userId
      }
    });

    await this.createAuditLog(userId, companyId, WorkflowAction.RACK_TEMPLATE_CREATED, null, template);
    return template;
  }

  static async updateTemplate(
    id: string,
    companyId: string,
    userId: string,
    data: UpdateRackTemplateInput
  ) {
    const existing = await this.getTemplateForCompany(id, companyId);

    if (data.code || data.name) {
      await this.assertUniqueTemplate(
        companyId,
        data.code ?? existing.code,
        data.name ?? existing.name,
        id
      );
    }

    const updated = await prisma.rackTemplate.update({
      where: { id },
      data: {
        ...data,
        updatedBy: userId
      }
    });

    await this.createAuditLog(
      userId,
      companyId,
      WorkflowAction.RACK_TEMPLATE_UPDATED,
      existing,
      updated
    );
    return updated;
  }

  static async softDeleteTemplate(id: string, companyId: string, userId: string) {
    const existing = await this.getTemplateForCompany(id, companyId);
    const deleted = await prisma.rackTemplate.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: userId, status: 'INACTIVE' }
    });
    await this.createAuditLog(
      userId,
      companyId,
      WorkflowAction.RACK_TEMPLATE_DELETED,
      existing,
      deleted
    );
    return deleted;
  }

  static async setStatus(
    id: string,
    companyId: string,
    userId: string,
    status: MasterRecordStatus
  ) {
    const existing = await this.getTemplateForCompany(id, companyId);
    const updated = await prisma.rackTemplate.update({
      where: { id },
      data: { status, updatedBy: userId }
    });
    await this.createAuditLog(userId, companyId, WorkflowAction.RACK_TEMPLATE_UPDATED, existing, updated);
    return updated;
  }

  static async cloneTemplate(
    id: string,
    companyId: string,
    userId: string,
    data: CloneRackTemplateInput
  ) {
    const source = await this.getTemplateForCompany(id, companyId);
    await this.assertUniqueTemplate(companyId, data.code, data.name);

    const cloned = await prisma.rackTemplate.create({
      data: {
        companyId,
        name: data.name,
        code: data.code,
        description: source.description,
        warehouseType: source.warehouseType,
        rowsCount: source.rowsCount,
        racksCount: source.racksCount,
        levelsCount: source.levelsCount,
        locationPerLevel: source.locationPerLevel,
        locRows: source.locRows,
        locCols: source.locCols,
        rowPrefix: source.rowPrefix,
        rackPrefix: source.rackPrefix,
        levelPrefix: source.levelPrefix,
        locationPrefix: source.locationPrefix,
        locationPadding: source.locationPadding,
        locationNaming: source.locationNaming,
        status: source.status,
        createdBy: userId,
        updatedBy: userId
      }
    });

    await this.createAuditLog(
      userId,
      companyId,
      WorkflowAction.RACK_TEMPLATE_CLONED,
      { sourceId: source.id, sourceCode: source.code },
      cloned
    );
    return cloned;
  }

  static previewTemplate(template: TemplateConfig) {
    return {
      tree: buildPreviewTree(template),
      summary: {
        rows: template.rowsCount,
        racksPerRow: template.racksCount,
        levelsPerRack: template.levelsCount,
        locationsPerLevel: locationsPerLevel(template),
        totalLocations:
          template.rowsCount *
          template.racksCount *
          template.levelsCount *
          locationsPerLevel(template)
      }
    };
  }

  static async previewTemplateById(id: string, companyId: string, userId: string) {
    const template = await this.getTemplateForCompany(id, companyId);
    const preview = this.previewTemplate(template);
    await this.createAuditLog(
      userId,
      companyId,
      WorkflowAction.RACK_TEMPLATE_PREVIEWED,
      null,
      { templateId: id, summary: preview.summary }
    );
    return preview;
  }

  static previewFromInput(data: CreateRackTemplateInput) {
    const locationPerLevel = data.locationPerLevel ?? data.locRows ?? 1;
    return this.previewTemplate({
      rowsCount: data.rowsCount,
      racksCount: data.racksCount,
      levelsCount: data.levelsCount,
      locRows: data.locRows ?? 1,
      locCols: data.locCols ?? locationPerLevel,
      locationPerLevel,
      rowPrefix: data.rowPrefix ?? 'ROW',
      rackPrefix: data.rackPrefix ?? 'R',
      levelPrefix: data.levelPrefix ?? 'L',
      locationPrefix: data.locationPrefix ?? 'LOC',
      locationPadding: data.locationPadding ?? 3,
      locationNaming: (data.locationNaming ?? 'AUTO') as LocationNamingMode
    } as TemplateConfig);
  }

  static async applyTemplate(
    templateId: string,
    companyId: string,
    userId: string,
    input: ApplyRackTemplateInput
  ) {
    const template = await this.getTemplateForCompany(templateId, companyId);
    if (template.status !== 'ACTIVE') {
      const error: AppError = new Error('Cannot apply an inactive rack template');
      error.statusCode = 400;
      error.code = ErrorCode.VALIDATION_ERROR;
      throw error;
    }

    const room = await prisma.room.findFirst({
      where: { id: input.roomId, warehouseId: input.warehouseId },
      include: { warehouse: true }
    });
    if (!room) {
      const error: AppError = new Error('Room not found for selected warehouse');
      error.statusCode = 404;
      error.code = ErrorCode.ROOM_NOT_FOUND;
      throw error;
    }

    const locCount = locationsPerLevel(template);
    let rowsCreated = 0;
    let racksCreated = 0;
    let levelsCreated = 0;
    let locationsCreated = 0;

    await prisma.$transaction(async (tx) => {
      for (let r = 1; r <= template.rowsCount; r++) {
        const rowCode = `${template.rowPrefix}-${pad(r, 2)}`;
        const row = await tx.row.upsert({
          where: { roomId_code: { roomId: room.id, code: rowCode } },
          create: { roomId: room.id, name: `${template.rowPrefix} ${r}`, code: rowCode },
          update: {}
        });
        rowsCreated += 1;

        for (let k = 1; k <= template.racksCount; k++) {
          const rackCode = `${rowCode}-${template.rackPrefix}${pad(k, 2)}`;
          const rack = await tx.rack.upsert({
            where: { roomId_code: { roomId: room.id, code: rackCode } },
            create: {
              roomId: room.id,
              rowId: row.id,
              name: `${template.rackPrefix} ${k}`,
              code: rackCode,
              barcode: `${room.code}-${rackCode}`
            },
            update: { rowId: row.id }
          });
          racksCreated += 1;

          const shelf = await tx.shelf.upsert({
            where: { rackId_code: { rackId: rack.id, code: 'S1' } },
            create: { rackId: rack.id, name: 'Default Shelf', code: 'S1' },
            update: {}
          });

          for (let l = 1; l <= template.levelsCount; l++) {
            const levelCode = `${template.levelPrefix}-${pad(l, 2)}`;
            const level = await tx.level.upsert({
              where: { rackId_code: { rackId: rack.id, code: levelCode } },
              create: { rackId: rack.id, name: `${template.levelPrefix} ${l}`, code: levelCode },
              update: {}
            });
            levelsCreated += 1;

            for (let i = 1; i <= locCount; i++) {
              const locName = `${template.locationPrefix}${pad(i, template.locationPadding)}`;
              const locBarcode = `${room.code}-${rackCode}-${levelCode}-${locName}`;

              await tx.location.upsert({
                where: { barcode: locBarcode },
                create: {
                  shelfId: shelf.id,
                  levelId: level.id,
                  name: locName,
                  barcode: locBarcode
                },
                update: { levelId: level.id }
              });
              locationsCreated += 1;
            }
          }
        }
      }
    });

    const result = {
      message: `Template applied to ${room.name}. Generated ${rowsCreated} rows, ${racksCreated} racks, ${levelsCreated} levels and ${locationsCreated} locations.`,
      rowsCreated,
      racksCreated,
      levelsCreated,
      locationsCreated,
      roomId: room.id,
      warehouseId: room.warehouseId
    };

    await this.createAuditLog(
      userId,
      companyId,
      WorkflowAction.RACK_TEMPLATE_APPLIED,
      { templateId, roomId: room.id },
      result,
      room.warehouseId
    );

    return result;
  }

  static async applyTemplateLegacy(templateId: string, roomId: string, userId: string, companyId: string) {
    const room = await prisma.room.findUnique({ where: { id: roomId }, include: { warehouse: true } });
    if (!room) {
      throw new Error('Room not found');
    }
    return this.applyTemplate(templateId, companyId, userId, {
      warehouseId: room.warehouseId,
      roomId
    });
  }
}
