import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCode } from '../../lib/error-codes';
import { AuditService } from '../audit/audit.service';

export class ScanService {
  static async lookupBarcode(companyId: string, barcode: string) {
    const cleanBarcode = barcode ? barcode.trim().toUpperCase() : '';
    if (!cleanBarcode) {
      const error: AppError = new Error('Barcode is required');
      error.statusCode = 400;
      error.code = ErrorCode.VALIDATION_ERROR;
      throw error;
    }

    // Try to find as location first
    const location = await prisma.location.findFirst({
      where: {
        barcode: cleanBarcode,
        shelf: {
          rack: {
            room: {
              warehouse: {
                companyId,
                isActive: true
              }
            }
          }
        }
      },
      include: {
        shelf: {
          include: {
            rack: {
              include: {
                room: {
                  include: {
                    warehouse: {
                      include: {
                        site: {
                          include: {
                            branch: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (location) {
      // Get boxes at this location
      const boxes = await prisma.box.findMany({
        where: {
          currentLocationId: location.id,
          companyId,
          status: 'ACTIVE'
        },
        include: {
          _count: {
            select: { fileRecords: true }
          }
        }
      });

      return {
        entityType: 'LOCATION',
        entity: {
          barcode: location.barcode,
          code: location.name,
          label: location.name,
          status: location.isActive ? 'ACTIVE' : 'INACTIVE',
          capacity: 1, // Assuming 1 box per location for now
          occupied: location.isOccupied,
          locationBarcode: null
        },
        contents: boxes.map(box => ({
          id: box.id,
          barcode: box.barcode,
          label: box.description,
          status: box.status,
          fileCount: box._count.fileRecords
        })),
        path: [
          { type: 'location', name: location.name },
          { type: 'shelf', name: location.shelf.name },
          { type: 'rack', name: location.shelf.rack.name },
          { type: 'room', name: location.shelf.rack.room.name },
          { type: 'warehouse', name: location.shelf.rack.room.warehouse.name }
        ]
      };
    }

    // Try to find as box
    const box = await prisma.box.findFirst({
      where: {
        barcode: cleanBarcode,
        companyId,
        status: 'ACTIVE'
      },
      include: {
        currentLocation: {
          include: {
            shelf: {
              include: {
                rack: {
                  include: {
                    room: {
                      include: {
                        warehouse: {
                          include: {
                            site: {
                              include: {
                                branch: true
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        client: true,
        department: true,
        _count: {
          select: { fileRecords: true }
        }
      }
    });

    if (box) {
      // Get files in this box
      const files = await prisma.fileRecord.findMany({
        where: {
          boxId: box.id,
          status: 'ACTIVE'
        }
      });

      return {
        entityType: 'BOX',
        entity: {
          barcode: box.barcode,
          code: box.barcode,
          label: box.description,
          status: box.status,
          capacity: box.capacity,
          occupied: box._count.fileRecords,
          locationBarcode: box.currentLocation?.barcode || null
        },
        contents: files.map(file => ({
          id: file.id,
          barcode: file.barcode,
          label: file.title,
          status: file.status,
          fileCount: null
        })),
        path: box.currentLocation ? [
          { type: 'warehouse', name: box.currentLocation.shelf.rack.room.warehouse.name },
          { type: 'room', name: box.currentLocation.shelf.rack.room.name },
          { type: 'rack', name: box.currentLocation.shelf.rack.name },
          { type: 'shelf', name: box.currentLocation.shelf.name },
          { type: 'location', name: box.currentLocation.name }
        ] : []
      };
    }

    // Try to find as file
    const file = await prisma.fileRecord.findFirst({
      where: {
        barcode: cleanBarcode,
        box: {
          companyId,
          status: 'ACTIVE'
        }
      },
      include: {
        box: {
          include: {
            currentLocation: {
              include: {
                shelf: {
                  include: {
                    rack: {
                      include: {
                        room: {
                          include: {
                            warehouse: {
                              include: {
                                site: {
                                  include: {
                                    branch: true
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (file) {
      return {
        entityType: 'FILE',
        entity: {
          barcode: file.barcode,
          code: file.barcode,
          label: file.title,
          status: file.status,
          capacity: null,
          occupied: null,
          locationBarcode: file.box.currentLocation?.barcode || null,
          boxBarcode: file.box.barcode
        },
        contents: [],
        path: file.box.currentLocation ? [
          { type: 'warehouse', name: file.box.currentLocation.shelf.rack.room.warehouse.name },
          { type: 'room', name: file.box.currentLocation.shelf.rack.room.name },
          { type: 'rack', name: file.box.currentLocation.shelf.rack.name },
          { type: 'shelf', name: file.box.currentLocation.shelf.name },
          { type: 'location', name: file.box.currentLocation.name }
        ] : []
      };
    }

    // Try to find in BarcodeMaster
    const barcodeMaster = await prisma.barcodeMaster.findFirst({
      where: {
        barcode: cleanBarcode,
        companyId
      },
      include: {
        warehouse: true,
        site: true,
        branch: true
      }
    });

    if (barcodeMaster) {
      // If linked to Box
      if (barcodeMaster.type === 'BOX' || barcodeMaster.assignedToType === 'BOX') {
        let linkedBox = null;
        if (barcodeMaster.assignedToId) {
          linkedBox = await prisma.box.findFirst({
            where: { id: barcodeMaster.assignedToId, companyId },
            include: {
              currentLocation: {
                include: {
                  shelf: {
                    include: {
                      rack: {
                        include: {
                          room: {
                            include: {
                              warehouse: {
                                include: {
                                  site: {
                                    include: {
                                      branch: true
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              _count: { select: { fileRecords: true } }
            }
          });
        }

        if (linkedBox) {
          const files = await prisma.fileRecord.findMany({
            where: { boxId: linkedBox.id, status: 'ACTIVE' }
          });

          return {
            entityType: 'BOX',
            entity: {
              barcode: cleanBarcode,
              code: cleanBarcode,
              label: linkedBox.description || `Box ${cleanBarcode}`,
              status: linkedBox.status,
              capacity: linkedBox.capacity,
              occupied: linkedBox._count.fileRecords,
              locationBarcode: linkedBox.currentLocation?.barcode || null
            },
            contents: files.map(file => ({
              id: file.id,
              barcode: file.barcode,
              label: file.title,
              status: file.status,
              fileCount: null
            })),
            path: linkedBox.currentLocation ? [
              { type: 'warehouse', name: linkedBox.currentLocation.shelf.rack.room.warehouse.name },
              { type: 'room', name: linkedBox.currentLocation.shelf.rack.room.name },
              { type: 'rack', name: linkedBox.currentLocation.shelf.rack.name },
              { type: 'shelf', name: linkedBox.currentLocation.shelf.name },
              { type: 'location', name: linkedBox.currentLocation.name }
            ] : []
          };
        }

        // Return registered Box Barcode metadata
        return {
          entityType: 'BOX',
          entity: {
            barcode: cleanBarcode,
            code: cleanBarcode,
            label: barcodeMaster.remarks || `Box Barcode ${cleanBarcode}`,
            status: barcodeMaster.status,
            capacity: 25,
            occupied: 0,
            locationBarcode: null
          },
          contents: [],
          path: barcodeMaster.warehouse ? [
            { type: 'warehouse', name: barcodeMaster.warehouse.name }
          ] : []
        };
      }

      // If File Barcode in BarcodeMaster
      if (barcodeMaster.type === 'FILE_RECORD' || barcodeMaster.assignedToType === 'FILE_RECORD') {
        return {
          entityType: 'FILE',
          entity: {
            barcode: cleanBarcode,
            code: cleanBarcode,
            label: barcodeMaster.remarks || `File Barcode ${cleanBarcode}`,
            status: barcodeMaster.status,
            capacity: null,
            occupied: null,
            locationBarcode: null,
            boxBarcode: null
          },
          contents: [],
          path: []
        };
      }

      // If Location Barcode in BarcodeMaster
      if (barcodeMaster.type === 'LOCATION' || barcodeMaster.assignedToType === 'LOCATION') {
        return {
          entityType: 'LOCATION',
          entity: {
            barcode: cleanBarcode,
            code: cleanBarcode,
            label: barcodeMaster.remarks || `Location Barcode ${cleanBarcode}`,
            status: barcodeMaster.status,
            capacity: 1,
            occupied: false,
            locationBarcode: null
          },
          contents: [],
          path: []
        };
      }
    }

    // Not found
    const error: AppError = new Error(`Barcode '${cleanBarcode}' not found`);
    error.statusCode = 404;
    error.code = ErrorCode.BARCODE_UNKNOWN;
    throw error;
  }

  static async submitScan(
    companyId: string,
    userId: string,
    data: {
      clientOpId: string;
      barcode: string;
      latitude?: number;
      longitude?: number;
      scannedAt?: string;
    },
    deviceId?: string | null
  ) {
    const cleanBarcode = data.barcode ? data.barcode.trim().toUpperCase() : '';

    // Resolve entity for exact audit mapping
    const [box, file, location, barcodeMaster] = await Promise.all([
      prisma.box.findFirst({
        where: { companyId, barcode: cleanBarcode },
        include: { currentLocation: { include: { shelf: { include: { rack: { include: { room: { include: { warehouse: true } } } } } } } } }
      }),
      prisma.fileRecord.findFirst({
        where: { companyId, barcode: cleanBarcode },
        include: { box: { include: { currentLocation: { include: { shelf: { include: { rack: { include: { room: { include: { warehouse: true } } } } } } } } } } }
      }),
      prisma.location.findFirst({
        where: {
          barcode: cleanBarcode,
          shelf: { rack: { room: { warehouse: { companyId } } } }
        },
        include: { shelf: { include: { rack: { include: { room: { include: { warehouse: true } } } } } } }
      }),
      prisma.barcodeMaster.findFirst({
        where: { companyId, barcode: cleanBarcode },
        include: { warehouse: true }
      })
    ]);

    let resolvedEntityType: string = 'BARCODE';
    let resolvedEntityId: string | null = null;
    let boxId: string | null = null;
    let fileRecordId: string | null = null;
    let locationId: string | null = null;
    let warehouseId: string | null = null;

    if (box) {
      resolvedEntityType = 'BOX';
      resolvedEntityId = box.id;
      boxId = box.id;
      locationId = box.currentLocationId;
      warehouseId = box.currentLocation?.shelf?.rack?.room?.warehouse?.id || null;
    } else if (file) {
      resolvedEntityType = 'FILE_RECORD';
      resolvedEntityId = file.id;
      fileRecordId = file.id;
      boxId = file.boxId;
      locationId = file.box?.currentLocationId || null;
      warehouseId = file.box?.currentLocation?.shelf?.rack?.room?.warehouse?.id || null;
    } else if (location) {
      resolvedEntityType = 'LOCATION';
      resolvedEntityId = location.id;
      locationId = location.id;
      warehouseId = location.shelf?.rack?.room?.warehouse?.id || null;
    } else if (barcodeMaster) {
      resolvedEntityType = barcodeMaster.type === 'BOX' ? 'BOX' : barcodeMaster.type === 'FILE_RECORD' ? 'FILE_RECORD' : 'LOCATION';
      resolvedEntityId = barcodeMaster.assignedToId || barcodeMaster.id;
      if (barcodeMaster.type === 'BOX') boxId = barcodeMaster.assignedToId;
      if (barcodeMaster.type === 'FILE_RECORD') fileRecordId = barcodeMaster.assignedToId;
      warehouseId = barcodeMaster.warehouseId || null;
    }

    await AuditService.recordAuditLog({
      companyId,
      userId,
      action: 'INVENTORY_VERIFY',
      entityType: resolvedEntityType,
      entityId: resolvedEntityId,
      boxId,
      fileRecordId,
      locationId,
      warehouseId,
      deviceId: deviceId || null,
      gpsLat: data.latitude,
      gpsLng: data.longitude,
      newState: {
        action: 'SCAN',
        barcode: cleanBarcode,
        clientOpId: data.clientOpId,
        entityType: resolvedEntityType,
        entityId: resolvedEntityId,
        scannedAt: data.scannedAt || new Date().toISOString()
      }
    });

    return {
      id: crypto.randomUUID(),
      clientOpId: data.clientOpId,
      barcode: cleanBarcode,
      scannedAt: data.scannedAt || new Date().toISOString(),
      processed: true
    };
  }
}
