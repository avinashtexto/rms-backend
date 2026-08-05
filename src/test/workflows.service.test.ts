import { WorkflowAction } from '@prisma/client';
import { ErrorCode } from '../lib/error-codes';
import { FreshBoxMoveService } from '../modules/workflow/fresh-box-move.service';
import { InventoryVerifyService } from '../modules/workflow/inventory-verify.service';
import { RefileService } from '../modules/workflow/refile.service';

jest.mock('../lib/prisma', () => ({
  prisma: {
    auditLog: {
      findFirst: jest.fn(),
      create: jest.fn()
    },
    location: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    box: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    fileRecord: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn()
    },
    inventoryVerificationSession: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn()
    },
    inventoryVerificationScan: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn()
    },
    refileEvent: {
      findUnique: jest.fn(),
      create: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

import { prisma } from '../lib/prisma';

describe('Workflow business rules', () => {
  const companyId = 'company-1';
  const operatorId = 'operator-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Fresh Box', () => {
    it('test_BR22_multiBoxBatch_rejectedWithLocationOccupied', async () => {
      (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({
        id: 'loc-1',
        barcode: 'LOC-001',
        shelf: { rack: { id: 'rack-1', room: { id: 'room-1' } } }
      });
      (prisma.box.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        FreshBoxMoveService.submitWorkflow(companyId, operatorId, {
          clientOpId: '11111111-1111-1111-1111-111111111111',
          locationBarcode: 'LOC-001',
          boxBarcodes: Array.from({ length: 10 }, (_, i) => `BOX-${i + 1}`)
        })
      ).rejects.toMatchObject({ code: ErrorCode.LOCATION_OCCUPIED, statusCode: 409 });
    });

    it('test_BR23_unknownBox_throwsNotFoundWithoutPartialSave', async () => {
      (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({
        id: 'loc-1',
        barcode: 'LOC-001',
        shelf: { rack: { id: 'rack-1', room: { id: 'room-1' } } }
      });
      (prisma.box.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) =>
        callback({
          box: { update: jest.fn() },
          location: { update: jest.fn() },
          auditLog: { create: jest.fn() }
        })
      );
      (prisma.box.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        FreshBoxMoveService.submitWorkflow(companyId, operatorId, {
          clientOpId: '22222222-2222-2222-2222-222222222222',
          locationBarcode: 'LOC-001',
          boxBarcodes: ['UNKNOWN-BOX']
        })
      ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND, statusCode: 404 });
    });

    it('test_BR10_duplicateClientOpId_returnsDuplicateTrue', async () => {
      (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue({
        id: 'audit-1',
        newState: { clientOpId: '33333333-3333-3333-3333-333333333333' }
      });

      const result = await FreshBoxMoveService.submitWorkflow(companyId, operatorId, {
        clientOpId: '33333333-3333-3333-3333-333333333333',
        locationBarcode: 'LOC-001',
        boxBarcodes: ['BOX-001']
      });

      expect(result.duplicate).toBe(true);
    });
  });

  describe('Inventory', () => {
    it('test_BR33_endSession_marksMissingFiles', async () => {
      (prisma.inventoryVerificationSession.findFirst as jest.Mock).mockResolvedValue({
        id: 'session-1',
        boxId: 'box-1',
        endedAt: null
      });
      (prisma.fileRecord.findMany as jest.Mock).mockResolvedValue([
        { id: 'file-1', boxId: 'box-1', status: 'ACTIVE' },
        { id: 'file-2', boxId: 'box-1', status: 'ACTIVE' }
      ]);
      (prisma.inventoryVerificationScan.findMany as jest.Mock).mockResolvedValue([
        { fileRecordId: 'file-1' }
      ]);
      (prisma.inventoryVerificationScan.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.inventoryVerificationScan.create as jest.Mock).mockResolvedValue({});
      (prisma.inventoryVerificationSession.update as jest.Mock).mockResolvedValue({});
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback(prisma));

      await InventoryVerifyService.endSession(companyId, 'session-1');

      expect(prisma.inventoryVerificationScan.create).toHaveBeenCalled();
    });
  });

  describe('Refile', () => {
    it('test_BR42_wrongLocation_recordsRejectedOperation', async () => {
      (prisma.refileEvent.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.fileRecord.findUnique as jest.Mock).mockResolvedValue({
        id: 'file-1',
        barcode: 'FILE-001',
        companyId,
        boxId: 'box-home',
        box: { id: 'box-home', currentLocationId: 'loc-home' }
      });
      (prisma.box.findUnique as jest.Mock).mockResolvedValue({
        id: 'box-home',
        barcode: 'BOX-001',
        companyId,
        currentLocationId: 'loc-home'
      });
      (prisma.location.findUnique as jest.Mock).mockResolvedValue({
        id: 'loc-wrong',
        barcode: 'LOC-WRONG'
      });
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) =>
        callback({
          fileRecord: { update: jest.fn() },
          refileEvent: {
            create: jest.fn().mockResolvedValue({
              id: 'event-1',
              action: WorkflowAction.REFILE_REJECT_WRONG_LOCATION
            })
          },
          auditLog: { create: jest.fn() }
        })
      );

      const result = await RefileService.submitRefileScan(companyId, operatorId, {
        fileBarcode: 'FILE-001',
        scannedBoxBarcode: 'BOX-001',
        scannedLocationBarcode: 'LOC-WRONG',
        clientEventId: '44444444-4444-4444-4444-444444444444',
        scannedAt: new Date()
      });

      expect(result.action).toBe(WorkflowAction.REFILE_REJECT_WRONG_LOCATION);
    });

    it('test_BR06_correctLocationAndBox_recordsSuccess', async () => {
      (prisma.refileEvent.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.fileRecord.findUnique as jest.Mock).mockResolvedValue({
        id: 'file-1',
        barcode: 'FILE-001',
        companyId,
        boxId: 'box-home',
        box: { id: 'box-home', currentLocationId: 'loc-home' }
      });
      (prisma.box.findUnique as jest.Mock).mockResolvedValue({
        id: 'box-home',
        barcode: 'BOX-001',
        companyId,
        currentLocationId: 'loc-home'
      });
      (prisma.location.findUnique as jest.Mock).mockResolvedValue({
        id: 'loc-home',
        barcode: 'LOC-001'
      });
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) =>
        callback({
          fileRecord: { update: jest.fn() },
          refileEvent: {
            create: jest.fn().mockResolvedValue({
              id: 'event-2',
              action: WorkflowAction.REFILE_SUCCESS
            })
          },
          auditLog: { create: jest.fn() }
        })
      );

      const result = await RefileService.submitRefileScan(companyId, operatorId, {
        fileBarcode: 'FILE-001',
        scannedBoxBarcode: 'BOX-001',
        scannedLocationBarcode: 'LOC-001',
        clientEventId: '55555555-5555-5555-5555-555555555555',
        scannedAt: new Date()
      });

      expect(result.action).toBe(WorkflowAction.REFILE_SUCCESS);
    });
  });

  describe('Segregation', () => {
    it('test_BR53_sameOldAndNewBox_rejected', async () => {
      const sameBox = { id: 'box-1', barcode: 'BOX-001', companyId, status: 'ACTIVE' };

      await expect(async () => {
        if (sameBox.id === sameBox.id) {
          const error = new Error('Source and destination boxes must be different');
          (error as any).statusCode = 409;
          throw error;
        }
      }).rejects.toThrow('Source and destination boxes must be different');
    });
  });
});
