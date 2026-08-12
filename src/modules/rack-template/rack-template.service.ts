import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';

export class RackTemplateService {
  static async listTemplates(companyId: string) {
    return prisma.rackTemplate.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createTemplate(companyId: string, data: {
    name: string;
    code: string;
    description?: string;
    rowsCount?: number;
    racksCount?: number;
    levelsCount?: number;
    locRows?: number;
    locCols?: number;
  }) {
    const existing = await prisma.rackTemplate.findFirst({
      where: { companyId, code: data.code }
    });
    if (existing) {
      throw new Error(`Rack template with code '${data.code}' already exists`);
    }

    return prisma.rackTemplate.create({
      data: {
        companyId,
        name: data.name,
        code: data.code,
        description: data.description,
        rowsCount: data.rowsCount || 1,
        racksCount: data.racksCount || 1,
        levelsCount: data.levelsCount || 1,
        locRows: data.locRows || 3,
        locCols: data.locCols || 3,
      }
    });
  }

  static async updateTemplate(id: string, data: Partial<{
    name: string;
    description: string;
    rowsCount: number;
    racksCount: number;
    levelsCount: number;
    locRows: number;
    locCols: number;
  }>) {
    return prisma.rackTemplate.update({
      where: { id },
      data
    });
  }

  static async deleteTemplate(id: string) {
    return prisma.rackTemplate.delete({
      where: { id }
    });
  }

  /**
   * Apply Template to Room: Dynamically generates Rows, Racks, Levels, Shelves & Locations
   */
  static async applyTemplate(templateId: string, roomId: string) {
    const template = await prisma.rackTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new Error('Rack template not found');

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { warehouse: true }
    });
    if (!room) throw new Error('Room not found');

    const generatedLocations: any[] = [];

    // Transactional auto-generation
    await prisma.$transaction(async (tx) => {
      for (let r = 1; r <= template.rowsCount; r++) {
        const rowCode = `R${String(r).padStart(2, '0')}`;
        const row = await tx.row.upsert({
          where: { roomId_code: { roomId, code: rowCode } },
          create: { roomId, name: `Row ${r}`, code: rowCode },
          update: {}
        });

        for (let k = 1; k <= template.racksCount; k++) {
          const rackCode = `RK${String(k).padStart(2, '0')}`;
          const rack = await tx.rack.upsert({
            where: { roomId_code: { roomId, code: rackCode } },
            create: { roomId, rowId: row.id, name: `Rack ${k}`, code: rackCode, barcode: `${room.code}-${rowCode}-${rackCode}` },
            update: { rowId: row.id }
          });

          // Ensure default Shelf for backward compatibility
          const shelf = await tx.shelf.upsert({
            where: { rackId_code: { rackId: rack.id, code: 'S1' } },
            create: { rackId: rack.id, name: 'Default Shelf', code: 'S1' },
            update: {}
          });

          for (let l = 1; l <= template.levelsCount; l++) {
            const levelCode = `L${String(l).padStart(2, '0')}`;
            const level = await tx.level.upsert({
              where: { rackId_code: { rackId: rack.id, code: levelCode } },
              create: { rackId: rack.id, name: `Level ${l}`, code: levelCode },
              update: {}
            });

            // Grid Locations: e.g. 3x3 = 9 locations per level
            for (let lr = 1; lr <= template.locRows; lr++) {
              for (let lc = 1; lc <= template.locCols; lc++) {
                const locName = `P${lr}-${lc}`;
                const locBarcode = `${room.code}-${rowCode}-${rackCode}-${levelCode}-P${lr}${lc}`;
                
                const loc = await tx.location.upsert({
                  where: { barcode: locBarcode },
                  create: {
                    shelfId: shelf.id,
                    levelId: level.id,
                    name: locName,
                    barcode: locBarcode
                  },
                  update: { levelId: level.id }
                });

                generatedLocations.push(loc);
              }
            }
          }
        }
      }
    });

    return {
      message: `Template applied successfully! Generated structure for ${template.rowsCount} rows, ${template.racksCount} racks, ${template.levelsCount} levels.`,
      locationsGenerated: generatedLocations.length
    };
  }
}
