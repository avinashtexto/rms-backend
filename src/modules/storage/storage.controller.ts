import { Response, NextFunction } from 'express';
import { StorageService } from './storage.service';
import {
  createRoomSchema, updateRoomSchema,
  createRackSchema, updateRackSchema,
  createShelfSchema, updateShelfSchema,
  createLocationSchema, updateLocationSchema
} from './storage.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class StorageController {
  // ==========================================
  // ROOMS
  // ==========================================
  
  static async listRooms(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const warehouseId = req.params.warehouseId as string;
      const rooms = await StorageService.listRooms(companyId, warehouseId);
      res.status(200).json({ success: true, data: rooms });
    } catch (error) {
      next(error);
    }
  }

  static async createRoom(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const warehouseId = req.params.warehouseId as string;
      const data = createRoomSchema.parse(req.body);
      const room = await StorageService.createRoom(companyId, warehouseId, data.name, data.code);
      res.status(201).json({ success: true, data: room });
    } catch (error) {
      next(error);
    }
  }

  static async updateRoom(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const roomId = req.params.roomId as string;
      const data = updateRoomSchema.parse(req.body);
      const room = await StorageService.updateRoom(companyId, roomId, data.name, data.isActive);
      res.status(200).json({ success: true, data: room });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // RACKS
  // ==========================================

  static async listRacks(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const roomId = req.params.roomId as string;
      const racks = await StorageService.listRacks(companyId, roomId);
      res.status(200).json({ success: true, data: racks });
    } catch (error) {
      next(error);
    }
  }

  static async createRack(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const roomId = req.params.roomId as string;
      const data = createRackSchema.parse(req.body);
      const rack = await StorageService.createRack(companyId, roomId, data.name, data.code);
      res.status(201).json({ success: true, data: rack });
    } catch (error) {
      next(error);
    }
  }

  static async updateRack(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const rackId = req.params.rackId as string;
      const data = updateRackSchema.parse(req.body);
      const rack = await StorageService.updateRack(companyId, rackId, data.name, data.isActive);
      res.status(200).json({ success: true, data: rack });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SHELVES
  // ==========================================

  static async listShelves(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const rackId = req.params.rackId as string;
      const shelves = await StorageService.listShelves(companyId, rackId);
      res.status(200).json({ success: true, data: shelves });
    } catch (error) {
      next(error);
    }
  }

  static async createShelf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const rackId = req.params.rackId as string;
      const data = createShelfSchema.parse(req.body);
      const shelf = await StorageService.createShelf(companyId, rackId, data.name, data.code);
      res.status(201).json({ success: true, data: shelf });
    } catch (error) {
      next(error);
    }
  }

  static async updateShelf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const shelfId = req.params.shelfId as string;
      const data = updateShelfSchema.parse(req.body);
      const shelf = await StorageService.updateShelf(companyId, shelfId, data.name, data.isActive);
      res.status(200).json({ success: true, data: shelf });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // LOCATIONS
  // ==========================================

  static async listLocations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const shelfId = req.params.shelfId as string;
      const locations = await StorageService.listLocations(companyId, shelfId);
      res.status(200).json({ success: true, data: locations });
    } catch (error) {
      next(error);
    }
  }

  static async createLocation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const shelfId = req.params.shelfId as string;
      const data = createLocationSchema.parse(req.body);
      const location = await StorageService.createLocation(companyId, shelfId, data.name, data.barcode);
      res.status(201).json({ success: true, data: location });
    } catch (error) {
      next(error);
    }
  }

  static async updateLocation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const locationId = req.params.locationId as string;
      const data = updateLocationSchema.parse(req.body);
      const location = await StorageService.updateLocation(
        companyId,
        locationId,
        data.name,
        data.isActive,
        data.isOccupied
      );
      res.status(200).json({ success: true, data: location });
    } catch (error) {
      next(error);
    }
  }

  static async resolveBarcode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const barcode = req.params.barcode as string;
      const location = await StorageService.resolveBarcode(companyId, barcode);
      res.status(200).json({ success: true, data: location });
    } catch (error) {
      next(error);
    }
  }
}
