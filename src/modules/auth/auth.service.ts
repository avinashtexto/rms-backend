import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Prisma, RoleName, WorkflowAction } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import {
  SessionContext,
  SessionScopeOptions,
  loadUserForSession,
  getPermissionsForRole,
  getAccessibleWarehouses,
  getAccessibleBranches,
  getAccessibleCompanies,
  resolveSessionContext,
  assertActiveCompany,
  assertActiveBranch,
  assertWarehouseAccess,
  mapCompanyRef,
  mapBranchRef,
  mapWarehouseRef
} from './auth.session';

const JWT_SECRET = process.env.JWT_SECRET || 'rms_super_secret_jwt_key_123';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

interface TokenPayload {
  userId: string;
  companyId: string;
  roleId: string;
  branchId?: string | null;
  warehouseId?: string | null;
  jti: string;
}

export class AuthService {
  private static signAccessToken(payload: Omit<TokenPayload, 'jti'>) {
    return jwt.sign(
      { ...payload, jti: crypto.randomUUID() },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
  }

  private static signRefreshToken(userId: string, session: SessionContext) {
    return jwt.sign(
      {
        userId,
        companyId: session.companyId,
        branchId: session.branchId,
        warehouseId: session.warehouseId,
        jti: crypto.randomUUID()
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  private static getAccessTokenExpiry(): string {
    const decoded = jwt.decode(
      jwt.sign({ exp: Math.floor(Date.now() / 1000) + 900 }, JWT_SECRET)
    ) as { exp: number };
    return new Date(decoded.exp * 1000).toISOString();
  }

  private static async writeAuthAudit(
    userId: string,
    companyId: string,
    action: WorkflowAction,
    previousState?: unknown,
    newState?: unknown,
    warehouseId?: string | null,
    branchId?: string | null
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action,
          warehouseId: warehouseId ?? undefined,
          branchId: branchId ?? undefined,
          previousState: previousState as Prisma.InputJsonValue,
          newState: newState as Prisma.InputJsonValue
        }
      });
    } catch (err) {
      console.error('Failed to write auth audit log', err);
    }
  }

  private static async buildSessionResponse(
    userId: string,
    session: SessionContext,
    options?: { skipAudit?: boolean; auditAction?: WorkflowAction }
  ) {
    const user = await loadUserForSession(userId);
    if (!user || user.status !== 'ACTIVE') {
      const error: AppError = new Error('User not found or inactive');
      error.statusCode = 401;
      error.code = ErrorCode.UNAUTHORIZED;
      throw error;
    }

    const company = await assertActiveCompany(session.companyId);
    const permissions = await getPermissionsForRole(user.roleId);

    const warehouses = await getAccessibleWarehouses(user, session.companyId, session.branchId);
    const warehouseRecord = warehouses.find((w) => w.id === session.warehouseId);
    if (!warehouseRecord) {
      const error: AppError = new Error('Active warehouse not found in session');
      error.statusCode = 403;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }

    let branchRecord = null;
    if (session.branchId) {
      branchRecord = await assertActiveBranch(session.branchId, session.companyId);
    } else if (warehouseRecord.site?.branch) {
      branchRecord = warehouseRecord.site.branch;
      session = { ...session, branchId: branchRecord.id };
    }

    const availableCompanies = await getAccessibleCompanies(user);
    const availableBranches = await getAccessibleBranches(user, session.companyId);
    const availableWarehouses = await getAccessibleWarehouses(
      user,
      session.companyId,
      session.branchId
    );

    const accessToken = AuthService.signAccessToken({
      userId: user.id,
      companyId: session.companyId,
      roleId: user.roleId,
      branchId: session.branchId,
      warehouseId: session.warehouseId
    });

    const refreshToken = AuthService.signRefreshToken(user.id, session);
    const expiresAt = AuthService.getAccessTokenExpiry();

    const tokenHash = cryptoTokenHash(refreshToken);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY)
      }
    });

    const warehousesList = warehouses.map((w) => ({
      id: w.id,
      code: w.code,
      name: w.name
    }));

    const response = {
      accessToken,
      refreshToken,
      expiresAt,
      user: {
        id: user.id,
        employeeCode: user.employeeCode,
        name: user.fullName,
        email: user.email,
        mobile: user.phone,
        username: user.email,
        fullName: user.fullName,
        role: user.role.name,
        permissions,
        warehouses: warehousesList
      },
      company: mapCompanyRef(company),
      branch: branchRecord ? mapBranchRef(branchRecord) : null,
      warehouse: mapWarehouseRef(warehouseRecord),
      permissions,
      availableCompanies: availableCompanies.map(mapCompanyRef),
      availableBranches: availableBranches.map(mapBranchRef),
      availableWarehouses: availableWarehouses.map(mapWarehouseRef)
    };

    if (!options?.skipAudit && options?.auditAction) {
      await AuthService.writeAuthAudit(
        user.id,
        session.companyId,
        options.auditAction,
        undefined,
        {
          companyId: session.companyId,
          branchId: session.branchId,
          warehouseId: session.warehouseId
        },
        session.warehouseId,
        session.branchId
      );
    }

    return response;
  }

  static async login(identifier: string, password: string, device?: { serialNumber: string; model: string; appVersion: string }) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.trim().toLowerCase() },
          { employeeCode: { equals: identifier.trim(), mode: 'insensitive' } }
        ]
      },
      include: { role: true }
    });

    if (!user) {
      const error: AppError = new Error('Invalid username or password');
      error.statusCode = 401;
      error.code = ErrorCode.INVALID_CREDENTIALS;
      throw error;
    }

    if (user.status === 'SUSPENDED') {
      const error: AppError = new Error('User account is suspended');
      error.statusCode = 401;
      error.code = ErrorCode.UNAUTHORIZED;
      throw error;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const error: AppError = new Error('Invalid email or password');
      error.statusCode = 401;
      error.code = ErrorCode.INVALID_CREDENTIALS;
      throw error;
    }

    let deviceId = null;
    if (device) {
      const deviceRecord = await prisma.device.upsert({
        where: { serialNumber: device.serialNumber },
        update: {
          model: device.model,
          appVersion: device.appVersion,
          lastSeenAt: new Date(),
          assignedUserId: user.id
        },
        create: {
          serialNumber: device.serialNumber,
          model: device.model,
          appVersion: device.appVersion,
          companyId: user.companyId,
          status: 'APPROVED',
          isActive: true,
          lastSeenAt: new Date(),
          assignedUserId: user.id
        }
      });

      if (!deviceRecord.isActive || deviceRecord.status === 'BLOCKED') {
        const error: AppError = new Error('This device has been deactivated and cannot log in');
        error.statusCode = 403;
        error.code = ErrorCode.DEVICE_BLOCKED;
        throw error;
      }

      deviceId = deviceRecord.id;
    }

    const fullUser = await loadUserForSession(user.id);
    if (!fullUser) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    const session = await resolveSessionContext(fullUser);
    const result = await AuthService.buildSessionResponse(user.id, session, {
      auditAction: WorkflowAction.AUTH_LOGIN
    });

    return {
      ...result,
      deviceId
    };
  }

  static async refresh(refreshTokenStr: string) {
    let decoded: any;
    try {
      decoded = jwt.verify(refreshTokenStr, JWT_SECRET);
    } catch (err) {
      const error: AppError = new Error('Invalid refresh token');
      error.statusCode = 401;
      error.code = ErrorCode.INVALID_TOKEN;
      throw error;
    }

    const tokenHash = cryptoTokenHash(refreshTokenStr);
    const savedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { role: true } } }
    });

    if (!savedToken || savedToken.revoked || savedToken.expiresAt < new Date()) {
      if (savedToken?.userId) {
        await AuthService.writeAuthAudit(
          savedToken.userId,
          savedToken.user.companyId,
          WorkflowAction.AUTH_SESSION_EXPIRED,
          { reason: 'refresh_token_expired_or_revoked' }
        );
      }
      const error: AppError = new Error('Refresh token expired or revoked');
      error.statusCode = 401;
      error.code = ErrorCode.TOKEN_EXPIRED;
      throw error;
    }

    await prisma.refreshToken.update({
      where: { id: savedToken.id },
      data: { revoked: true }
    });

    const session: SessionContext = {
      companyId: decoded.companyId ?? savedToken.user.companyId,
      branchId: decoded.branchId ?? null,
      warehouseId: decoded.warehouseId ?? null
    };

    const fullUser = await loadUserForSession(savedToken.user.id);
    if (!fullUser) {
      const error: AppError = new Error('User not found');
      error.statusCode = 401;
      error.code = ErrorCode.UNAUTHORIZED;
      throw error;
    }

    const resolvedSession = await resolveSessionContext(fullUser, {
      companyId: session.companyId,
      branchId: session.branchId,
      warehouseId: session.warehouseId
    });

    const result = await AuthService.buildSessionResponse(savedToken.user.id, resolvedSession, {
      auditAction: WorkflowAction.AUTH_REFRESH
    });

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      company: result.company,
      branch: result.branch,
      warehouse: result.warehouse,
      permissions: result.permissions,
      user: result.user
    };
  }

  static async logout(refreshTokenStr: string, userId?: string) {
    const tokenHash = cryptoTokenHash(refreshTokenStr);
    const savedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revoked: true }
    });

    const auditUserId = userId ?? savedToken?.userId;
    const companyId = savedToken?.user?.companyId;
    if (auditUserId && companyId) {
      await AuthService.writeAuthAudit(auditUserId, companyId, WorkflowAction.AUTH_LOGOUT);
    }
  }

  static async me(userId: string, sessionFromToken?: SessionContext) {
    const user = await loadUserForSession(userId);
    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    const session = sessionFromToken
      ? await resolveSessionContext(user, {
          companyId: sessionFromToken.companyId,
          branchId: sessionFromToken.branchId,
          warehouseId: sessionFromToken.warehouseId
        })
      : await resolveSessionContext(user);

    const company = await assertActiveCompany(session.companyId);
    const permissions = await getPermissionsForRole(user.roleId);
    const warehouses = await getAccessibleWarehouses(user, session.companyId, session.branchId);
    const warehouseRecord = warehouses.find((w) => w.id === session.warehouseId)!;

    let branchRecord = null;
    if (session.branchId) {
      branchRecord = await assertActiveBranch(session.branchId, session.companyId);
    } else if (warehouseRecord.site?.branch) {
      branchRecord = warehouseRecord.site.branch;
    }

    const availableCompanies = await getAccessibleCompanies(user);
    const availableBranches = await getAccessibleBranches(user, session.companyId);
    const availableWarehouses = await getAccessibleWarehouses(
      user,
      session.companyId,
      session.branchId
    );

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      employeeCode: user.employeeCode,
      phone: user.phone,
      status: user.status,
      company: mapCompanyRef(company),
      branch: branchRecord ? mapBranchRef(branchRecord) : null,
      warehouse: mapWarehouseRef(warehouseRecord),
      permissions,
      role: {
        id: user.role.id,
        name: user.role.name,
        label: user.role.label,
        permissions
      },
      profile: {
        id: user.id,
        employeeCode: user.employeeCode,
        name: user.fullName,
        email: user.email,
        mobile: user.phone,
        role: user.role.name
      },
      availableCompanies: availableCompanies.map(mapCompanyRef),
      availableBranches: availableBranches.map(mapBranchRef),
      availableWarehouses: availableWarehouses.map(mapWarehouseRef),
      session: {
        companyId: session.companyId,
        branchId: session.branchId,
        warehouseId: session.warehouseId
      }
    };
  }

  static async getPermissions(userId: string, roleId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }
    const permissions = await getPermissionsForRole(roleId);
    return { permissions };
  }

  static async switchWarehouse(userId: string, warehouseId: string, currentSession: SessionContext) {
    const user = await loadUserForSession(userId);
    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    const previousSession = { ...currentSession };
    const warehouse = await assertWarehouseAccess(user, warehouseId, currentSession.companyId);
    const branchId = warehouse.site?.branchId ?? currentSession.branchId;

    const session = await resolveSessionContext(user, {
      companyId: currentSession.companyId,
      branchId,
      warehouseId
    });

    const result = await AuthService.buildSessionResponse(userId, session, { skipAudit: true });

    await AuthService.writeAuthAudit(
      userId,
      session.companyId,
      WorkflowAction.AUTH_SWITCH_WAREHOUSE,
      previousSession,
      session,
      session.warehouseId,
      session.branchId
    );

    return result;
  }

  static async switchBranch(userId: string, branchId: string, currentSession: SessionContext) {
    const user = await loadUserForSession(userId);
    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    const previousSession = { ...currentSession };
    await assertActiveBranch(branchId, currentSession.companyId);

    const warehousesInBranch = await getAccessibleWarehouses(user, currentSession.companyId, branchId);
    if (warehousesInBranch.length === 0) {
      const error: AppError = new Error('No warehouse access in selected branch');
      error.statusCode = 403;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }

    const warehouseId =
      currentSession.warehouseId && warehousesInBranch.some((w) => w.id === currentSession.warehouseId)
        ? currentSession.warehouseId
        : warehousesInBranch[0].id;

    const session = await resolveSessionContext(user, {
      companyId: currentSession.companyId,
      branchId,
      warehouseId
    });

    const result = await AuthService.buildSessionResponse(userId, session, { skipAudit: true });

    await AuthService.writeAuthAudit(
      userId,
      session.companyId,
      WorkflowAction.AUTH_SWITCH_BRANCH,
      previousSession,
      session,
      session.warehouseId,
      session.branchId
    );

    return result;
  }

  static async switchCompany(userId: string, companyId: string, currentSession: SessionContext) {
    const user = await loadUserForSession(userId);
    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    if (user.role.name !== RoleName.SUPER_ADMIN) {
      const error: AppError = new Error('Only super administrators can switch company');
      error.statusCode = 403;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }

    const previousSession = { ...currentSession };
    await assertActiveCompany(companyId);

    const session = await resolveSessionContext(user, { companyId });
    const result = await AuthService.buildSessionResponse(userId, session, { skipAudit: true });

    await AuthService.writeAuthAudit(
      userId,
      session.companyId,
      WorkflowAction.AUTH_SWITCH_COMPANY,
      previousSession,
      session,
      session.warehouseId,
      session.branchId
    );

    return result;
  }

  static async deviceBind(userId: string, companyId: string, serialNumber: string, model: string) {
    const device = await prisma.device.findUnique({
      where: { serialNumber }
    });

    if (!device) {
      const error: AppError = new Error('Device not registered. Please contact system admin.');
      error.statusCode = 400;
      error.code = ErrorCode.DEVICE_NOT_APPROVED;
      throw error;
    }

    if (device.companyId !== companyId) {
      const error: AppError = new Error('Device belongs to another tenant company.');
      error.statusCode = 400;
      error.code = ErrorCode.FORBIDDEN;
      throw error;
    }

    if (device.status !== 'APPROVED') {
      const error: AppError = new Error(`Device status is '${device.status}'. Only APPROVED devices can bind.`);
      error.statusCode = 400;
      error.code = device.status === 'BLOCKED' ? ErrorCode.DEVICE_BLOCKED : ErrorCode.DEVICE_NOT_APPROVED;
      throw error;
    }

    const updatedDevice = await prisma.device.update({
      where: { id: device.id },
      data: {
        assignedUserId: userId,
        lastSeenAt: new Date(),
        model
      }
    });

    return updatedDevice;
  }
}

function cryptoTokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
