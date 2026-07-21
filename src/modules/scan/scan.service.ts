import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCode } from '../../lib/error-codes';

export class ScanService {
  static async lookupBarcode(companyId: string, barcode: string) {
    // Try to find as location first
    const location = await prisma.location.findFirst({
      where: {
        barcode,
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
        barcode,
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
          capacity: null,
          occupied: null,
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
        barcode,
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

    // Not found
    const error: AppError = new Error(`Barcode '${barcode}' not found`);
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
    }
  ) {
    // For now, just return success - actual scan processing would be handled by workflows
    return {
      id: crypto.randomUUID(),
      clientOpId: data.clientOpId,
      barcode: data.barcode,
      scannedAt: data.scannedAt || new Date().toISOString(),
      processed: true
    };
  }
}
