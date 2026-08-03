import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export interface ImportActor {
  id: string;
  companyId: string;
}

type SegregationPlanItem = {
  id: string;
  companyId: string;
  oldBoxBarcode: string;
  fileBarcode: string;
  isDone: boolean;
  createdAt: string;
};

const segregationPlans = new Map<string, SegregationPlanItem[]>();

function importError(row: number, message: string): AppError {
  const error: AppError = new Error(`Row ${row}: ${message}`);
  error.statusCode = 400;
  error.code = ErrorCode.VALIDATION_ERROR;
  return error;
}

export class ImportsService {
  static async importRecords(
    rows: Array<{
      clientCode?: string;
      clientName?: string;
      locationBarcode?: string;
      boxBarcode: string;
      fileBarcode?: string;
    }>,
    actor: ImportActor
  ) {
    let boxesCreated = 0;
    let filesCreated = 0;
    let clientsCreated = 0;

    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const rowNum = index + 1;

        if (!row.boxBarcode) {
          throw importError(rowNum, 'boxBarcode is required');
        }

        let client = null as { id: string } | null;

        if (row.clientCode) {
          let created = false;
          client = await tx.client.findFirst({
            where: { companyId: actor.companyId, code: row.clientCode },
          });
          if (!client) {
            if (!row.clientName) {
              throw importError(rowNum, `Client code '${row.clientCode}' not found`);
            }
            client = await tx.client.create({
              data: {
                companyId: actor.companyId,
                code: row.clientCode,
                name: row.clientName,
              },
            });
            created = true;
          }
          if (created) clientsCreated += 1;
        } else if (row.clientName) {
          const code = row.clientName
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_')
            .slice(0, 20);
          const existing = await tx.client.findFirst({
            where: { companyId: actor.companyId, code },
          });
          if (existing) {
            client = existing;
          } else {
            client = await tx.client.create({
              data: {
                companyId: actor.companyId,
                code,
                name: row.clientName,
              },
            });
            clientsCreated += 1;
          }
        } else {
          client = await tx.client.findFirst({
            where: { companyId: actor.companyId },
            orderBy: { createdAt: 'asc' },
          });
          if (!client) {
            throw importError(rowNum, 'No client available — provide clientCode or clientName');
          }
        }

        let locationId: string | null = null;
        if (row.locationBarcode) {
          const location = await tx.location.findFirst({
            where: {
              barcode: row.locationBarcode,
              shelf: {
                rack: {
                  room: {
                    warehouse: { companyId: actor.companyId },
                  },
                },
              },
            },
          });
          if (!location) {
            throw importError(rowNum, `Location barcode '${row.locationBarcode}' not found`);
          }
          locationId = location.id;
        }

        const existingBox = await tx.box.findFirst({
          where: { companyId: actor.companyId, barcode: row.boxBarcode },
        });

        let boxId: string;
        if (existingBox) {
          boxId = existingBox.id;
          if (locationId && existingBox.currentLocationId !== locationId) {
            await tx.box.update({
              where: { id: existingBox.id },
              data: { currentLocationId: locationId },
            });
          }
        } else {
          const created = await tx.box.create({
            data: {
              companyId: actor.companyId,
              clientId: client.id,
              barcode: row.boxBarcode,
              currentLocationId: locationId,
            },
          });
          boxId = created.id;
          boxesCreated += 1;
        }

        if (row.fileBarcode) {
          const existingFile = await tx.fileRecord.findFirst({
            where: { barcode: row.fileBarcode },
          });
          if (existingFile) {
            if (existingFile.companyId !== actor.companyId) {
              throw importError(rowNum, `File barcode '${row.fileBarcode}' belongs to another company`);
            }
            continue;
          }
          await tx.fileRecord.create({
            data: {
              companyId: actor.companyId,
              boxId,
              barcode: row.fileBarcode,
            },
          });
          filesCreated += 1;
        }
      }
    });

    return { boxesCreated, filesCreated, clientsCreated };
  }

  static importSegregationPlan(
    rows: Array<{ oldBoxBarcode: string; fileBarcode: string }>,
    actor: ImportActor
  ) {
    const existing = segregationPlans.get(actor.companyId) || [];
    const created = rows.map((row) => ({
      id: randomUUID(),
      companyId: actor.companyId,
      oldBoxBarcode: row.oldBoxBarcode,
      fileBarcode: row.fileBarcode,
      isDone: false,
      createdAt: new Date().toISOString(),
    }));

    segregationPlans.set(actor.companyId, [...existing, ...created]);
    return { planned: created.length };
  }

  static listSegregationPlan(actor: ImportActor) {
    return segregationPlans.get(actor.companyId) || [];
  }
}
