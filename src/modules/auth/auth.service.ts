import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'rms_super_secret_jwt_key_123';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

export class AuthService {
  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true }
    });

    if (!user) {
      const error: AppError = new Error('Invalid email or password');
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

    const accessToken = jwt.sign(
      { userId: user.id, companyId: user.companyId, roleId: user.roleId },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshTokenString = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Store refresh token hash
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY);
    const tokenHash = cryptoTokenHash(refreshTokenString);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    return {
      accessToken,
      refreshToken: refreshTokenString,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role.name
      }
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
      const error: AppError = new Error('Refresh token expired or revoked');
      error.statusCode = 401;
      error.code = ErrorCode.TOKEN_EXPIRED;
      throw error;
    }

    // Token rotation: revoke current token
    await prisma.refreshToken.update({
      where: { id: savedToken.id },
      data: { revoked: true }
    });

    // Generate new pair
    const accessToken = jwt.sign(
      { userId: savedToken.user.id, companyId: savedToken.user.companyId, roleId: savedToken.user.roleId },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const newRefreshToken = jwt.sign(
      { userId: savedToken.user.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY);
    const newHash = cryptoTokenHash(newRefreshToken);

    await prisma.refreshToken.create({
      data: {
        userId: savedToken.user.id,
        tokenHash: newHash,
        expiresAt
      }
    });

    return {
      accessToken,
      refreshToken: newRefreshToken
    };
  }

  static async logout(refreshTokenStr: string) {
    const tokenHash = cryptoTokenHash(refreshTokenStr);
    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revoked: true }
    });
  }

  static async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        },
        company: true
      }
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      error.code = ErrorCode.USER_NOT_FOUND;
      throw error;
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      employeeCode: user.employeeCode,
      status: user.status,
      company: {
        id: user.company.id,
        name: user.company.name,
        code: user.company.code
      },
      role: {
        id: user.role.id,
        name: user.role.name,
        label: user.role.label,
        permissions: user.role.permissions.map(rp => rp.permission.key)
      }
    };
  }

  static async deviceBind(userId: string, companyId: string, serialNumber: string, model: string) {
    // Find device in DB
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

    // Bind device to current user
    const updatedDevice = await prisma.device.update({
      where: { id: device.id },
      data: {
        assignedUserId: userId,
        lastSeenAt: new Date(),
        model // update model if it changed
      }
    });

    return updatedDevice;
  }
}

// Simple deterministic hash for tokens
function cryptoTokenHash(token: string): string {
  // Use simple base64 hash or similar in absence of crypto.createHash
  // For production compatibility, Node.js 'crypto' module is preferred.
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}
