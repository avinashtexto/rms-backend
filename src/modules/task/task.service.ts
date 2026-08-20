import { prisma } from '../../lib/prisma';
import { TaskType, TaskPriority, TaskStatus, RoleName } from '@prisma/client';

export class TaskService {
  /**
   * Helper to normalize barcode strings
   */
  private static cleanString(val?: string | null): string | null {
    if (!val) return null;
    const trimmed = val.trim().replace(/[\r\n\t]/g, '');
    return trimmed.length > 0 ? trimmed : null;
  }

  /**
   * Check if user is assigner role (SUPER_ADMIN, COMPANY_ADMIN, WAREHOUSE_MANAGER, SUPERVISOR)
   */
  public static isAssigner(roleName?: string): boolean {
    if (!roleName) return false;
    return ['SUPER_ADMIN', 'COMPANY_ADMIN', 'WAREHOUSE_MANAGER', 'SUPERVISOR'].includes(roleName.toUpperCase());
  }

  /**
   * Generate unique task number e.g. TSK-948102-123
   */
  private static generateTaskNumber(): string {
    const timePart = Date.now().toString().slice(-6);
    const randPart = Math.floor(100 + Math.random() * 900);
    return `TSK-${timePart}-${randPart}`;
  }

  /**
   * Create & Assign Task (Admin / Manager / Supervisor)
   */
  public static async createTask(data: {
    title: string;
    description?: string;
    taskType: TaskType;
    priority?: TaskPriority;
    assignedToId: string;
    warehouseId: string;
    boxBarcode?: string;
    fileBarcode?: string;
    sourceLocationBarcode?: string;
    destinationLocationBarcode?: string;
    dueDate?: string;
  }, currentUser: any) {
    if (!this.isAssigner(currentUser.role)) {
      throw new Error('UNAUTHORIZED_TASK_ASSIGNMENT: Only Managers and Supervisors can assign tasks.');
    }

    const companyId = currentUser.companyId;
    if (!companyId) {
      throw new Error('COMPANY_REQUIRED: User must belong to a company.');
    }

    // Verify assigned user exists and belongs to company
    const assignee = await prisma.user.findFirst({
      where: { id: data.assignedToId, companyId }
    });
    if (!assignee) {
      throw new Error('INVALID_ASSIGNEE: Assigned user not found in this company.');
    }

    // Verify warehouse exists
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: data.warehouseId }
    });
    if (!warehouse) {
      throw new Error('WAREHOUSE_NOT_FOUND: Specified warehouse does not exist.');
    }

    // Scope check: Warehouse Manager / Supervisor scope validation
    if (currentUser.role === 'WAREHOUSE_MANAGER' || currentUser.role === 'SUPERVISOR') {
      if (currentUser.warehouseId && currentUser.warehouseId !== data.warehouseId) {
        throw new Error('WAREHOUSE_ACCESS_DENIED: Cannot assign tasks outside your authorized warehouse.');
      }
    }

    // Resolve optional barcodes to database IDs
    let boxId: string | null = null;
    let fileId: string | null = null;
    let sourceLocationId: string | null = null;
    let destinationLocationId: string | null = null;

    const cleanBoxBarcode = this.cleanString(data.boxBarcode);
    if (cleanBoxBarcode) {
      const box = await prisma.box.findFirst({
        where: { OR: [{ id: cleanBoxBarcode }, { barcode: cleanBoxBarcode }] }
      });
      if (box) boxId = box.id;
    }

    const cleanFileBarcode = this.cleanString(data.fileBarcode);
    if (cleanFileBarcode) {
      const fileRec = await prisma.fileRecord.findFirst({
        where: { OR: [{ id: cleanFileBarcode }, { barcode: cleanFileBarcode }] }
      });
      if (fileRec) fileId = fileRec.id;
    }

    const cleanSrcLoc = this.cleanString(data.sourceLocationBarcode);
    if (cleanSrcLoc) {
      const loc = await prisma.location.findFirst({
        where: { OR: [{ id: cleanSrcLoc }, { barcode: cleanSrcLoc }] }
      });
      if (loc) sourceLocationId = loc.id;
    }

    const cleanDstLoc = this.cleanString(data.destinationLocationBarcode);
    if (cleanDstLoc) {
      const loc = await prisma.location.findFirst({
        where: { OR: [{ id: cleanDstLoc }, { barcode: cleanDstLoc }] }
      });
      if (loc) destinationLocationId = loc.id;
    }

    const taskNumber = this.generateTaskNumber();

    const task = await prisma.task.create({
      data: {
        companyId,
        taskNumber,
        title: data.title,
        description: data.description ?? null,
        taskType: data.taskType,
        priority: data.priority || TaskPriority.MEDIUM,
        status: TaskStatus.ASSIGNED,
        assignedToId: data.assignedToId,
        assignedById: currentUser.id,
        warehouseId: data.warehouseId,
        boxId,
        fileId,
        sourceLocationId,
        destinationLocationId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null
      },
      include: {
        assignedTo: { select: { id: true, fullName: true, employeeCode: true, email: true } },
        assignedBy: { select: { id: true, fullName: true, employeeCode: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        box: { select: { id: true, barcode: true, description: true } },
        file: { select: { id: true, barcode: true, title: true } },
        sourceLocation: { select: { id: true, barcode: true, name: true } },
        destinationLocation: { select: { id: true, barcode: true, name: true } }
      }
    });

    // Create Notification
    await prisma.notification.create({
      data: {
        companyId,
        userId: data.assignedToId,
        type: 'WORK_ORDER' as any,
        title: 'New Task Assigned',
        message: `Task ${task.taskNumber} (${task.taskType}): ${task.title}`
      }
    }).catch(() => null);

    // Audit Log
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: currentUser.id,
        warehouseId: data.warehouseId,
        boxId,
        fileRecordId: fileId,
        action: 'TASK_ASSIGNED',
        newState: {
          taskId: task.id,
          taskNumber: task.taskNumber,
          taskType: task.taskType,
          assignedToId: data.assignedToId,
          priority: task.priority
        }
      }
    }).catch(() => null);

    return task;
  }

  /**
   * Get Tasks for Admin Panel (Filtered by Role / Scope)
   */
  public static async getAdminTasks(query: {
    status?: string;
    taskType?: string;
    priority?: string;
    assignedToId?: string;
    warehouseId?: string;
    search?: string;
  }, currentUser: any) {
    const companyId = currentUser.companyId;
    const whereClause: any = { companyId };

    // Warehouse scope check
    if (currentUser.role === 'WAREHOUSE_MANAGER' || currentUser.role === 'SUPERVISOR') {
      if (currentUser.warehouseId) {
        whereClause.warehouseId = currentUser.warehouseId;
      }
    }

    if (query.warehouseId) {
      whereClause.warehouseId = query.warehouseId;
    }

    if (query.status) {
      whereClause.status = query.status as TaskStatus;
    }

    if (query.taskType) {
      whereClause.taskType = query.taskType as TaskType;
    }

    if (query.priority) {
      whereClause.priority = query.priority as TaskPriority;
    }

    if (query.assignedToId) {
      whereClause.assignedToId = query.assignedToId;
    }

    if (query.search) {
      const cleanSearch = query.search.trim();
      whereClause.OR = [
        { taskNumber: { contains: cleanSearch, mode: 'insensitive' } },
        { title: { contains: cleanSearch, mode: 'insensitive' } },
        { description: { contains: cleanSearch, mode: 'insensitive' } }
      ];
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignedTo: { select: { id: true, fullName: true, employeeCode: true, email: true } },
        assignedBy: { select: { id: true, fullName: true, employeeCode: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        box: { select: { id: true, barcode: true, description: true } },
        file: { select: { id: true, barcode: true, title: true } },
        sourceLocation: { select: { id: true, barcode: true, name: true } },
        destinationLocation: { select: { id: true, barcode: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return tasks;
  }

  /**
   * Get Eligible Assignees for Task Assignment Dropdown
   */
  public static async getEligibleAssignees(currentUser: any, warehouseId?: string) {
    const companyId = currentUser.companyId;
    const targetWarehouseId = warehouseId || currentUser.warehouseId;

    const whereClause: any = {
      companyId,
      status: 'ACTIVE'
    };

    if (targetWarehouseId) {
      whereClause.warehouseAssignments = {
        some: { warehouseId: targetWarehouseId }
      };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        email: true,
        role: { select: { name: true, label: true } }
      },
      orderBy: { fullName: 'asc' }
    });

    // If assignment check returned empty, fallback to all users in company
    if (users.length === 0) {
      return prisma.user.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          email: true,
          role: { select: { name: true, label: true } }
        },
        orderBy: { fullName: 'asc' }
      });
    }

    return users;
  }

  /**
   * Reassign Task to a new employee
   */
  public static async reassignTask(taskId: string, newAssigneeId: string, currentUser: any) {
    if (!this.isAssigner(currentUser.role)) {
      throw new Error('UNAUTHORIZED_TASK_ASSIGNMENT: Only Managers and Supervisors can reassign tasks.');
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new Error('TASK_NOT_FOUND: Task does not exist.');
    }

    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED) {
      throw new Error(`INVALID_STATUS_TRANSITION: Cannot reassign a ${task.status} task.`);
    }

    const newAssignee = await prisma.user.findFirst({
      where: { id: newAssigneeId, companyId: currentUser.companyId }
    });
    if (!newAssignee) {
      throw new Error('INVALID_ASSIGNEE: New assignee not found.');
    }

    const previousAssigneeId = task.assignedToId;

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        assignedToId: newAssigneeId,
        assignedById: currentUser.id,
        status: TaskStatus.ASSIGNED
      },
      include: {
        assignedTo: { select: { id: true, fullName: true, employeeCode: true, email: true } },
        assignedBy: { select: { id: true, fullName: true, employeeCode: true } },
        warehouse: { select: { id: true, name: true, code: true } }
      }
    });

    // Notify new assignee
    await prisma.notification.create({
      data: {
        companyId: currentUser.companyId,
        userId: newAssigneeId,
        type: 'WORK_ORDER' as any,
        title: 'Task Reassigned to You',
        message: `Task ${task.taskNumber} (${task.taskType}): ${task.title}`
      }
    }).catch(() => null);

    // Audit Log
    await prisma.auditLog.create({
      data: {
        companyId: currentUser.companyId,
        userId: currentUser.id,
        warehouseId: task.warehouseId,
        action: 'TASK_REASSIGNED',
        previousState: { assignedToId: previousAssigneeId },
        newState: { assignedToId: newAssigneeId, taskId: task.id }
      }
    }).catch(() => null);

    return updatedTask;
  }

  /**
   * Cancel Task (Manager / Supervisor / Admin)
   */
  public static async cancelTask(taskId: string, currentUser: any) {
    if (!this.isAssigner(currentUser.role)) {
      throw new Error('UNAUTHORIZED_TASK_ASSIGNMENT: Only Managers and Supervisors can cancel tasks.');
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new Error('TASK_NOT_FOUND: Task does not exist.');
    }

    if (task.status === TaskStatus.COMPLETED) {
      throw new Error('TASK_ALREADY_COMPLETED: Completed tasks cannot be cancelled.');
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.CANCELLED }
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        companyId: currentUser.companyId,
        userId: currentUser.id,
        warehouseId: task.warehouseId,
        action: 'TASK_CANCELLED',
        newState: { taskId: task.id, status: TaskStatus.CANCELLED }
      }
    }).catch(() => null);

    return updatedTask;
  }

  /**
   * Get My Assigned Tasks for Mobile App
   */
  public static async getMyTasks(query: { status?: string }, currentUser: any) {
    const whereClause: any = {
      companyId: currentUser.companyId,
      assignedToId: currentUser.id
    };

    if (query.status) {
      whereClause.status = query.status as TaskStatus;
    } else {
      whereClause.status = { not: TaskStatus.CANCELLED };
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignedBy: { select: { id: true, fullName: true, employeeCode: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        box: { select: { id: true, barcode: true, description: true } },
        file: { select: { id: true, barcode: true, title: true } },
        sourceLocation: { select: { id: true, barcode: true, name: true } },
        destinationLocation: { select: { id: true, barcode: true, name: true } }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return tasks;
  }

  /**
   * Get Task by ID or Task Number
   */
  public static async getTaskById(taskId: string, currentUser: any) {
    const cleanId = this.cleanString(taskId);
    if (!cleanId) throw new Error('TASK_NOT_FOUND: Invalid task ID.');

    const task = await prisma.task.findFirst({
      where: {
        companyId: currentUser.companyId,
        OR: [
          { id: cleanId },
          { taskNumber: cleanId }
        ]
      },
      include: {
        assignedTo: { select: { id: true, fullName: true, employeeCode: true, email: true } },
        assignedBy: { select: { id: true, fullName: true, employeeCode: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        box: { select: { id: true, barcode: true, description: true } },
        file: { select: { id: true, barcode: true, title: true } },
        sourceLocation: { select: { id: true, barcode: true, name: true } },
        destinationLocation: { select: { id: true, barcode: true, name: true } }
      }
    });

    if (!task) {
      throw new Error('TASK_NOT_FOUND: Task not found.');
    }

    return task;
  }

  /**
   * Mobile: Accept Task
   */
  public static async acceptTask(taskId: string, currentUser: any) {
    const task = await this.getTaskById(taskId, currentUser);

    if (task.assignedToId !== currentUser.id) {
      throw new Error('TASK_NOT_ASSIGNED: This task is not assigned to you.');
    }

    if (task.status !== TaskStatus.ASSIGNED) {
      throw new Error(`INVALID_STATUS_TRANSITION: Task status is already ${task.status}.`);
    }

    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: { status: TaskStatus.ACCEPTED }
    });

    await prisma.auditLog.create({
      data: {
        companyId: currentUser.companyId,
        userId: currentUser.id,
        warehouseId: task.warehouseId,
        action: 'TASK_ACCEPTED',
        newState: { taskId: task.id, status: TaskStatus.ACCEPTED }
      }
    }).catch(() => null);

    return updatedTask;
  }

  /**
   * Mobile: Start Task
   */
  public static async startTask(taskId: string, currentUser: any) {
    const task = await this.getTaskById(taskId, currentUser);

    if (task.assignedToId !== currentUser.id) {
      throw new Error('TASK_NOT_ASSIGNED: This task is not assigned to you.');
    }

    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED) {
      throw new Error(`INVALID_STATUS_TRANSITION: Cannot start a ${task.status} task.`);
    }

    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.IN_PROGRESS,
        startedAt: task.startedAt || new Date()
      }
    });

    await prisma.auditLog.create({
      data: {
        companyId: currentUser.companyId,
        userId: currentUser.id,
        warehouseId: task.warehouseId,
        action: 'TASK_STARTED',
        newState: { taskId: task.id, status: TaskStatus.IN_PROGRESS }
      }
    }).catch(() => null);

    return updatedTask;
  }

  /**
   * Mobile: Complete Task (Executes / Validates Real Operation)
   */
  public static async completeTask(taskId: string, payload: {
    fileBarcode?: string;
    boxBarcode?: string;
    targetBoxBarcode?: string;
    destinationLocationBarcode?: string;
    notes?: string;
  }, currentUser: any) {
    const task = await this.getTaskById(taskId, currentUser);

    if (task.assignedToId !== currentUser.id) {
      throw new Error('TASK_NOT_ASSIGNED: This task is not assigned to you.');
    }

    if (task.status === TaskStatus.COMPLETED) {
      return task; // Already completed
    }

    if (task.status === TaskStatus.CANCELLED) {
      throw new Error('TASK_ALREADY_CANCELLED: Cannot complete a cancelled task.');
    }

    // Operational business logic validations based on TaskType
    const cleanFileBc = this.cleanString(payload.fileBarcode);
    const cleanBoxBc = this.cleanString(payload.boxBarcode);
    const cleanTargetBoxBc = this.cleanString(payload.targetBoxBarcode);
    const cleanDstLocBc = this.cleanString(payload.destinationLocationBarcode);

    if (task.taskType === TaskType.FILE_INSERT) {
      if (!cleanFileBc && !task.fileId) {
        throw new Error('FILE_BARCODE_REQUIRED: Scan or specify file barcode to complete FILE_INSERT task.');
      }
      if (!cleanBoxBc && !task.boxId) {
        throw new Error('BOX_BARCODE_REQUIRED: Scan or specify target box barcode to complete FILE_INSERT task.');
      }

      // Execute real file insertion if file and box specified
      const targetFileBc = cleanFileBc || task.file?.barcode;
      const targetBoxBc = cleanBoxBc || task.box?.barcode;

      if (targetFileBc && targetBoxBc) {
        const fileRec = await prisma.fileRecord.findFirst({ where: { barcode: targetFileBc } });
        const boxRec = await prisma.box.findFirst({ where: { barcode: targetBoxBc } });

        if (!fileRec) throw new Error(`FILE_NOT_FOUND: File ${targetFileBc} not found.`);
        if (!boxRec) throw new Error(`BOX_NOT_FOUND: Box ${targetBoxBc} not found.`);

        // Move file into box
        await prisma.fileRecord.update({
          where: { id: fileRec.id },
          data: { boxId: boxRec.id }
        });
      }
    } else if (task.taskType === TaskType.FILE_REFILE) {
      const targetFileBc = cleanFileBc || task.file?.barcode;
      const targetBoxBc = cleanTargetBoxBc || cleanBoxBc || task.box?.barcode;

      if (targetFileBc && targetBoxBc) {
        const fileRec = await prisma.fileRecord.findFirst({ where: { barcode: targetFileBc } });
        const boxRec = await prisma.box.findFirst({ where: { barcode: targetBoxBc } });

        if (fileRec && boxRec) {
          await prisma.$transaction([
            prisma.fileRecord.update({
              where: { id: fileRec.id },
              data: { boxId: boxRec.id }
            }),
            prisma.refileEvent.create({
              data: {
                fileRecordId: fileRec.id,
                expectedBoxId: fileRec.boxId,
                scannedBoxId: boxRec.id,
                expectedLocationId: boxRec.currentLocationId || '',
                scannedLocationId: boxRec.currentLocationId || '',
                operatorId: currentUser.id,
                clientEventId: `task-refile-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                scannedAt: new Date(),
                action: 'REFILE_SUCCESS'
              }
            })
          ]);
        }
      }
    } else if (task.taskType === TaskType.BOX_TRANSFER) {
      const targetBoxBc = cleanBoxBc || task.box?.barcode;
      const targetLocBc = cleanDstLocBc;

      if (targetBoxBc && targetLocBc) {
        const boxRec = await prisma.box.findFirst({ where: { barcode: targetBoxBc } });
        const locRec = await prisma.location.findFirst({ where: { barcode: targetLocBc } });

        if (boxRec && locRec) {
          await prisma.box.update({
            where: { id: boxRec.id },
            data: { currentLocationId: locRec.id }
          });
        }
      }
    }

    // Update Task Status -> COMPLETED
    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date()
      },
      include: {
        assignedTo: { select: { id: true, fullName: true, employeeCode: true } },
        assignedBy: { select: { id: true, fullName: true, employeeCode: true } },
        warehouse: { select: { id: true, name: true, code: true } }
      }
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        companyId: currentUser.companyId,
        userId: currentUser.id,
        warehouseId: task.warehouseId,
        boxId: task.boxId,
        fileRecordId: task.fileId,
        action: 'TASK_COMPLETED',
        newState: {
          taskId: task.id,
          taskNumber: task.taskNumber,
          taskType: task.taskType,
          completedAt: updatedTask.completedAt
        }
      }
    }).catch(() => null);

    return updatedTask;
  }

  /**
   * Mobile: Reject Task
   */
  public static async rejectTask(taskId: string, reason: string, currentUser: any) {
    const task = await this.getTaskById(taskId, currentUser);

    if (task.assignedToId !== currentUser.id) {
      throw new Error('TASK_NOT_ASSIGNED: This task is not assigned to you.');
    }

    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED) {
      throw new Error(`INVALID_STATUS_TRANSITION: Cannot reject a ${task.status} task.`);
    }

    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.REJECTED,
        rejectionReason: reason || 'Task rejected by assigned employee'
      }
    });

    await prisma.auditLog.create({
      data: {
        companyId: currentUser.companyId,
        userId: currentUser.id,
        warehouseId: task.warehouseId,
        action: 'TASK_REJECTED',
        newState: { taskId: task.id, reason }
      }
    }).catch(() => null);

    return updatedTask;
  }
}
