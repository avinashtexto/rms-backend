import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { randomUUID } from 'crypto';

interface ReportJob {
  id: string;
  type: 'BOX_INVENTORY' | 'USER_WORKLOAD' | 'CUSTODY_HISTORY';
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  companyId: string;
  csvData?: string;
  createdAt: Date;
}

// In-memory Job cache tracker
const reportJobsCache = new Map<string, ReportJob>();

export class ReportService {
  static async generateReport(companyId: string, type: 'BOX_INVENTORY' | 'USER_WORKLOAD' | 'CUSTODY_HISTORY') {
    const jobId = randomUUID();
    const job: ReportJob = {
      id: jobId,
      type,
      status: 'PENDING',
      companyId,
      createdAt: new Date()
    };

    reportJobsCache.set(jobId, job);

    // Trigger async generation thread
    this.processReportGeneration(jobId).catch((err) => {
      console.error(`Error in async report job ${jobId}:`, err);
    });

    return {
      jobId,
      type,
      status: 'PENDING',
      createdAt: job.createdAt
    };
  }

  static async getJobStatus(companyId: string, jobId: string) {
    const job = reportJobsCache.get(jobId);
    if (!job || job.companyId !== companyId) {
      const error: AppError = new Error('Report job not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return {
      jobId: job.id,
      type: job.type,
      status: job.status,
      createdAt: job.createdAt
    };
  }

  static async downloadReport(companyId: string, jobId: string) {
    const job = reportJobsCache.get(jobId);
    if (!job || job.companyId !== companyId) {
      const error: AppError = new Error('Report job not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    if (job.status === 'PENDING') {
      const error: AppError = new Error('Report generation is still in progress');
      error.statusCode = 400;
      error.code = ErrorCode.VALIDATION_ERROR;
      throw error;
    }

    if (job.status === 'FAILED') {
      const error: AppError = new Error('Report generation failed');
      error.statusCode = 500;
      error.code = ErrorCode.INTERNAL_SERVER_ERROR;
      throw error;
    }

    return job.csvData || '';
  }

  static async listReports(companyId: string) {
    const list = Array.from(reportJobsCache.values())
      .filter((j) => j.companyId === companyId)
      .map((j) => ({
        jobId: j.id,
        type: j.type,
        status: j.status,
        createdAt: j.createdAt
      }));
    return list;
  }

  // Private async processor
  private static async processReportGeneration(jobId: string) {
    // Wait for 1.5 seconds to simulate async job
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const job = reportJobsCache.get(jobId);
    if (!job) return;

    try {
      let csv = '';

      if (job.type === 'BOX_INVENTORY') {
        const boxes = await prisma.box.findMany({
          where: { companyId: job.companyId },
          include: { client: true, department: true, currentLocation: true }
        });

        csv = 'Barcode,Client,Department,Location,Status,Created At\n';
        for (const box of boxes) {
          csv += `"${box.barcode}","${box.client.name}","${box.department?.name || 'N/A'}","${box.currentLocation?.barcode || 'N/A'}","${box.status}","${box.createdAt.toISOString()}"\n`;
        }
      } else if (job.type === 'USER_WORKLOAD') {
        const users = await prisma.user.findMany({
          where: { companyId: job.companyId },
          include: {
            _count: {
              select: {
                freshBoxMoveScans: true,
                inventoryVerificationSessions: true,
                refileEvents: true
              }
            }
          }
        });

        csv = 'Employee Code,Full Name,Email,Fresh Box Move Scans,Inventory Verification Sessions,Refile Events\n';
        for (const u of users) {
          csv += `"${u.employeeCode}","${u.fullName}","${u.email}",${u._count.freshBoxMoveScans},${u._count.inventoryVerificationSessions},${u._count.refileEvents}\n`;
        }
      } else if (job.type === 'CUSTODY_HISTORY') {
        const logs = await prisma.auditLog.findMany({
          where: { companyId: job.companyId },
          include: { user: true },
          orderBy: { createdAt: 'desc' },
          take: 100
        });

        csv = 'Date,Operator,Action,Box ID,File ID,Details\n';
        for (const log of logs) {
          const detailStr = log.newState ? JSON.stringify(log.newState).replace(/"/g, '""') : '';
          csv += `"${log.createdAt.toISOString()}","${log.user.fullName}","${log.action}","${log.boxId || ''}","${log.fileRecordId || ''}","${detailStr}"\n`;
        }
      }

      job.csvData = csv;
      job.status = 'COMPLETED';
      reportJobsCache.set(jobId, job);
    } catch (error) {
      job.status = 'FAILED';
      reportJobsCache.set(jobId, job);
      throw error;
    }
  }
}
