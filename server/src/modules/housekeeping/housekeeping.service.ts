import pg from 'pg';
import { getDbPool, withTransaction } from '../../db/pool.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
  UnprocessableEntityError
} from '../../utils/errors.js';
import { writeAuditLog } from '../../services/audit.service.js';
import { realtimeBroadcaster } from '../../realtime/broadcaster.js';
import {
  TaskType,
  TaskStatus,
  MaintenanceCategory,
  MaintenanceSeverity,
  MaintenanceStatus,
  HousekeepingTaskResponse,
  RoomStatusHistoryResponse,
  MaintenanceIssueResponse
} from './housekeeping.types.js';

function formatDate(val: any): string | null {
  if (!val) return null;
  return val instanceof Date ? val.toISOString() : new Date(val).toISOString();
}

function mapTaskRow(row: any): HousekeepingTaskResponse {
  let roomInfo: HousekeepingTaskResponse['room'] | undefined;
  if (row.room_number) {
    roomInfo = {
      id: row.room_id,
      roomNumber: row.room_number,
      roomType: row.room_type,
      floor: row.floor,
      status: row.room_status
    };
  }

  return {
    id: row.id,
    roomId: row.room_id,
    taskType: row.task_type as TaskType,
    assignedStaffId: row.assigned_staff_id || null,
    status: row.status as TaskStatus,
    startedAt: formatDate(row.started_at),
    completedAt: formatDate(row.completed_at),
    inspectedByStaffId: row.inspected_by_staff_id || null,
    inspectedAt: formatDate(row.inspected_at),
    notes: row.notes || null,
    createdAt: formatDate(row.created_at) || new Date().toISOString(),
    room: roomInfo,
    assignedStaffName: row.assigned_staff_name || null,
    inspectedByStaffName: row.inspected_by_staff_name || null
  };
}

function mapHistoryRow(row: any): RoomStatusHistoryResponse {
  return {
    id: row.id,
    roomId: row.room_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedByStaffId: row.changed_by_staff_id,
    createdAt: formatDate(row.created_at) || new Date().toISOString(),
    changedByStaffName: row.changed_by_staff_name || null
  };
}

function mapIssueRow(row: any): MaintenanceIssueResponse {
  return {
    id: row.id,
    roomId: row.room_id || null,
    outletId: row.outlet_id || null,
    category: row.category as MaintenanceCategory,
    severity: row.severity as MaintenanceSeverity,
    description: row.description,
    status: row.status as MaintenanceStatus,
    reportedByStaffId: row.reported_by_staff_id,
    resolvedByStaffId: row.resolved_by_staff_id || null,
    createdAt: formatDate(row.created_at) || new Date().toISOString(),
    roomNumber: row.room_number || null,
    outletName: row.outlet_name || null,
    reportedByStaffName: row.reported_by_staff_name || null,
    resolvedByStaffName: row.resolved_by_staff_name || null
  };
}

export class HousekeepingService {
  // ==========================================================================
  // 1. HOUSEKEEPING TASKS
  // ==========================================================================

  static async listTasks(params: {
    roomId?: string;
    status?: TaskStatus;
    taskType?: TaskType;
    assignedStaffId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: HousekeepingTaskResponse[]; total: number }> {
    const pool = getDbPool();
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.roomId) {
      conditions.push(`t.room_id = $${idx++}`);
      values.push(params.roomId);
    }
    if (params.status) {
      conditions.push(`t.status = $${idx++}`);
      values.push(params.status);
    }
    if (params.taskType) {
      conditions.push(`t.task_type = $${idx++}`);
      values.push(params.taskType);
    }
    if (params.assignedStaffId) {
      conditions.push(`t.assigned_staff_id = $${idx++}`);
      values.push(params.assignedStaffId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM public.housekeeping_tasks t ${whereClause};`,
      values
    );
    const total = countRes.rows[0]?.count || 0;

    const limit = params.limit || 50;
    const offset = params.offset || 0;
    const dataValues = [...values, limit, offset];

    const dataRes = await pool.query(
      `SELECT 
        t.*,
        r.room_number,
        r.room_type,
        r.floor,
        r.status AS room_status,
        ast.first_name || ' ' || ast.last_name AS assigned_staff_name,
        ist.first_name || ' ' || ist.last_name AS inspected_by_staff_name
       FROM public.housekeeping_tasks t
       JOIN public.hotel_rooms r ON r.id = t.room_id
       LEFT JOIN public.staff ast ON ast.id = t.assigned_staff_id
       LEFT JOIN public.staff ist ON ist.id = t.inspected_by_staff_id
       ${whereClause}
       ORDER BY 
         CASE 
           WHEN t.status = 'PENDING' THEN 1
           WHEN t.status = 'IN_PROGRESS' THEN 2
           WHEN t.status = 'COMPLETED' THEN 3
           ELSE 4
         END,
         t.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++};`,
      dataValues
    );

    return {
      items: dataRes.rows.map(mapTaskRow),
      total
    };
  }

  static async getTaskById(taskId: string, client?: pg.PoolClient): Promise<HousekeepingTaskResponse> {
    const queryRunner = client || getDbPool();
    const res = await queryRunner.query(
      `SELECT 
        t.*,
        r.room_number,
        r.room_type,
        r.floor,
        r.status AS room_status,
        ast.first_name || ' ' || ast.last_name AS assigned_staff_name,
        ist.first_name || ' ' || ist.last_name AS inspected_by_staff_name
       FROM public.housekeeping_tasks t
       JOIN public.hotel_rooms r ON r.id = t.room_id
       LEFT JOIN public.staff ast ON ast.id = t.assigned_staff_id
       LEFT JOIN public.staff ist ON ist.id = t.inspected_by_staff_id
       WHERE t.id = $1;`,
      [taskId]
    );
    if (res.rows.length === 0) {
      throw new NotFoundError(`Housekeeping task '${taskId}'`);
    }
    return mapTaskRow(res.rows[0]);
  }

  static async createTask(params: {
    roomId: string;
    taskType?: TaskType;
    assignedStaffId?: string | null;
    notes?: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<HousekeepingTaskResponse> {
    const { roomId, taskType = 'CHECKOUT_CLEANING', assignedStaffId, notes, staffId, reqCorrelationId, ipAddress } = params;

    return await withTransaction(async (client) => {
      // 1. Verify room exists
      const roomRes = await client.query('SELECT * FROM public.hotel_rooms WHERE id = $1;', [roomId]);
      if (roomRes.rows.length === 0) {
        throw new NotFoundError(`Hotel room '${roomId}'`);
      }
      const room = roomRes.rows[0];

      // 2. Verify assigned staff if provided
      if (assignedStaffId) {
        const staffRes = await client.query('SELECT id FROM public.staff WHERE id = $1;', [assignedStaffId]);
        if (staffRes.rows.length === 0) {
          throw new NotFoundError(`Staff '${assignedStaffId}'`);
        }
      }

      // 3. Insert task
      const insertQuery = `
        INSERT INTO public.housekeeping_tasks (
          room_id, task_type, assigned_staff_id, status, notes
        ) VALUES ($1, $2, $3, 'PENDING', $4)
        RETURNING *;
      `;
      const res = await client.query(insertQuery, [
        roomId,
        taskType,
        assignedStaffId || null,
        notes || null
      ]);
      const created = res.rows[0];

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'HOUSEKEEPING_TASK_CREATED',
          entityType: 'housekeeping_tasks',
          entityId: created.id,
          outletId: null,
          oldState: null,
          newState: {
            taskId: created.id,
            roomId,
            taskType,
            assignedStaffId: assignedStaffId || null
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return mapTaskRow({
        ...created,
        room_number: room.room_number,
        room_type: room.room_type,
        floor: room.floor,
        room_status: room.status
      });
    });
  }

  static async assignTask(params: {
    taskId: string;
    assignedStaffId: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<HousekeepingTaskResponse> {
    const { taskId, assignedStaffId, staffId, reqCorrelationId, ipAddress } = params;

    return await withTransaction(async (client) => {
      const taskRes = await client.query(
        'SELECT * FROM public.housekeeping_tasks WHERE id = $1 FOR UPDATE;',
        [taskId]
      );
      if (taskRes.rows.length === 0) {
        throw new NotFoundError(`Housekeeping task '${taskId}'`);
      }
      const task = taskRes.rows[0];

      const staffRes = await client.query('SELECT id FROM public.staff WHERE id = $1;', [assignedStaffId]);
      if (staffRes.rows.length === 0) {
        throw new NotFoundError(`Staff '${assignedStaffId}'`);
      }

      const updateRes = await client.query(
        `UPDATE public.housekeeping_tasks
         SET assigned_staff_id = $1
         WHERE id = $2
         RETURNING *;`,
        [assignedStaffId, taskId]
      );

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'HOUSEKEEPING_TASK_ASSIGNED',
          entityType: 'housekeeping_tasks',
          entityId: taskId,
          outletId: null,
          oldState: { assignedStaffId: task.assigned_staff_id },
          newState: { assignedStaffId },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return await HousekeepingService.getTaskById(taskId, client);
    });
  }

  static async startTask(params: {
    taskId: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<HousekeepingTaskResponse> {
    const { taskId, staffId, reqCorrelationId, ipAddress } = params;

    const task = await withTransaction(async (client) => {
      // 1. Lock task FOR UPDATE
      const taskRes = await client.query(
        'SELECT * FROM public.housekeeping_tasks WHERE id = $1 FOR UPDATE;',
        [taskId]
      );
      if (taskRes.rows.length === 0) {
        throw new NotFoundError(`Housekeeping task '${taskId}'`);
      }
      const taskObj = taskRes.rows[0];

      if (taskObj.status !== 'PENDING') {
        throw new ConflictError(`Cannot start task in status '${taskObj.status}'`);
      }

      // 2. Lock room FOR UPDATE
      const roomRes = await client.query(
        'SELECT * FROM public.hotel_rooms WHERE id = $1 FOR UPDATE;',
        [taskObj.room_id]
      );
      if (roomRes.rows.length === 0) {
        throw new NotFoundError(`Room '${taskObj.room_id}'`);
      }
      const room = roomRes.rows[0];

      // 3. Update task status to IN_PROGRESS
      await client.query(
        `UPDATE public.housekeeping_tasks
         SET status = 'IN_PROGRESS', started_at = CURRENT_TIMESTAMP, assigned_staff_id = COALESCE(assigned_staff_id, $1)
         WHERE id = $2;`,
        [staffId, taskId]
      );

      // 4. Update room status to CLEANING if currently DIRTY
      if (room.status === 'DIRTY') {
        await client.query(
          "UPDATE public.hotel_rooms SET status = 'CLEANING', updated_at = CURRENT_TIMESTAMP WHERE id = $1;",
          [room.id]
        );

        await client.query(
          `INSERT INTO public.room_status_history (
            room_id, from_status, to_status, changed_by_staff_id
          ) VALUES ($1, 'DIRTY', 'CLEANING', $2);`,
          [room.id, staffId]
        );
      }

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'HOUSEKEEPING_TASK_STARTED',
          entityType: 'housekeeping_tasks',
          entityId: taskId,
          outletId: null,
          oldState: { taskStatus: 'PENDING', roomStatus: room.status },
          newState: { taskStatus: 'IN_PROGRESS', roomStatus: 'CLEANING' },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return await HousekeepingService.getTaskById(taskId, client);
    });

    realtimeBroadcaster
      .publish({
        outletId: 'hotel',
        channel: 'housekeeping',
        sequenceNumber: 1,
        eventType: 'CLEANING_STARTED',
        payload: {
          taskId: task.id,
          roomId: task.roomId,
          roomNumber: task.room?.roomNumber,
          assignedStaffId: task.assignedStaffId
        },
        timestamp: new Date().toISOString()
      })
      .catch(() => {});

    return task;
  }

  static async completeTask(params: {
    taskId: string;
    notes?: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<HousekeepingTaskResponse> {
    const { taskId, notes, staffId, reqCorrelationId, ipAddress } = params;

    const task = await withTransaction(async (client) => {
      // 1. Lock task FOR UPDATE
      const taskRes = await client.query(
        'SELECT * FROM public.housekeeping_tasks WHERE id = $1 FOR UPDATE;',
        [taskId]
      );
      if (taskRes.rows.length === 0) {
        throw new NotFoundError(`Housekeeping task '${taskId}'`);
      }
      const taskObj = taskRes.rows[0];

      if (taskObj.status !== 'IN_PROGRESS') {
        throw new ConflictError(`Cannot complete task in status '${taskObj.status}'`);
      }

      // 2. Lock room FOR UPDATE
      const roomRes = await client.query(
        'SELECT * FROM public.hotel_rooms WHERE id = $1 FOR UPDATE;',
        [taskObj.room_id]
      );
      if (roomRes.rows.length === 0) {
        throw new NotFoundError(`Room '${taskObj.room_id}'`);
      }
      const room = roomRes.rows[0];

      // 3. Update task status to COMPLETED
      await client.query(
        `UPDATE public.housekeeping_tasks
         SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, notes = COALESCE($1, notes)
         WHERE id = $2;`,
        [notes || null, taskId]
      );

      // 4. Update room status to INSPECTED if CLEANING
      if (room.status === 'CLEANING') {
        await client.query(
          "UPDATE public.hotel_rooms SET status = 'INSPECTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1;",
          [room.id]
        );

        await client.query(
          `INSERT INTO public.room_status_history (
            room_id, from_status, to_status, changed_by_staff_id
          ) VALUES ($1, 'CLEANING', 'INSPECTED', $2);`,
          [room.id, staffId]
        );
      }

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'HOUSEKEEPING_TASK_COMPLETED',
          entityType: 'housekeeping_tasks',
          entityId: taskId,
          outletId: null,
          oldState: { taskStatus: 'IN_PROGRESS', roomStatus: room.status },
          newState: { taskStatus: 'COMPLETED', roomStatus: 'INSPECTED', notes },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return await HousekeepingService.getTaskById(taskId, client);
    });

    realtimeBroadcaster
      .publish({
        outletId: 'hotel',
        channel: 'housekeeping',
        sequenceNumber: 1,
        eventType: 'CLEANING_COMPLETED',
        payload: {
          taskId: task.id,
          roomId: task.roomId,
          roomNumber: task.room?.roomNumber
        },
        timestamp: new Date().toISOString()
      })
      .catch(() => {});

    return task;
  }

  static async inspectTask(params: {
    taskId: string;
    passed: boolean;
    notes?: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<HousekeepingTaskResponse> {
    const { taskId, passed, notes, staffId, reqCorrelationId, ipAddress } = params;

    const task = await withTransaction(async (client) => {
      // 1. Lock task FOR UPDATE
      const taskRes = await client.query(
        'SELECT * FROM public.housekeeping_tasks WHERE id = $1 FOR UPDATE;',
        [taskId]
      );
      if (taskRes.rows.length === 0) {
        throw new NotFoundError(`Housekeeping task '${taskId}'`);
      }
      const taskObj = taskRes.rows[0];

      if (taskObj.status !== 'COMPLETED') {
        throw new ConflictError(`Cannot inspect task in status '${taskObj.status}'. Task must be 'COMPLETED'.`);
      }

      // 2. Lock room FOR UPDATE
      const roomRes = await client.query(
        'SELECT * FROM public.hotel_rooms WHERE id = $1 FOR UPDATE;',
        [taskObj.room_id]
      );
      if (roomRes.rows.length === 0) {
        throw new NotFoundError(`Room '${taskObj.room_id}'`);
      }
      const room = roomRes.rows[0];

      if (passed) {
        // Passed: Task -> INSPECTED, Room -> AVAILABLE
        await client.query(
          `UPDATE public.housekeeping_tasks
           SET status = 'INSPECTED', inspected_by_staff_id = $1, inspected_at = CURRENT_TIMESTAMP, notes = COALESCE($2, notes)
           WHERE id = $3;`,
          [staffId, notes || null, taskId]
        );

        await client.query(
          "UPDATE public.hotel_rooms SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP WHERE id = $1;",
          [room.id]
        );

        await client.query(
          `INSERT INTO public.room_status_history (
            room_id, from_status, to_status, changed_by_staff_id
          ) VALUES ($1, $2, 'AVAILABLE', $3);`,
          [room.id, room.status, staffId]
        );
      } else {
        // Failed inspection: Room -> DIRTY, Task -> PENDING
        await client.query(
          `UPDATE public.housekeeping_tasks
           SET status = 'PENDING', started_at = NULL, completed_at = NULL, notes = COALESCE($1, notes)
           WHERE id = $2;`,
          [notes || 'Inspection failed - recleaning required', taskId]
        );

        await client.query(
          "UPDATE public.hotel_rooms SET status = 'DIRTY', updated_at = CURRENT_TIMESTAMP WHERE id = $1;",
          [room.id]
        );

        await client.query(
          `INSERT INTO public.room_status_history (
            room_id, from_status, to_status, changed_by_staff_id
          ) VALUES ($1, $2, 'DIRTY', $3);`,
          [room.id, room.status, staffId]
        );
      }

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: passed ? 'HOUSEKEEPING_INSPECTION_PASSED' : 'HOUSEKEEPING_INSPECTION_FAILED',
          entityType: 'housekeeping_tasks',
          entityId: taskId,
          outletId: null,
          oldState: { taskStatus: 'COMPLETED', roomStatus: room.status },
          newState: {
            taskStatus: passed ? 'INSPECTED' : 'PENDING',
            roomStatus: passed ? 'AVAILABLE' : 'DIRTY',
            passed,
            notes
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return await HousekeepingService.getTaskById(taskId, client);
    });

    realtimeBroadcaster
      .publish({
        outletId: 'hotel',
        channel: 'housekeeping',
        sequenceNumber: 1,
        eventType: passed ? 'INSPECTION_PASSED' : 'INSPECTION_FAILED',
        payload: {
          taskId: task.id,
          roomId: task.roomId,
          roomNumber: task.room?.roomNumber,
          newRoomStatus: passed ? 'AVAILABLE' : 'DIRTY'
        },
        timestamp: new Date().toISOString()
      })
      .catch(() => {});

    return task;
  }

  // ==========================================================================
  // 2. ROOM STATUS HISTORY
  // ==========================================================================

  static async getRoomStatusHistory(params: {
    roomId: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: RoomStatusHistoryResponse[]; total: number }> {
    const pool = getDbPool();
    const { roomId, limit = 50, offset = 0 } = params;

    const countRes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM public.room_status_history WHERE room_id = $1;',
      [roomId]
    );
    const total = countRes.rows[0]?.count || 0;

    const dataRes = await pool.query(
      `SELECT 
        rsh.*,
        st.first_name || ' ' || st.last_name AS changed_by_staff_name
       FROM public.room_status_history rsh
       JOIN public.staff st ON st.id = rsh.changed_by_staff_id
       WHERE rsh.room_id = $1
       ORDER BY rsh.created_at DESC
       LIMIT $2 OFFSET $3;`,
      [roomId, limit, offset]
    );

    return {
      items: dataRes.rows.map(mapHistoryRow),
      total
    };
  }

  // ==========================================================================
  // 3. MAINTENANCE ISSUES
  // ==========================================================================

  static async reportMaintenanceIssue(params: {
    roomId?: string | null;
    outletId?: string | null;
    category: MaintenanceCategory;
    severity: MaintenanceSeverity;
    description: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<MaintenanceIssueResponse> {
    const { roomId, outletId, category, severity, description, staffId, reqCorrelationId, ipAddress } = params;

    const issue = await withTransaction(async (client) => {
      let roomRow: any = null;
      if (roomId) {
        const roomRes = await client.query('SELECT * FROM public.hotel_rooms WHERE id = $1 FOR UPDATE;', [roomId]);
        if (roomRes.rows.length === 0) {
          throw new NotFoundError(`Hotel room '${roomId}'`);
        }
        roomRow = roomRes.rows[0];
      }

      if (outletId) {
        const outRes = await client.query('SELECT id FROM public.outlets WHERE id = $1;', [outletId]);
        if (outRes.rows.length === 0) {
          throw new NotFoundError(`Outlet '${outletId}'`);
        }
      }

      // 1. Insert maintenance issue
      const insertQuery = `
        INSERT INTO public.maintenance_issues (
          room_id, outlet_id, category, severity, description, status, reported_by_staff_id
        ) VALUES ($1, $2, $3, $4, $5, 'REPORTED', $6)
        RETURNING *;
      `;
      const issueRes = await client.query(insertQuery, [
        roomId || null,
        outletId || null,
        category,
        severity,
        description.trim(),
        staffId
      ]);
      const createdIssue = issueRes.rows[0];

      // 2. If HIGH or CRITICAL severity on a room, transition room to MAINTENANCE status
      if (roomRow && (severity === 'HIGH' || severity === 'CRITICAL')) {
        if (roomRow.status !== 'MAINTENANCE') {
          await client.query(
            "UPDATE public.hotel_rooms SET status = 'MAINTENANCE', updated_at = CURRENT_TIMESTAMP WHERE id = $1;",
            [roomRow.id]
          );

          await client.query(
            `INSERT INTO public.room_status_history (
              room_id, from_status, to_status, changed_by_staff_id
            ) VALUES ($1, $2, 'MAINTENANCE', $3);`,
            [roomRow.id, roomRow.status, staffId]
          );
        }
      }

      // 3. Write audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'MAINTENANCE_ISSUE_REPORTED',
          entityType: 'maintenance_issues',
          entityId: createdIssue.id,
          outletId: outletId || null,
          oldState: null,
          newState: {
            issueId: createdIssue.id,
            roomId: roomId || null,
            outletId: outletId || null,
            category,
            severity,
            description
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return await HousekeepingService.getMaintenanceIssueById(createdIssue.id, client);
    });

    realtimeBroadcaster
      .publish({
        outletId: issue.outletId || 'hotel',
        channel: 'maintenance',
        sequenceNumber: 1,
        eventType: 'ISSUE_REPORTED',
        payload: {
          issueId: issue.id,
          category: issue.category,
          severity: issue.severity,
          roomId: issue.roomId,
          roomNumber: issue.roomNumber,
          outletId: issue.outletId
        },
        timestamp: new Date().toISOString()
      })
      .catch(() => {});

    return issue;
  }

  static async listMaintenanceIssues(params: {
    roomId?: string;
    outletId?: string;
    category?: MaintenanceCategory;
    severity?: MaintenanceSeverity;
    status?: MaintenanceStatus;
    staffId: string;
    staffOutletIds: string[];
    isHousekeepingOrSuperAdmin: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: MaintenanceIssueResponse[]; total: number }> {
    const pool = getDbPool();
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Authorization scoping check
    if (!params.isHousekeepingOrSuperAdmin) {
      // Scoped staff can only see their assigned outlets or issues they reported/resolved
      conditions.push(`(
        m.reported_by_staff_id = $${idx}
        OR m.resolved_by_staff_id = $${idx}
        ${params.staffOutletIds.length > 0 ? `OR m.outlet_id = ANY($${idx + 1})` : ''}
      )`);
      values.push(params.staffId);
      idx++;
      if (params.staffOutletIds.length > 0) {
        values.push(params.staffOutletIds);
        idx++;
      }
    }

    if (params.roomId) {
      conditions.push(`m.room_id = $${idx++}`);
      values.push(params.roomId);
    }
    if (params.outletId) {
      conditions.push(`m.outlet_id = $${idx++}`);
      values.push(params.outletId);
    }
    if (params.category) {
      conditions.push(`m.category = $${idx++}`);
      values.push(params.category);
    }
    if (params.severity) {
      conditions.push(`m.severity = $${idx++}`);
      values.push(params.severity);
    }
    if (params.status) {
      conditions.push(`m.status = $${idx++}`);
      values.push(params.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM public.maintenance_issues m ${whereClause};`,
      values
    );
    const total = countRes.rows[0]?.count || 0;

    const limit = params.limit || 50;
    const offset = params.offset || 0;
    const dataValues = [...values, limit, offset];

    const dataRes = await pool.query(
      `SELECT 
        m.*,
        r.room_number,
        o.name AS outlet_name,
        rep.first_name || ' ' || rep.last_name AS reported_by_staff_name,
        res.first_name || ' ' || res.last_name AS resolved_by_staff_name
       FROM public.maintenance_issues m
       LEFT JOIN public.hotel_rooms r ON r.id = m.room_id
       LEFT JOIN public.outlets o ON o.id = m.outlet_id
       LEFT JOIN public.staff rep ON rep.id = m.reported_by_staff_id
       LEFT JOIN public.staff res ON res.id = m.resolved_by_staff_id
       ${whereClause}
       ORDER BY 
         CASE 
           WHEN m.status = 'REPORTED' THEN 1
           WHEN m.status = 'IN_REPAIR' THEN 2
           ELSE 3
         END,
         CASE 
           WHEN m.severity = 'CRITICAL' THEN 1
           WHEN m.severity = 'HIGH' THEN 2
           WHEN m.severity = 'MEDIUM' THEN 3
           ELSE 4
         END,
         m.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++};`,
      dataValues
    );

    return {
      items: dataRes.rows.map(mapIssueRow),
      total
    };
  }

  static async getMaintenanceIssueById(issueId: string, client?: pg.PoolClient): Promise<MaintenanceIssueResponse> {
    const queryRunner = client || getDbPool();
    const res = await queryRunner.query(
      `SELECT 
        m.*,
        r.room_number,
        o.name AS outlet_name,
        rep.first_name || ' ' || rep.last_name AS reported_by_staff_name,
        res.first_name || ' ' || res.last_name AS resolved_by_staff_name
       FROM public.maintenance_issues m
       LEFT JOIN public.hotel_rooms r ON r.id = m.room_id
       LEFT JOIN public.outlets o ON o.id = m.outlet_id
       LEFT JOIN public.staff rep ON rep.id = m.reported_by_staff_id
       LEFT JOIN public.staff res ON res.id = m.resolved_by_staff_id
       WHERE m.id = $1;`,
      [issueId]
    );
    if (res.rows.length === 0) {
      throw new NotFoundError(`Maintenance issue '${issueId}'`);
    }
    return mapIssueRow(res.rows[0]);
  }

  static async startRepair(params: {
    issueId: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<MaintenanceIssueResponse> {
    const { issueId, staffId, reqCorrelationId, ipAddress } = params;

    return await withTransaction(async (client) => {
      const curRes = await client.query(
        'SELECT * FROM public.maintenance_issues WHERE id = $1 FOR UPDATE;',
        [issueId]
      );
      if (curRes.rows.length === 0) {
        throw new NotFoundError(`Maintenance issue '${issueId}'`);
      }
      const cur = curRes.rows[0];

      if (cur.status !== 'REPORTED') {
        throw new ConflictError(`Cannot start repair for issue in status '${cur.status}'`);
      }

      await client.query(
        "UPDATE public.maintenance_issues SET status = 'IN_REPAIR' WHERE id = $1;",
        [issueId]
      );

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'MAINTENANCE_REPAIR_STARTED',
          entityType: 'maintenance_issues',
          entityId: issueId,
          outletId: cur.outlet_id || null,
          oldState: { status: 'REPORTED' },
          newState: { status: 'IN_REPAIR' },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return await HousekeepingService.getMaintenanceIssueById(issueId, client);
    });
  }

  static async resolveMaintenanceIssue(params: {
    issueId: string;
    notes?: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<MaintenanceIssueResponse> {
    const { issueId, notes, staffId, reqCorrelationId, ipAddress } = params;

    const issue = await withTransaction(async (client) => {
      const curRes = await client.query(
        'SELECT * FROM public.maintenance_issues WHERE id = $1 FOR UPDATE;',
        [issueId]
      );
      if (curRes.rows.length === 0) {
        throw new NotFoundError(`Maintenance issue '${issueId}'`);
      }
      const cur = curRes.rows[0];

      if (cur.status === 'RESOLVED') {
        throw new ConflictError('Maintenance issue is already resolved');
      }

      // 1. Update issue to RESOLVED
      await client.query(
        `UPDATE public.maintenance_issues
         SET status = 'RESOLVED', resolved_by_staff_id = $1
         WHERE id = $2;`,
        [staffId, issueId]
      );

      // 2. If issue was linked to a room and room is currently in MAINTENANCE, transition room to DIRTY
      // (Never automatically AVAILABLE — room must undergo turnover cleaning & inspection first!)
      if (cur.room_id) {
        const roomRes = await client.query(
          'SELECT * FROM public.hotel_rooms WHERE id = $1 FOR UPDATE;',
          [cur.room_id]
        );
        if (roomRes.rows.length > 0) {
          const room = roomRes.rows[0];
          if (room.status === 'MAINTENANCE') {
            await client.query(
              "UPDATE public.hotel_rooms SET status = 'DIRTY', updated_at = CURRENT_TIMESTAMP WHERE id = $1;",
              [room.id]
            );

            // Automatically create turnover cleaning task
            await client.query(
              `INSERT INTO public.housekeeping_tasks (
                room_id, task_type, status, notes
              ) VALUES ($1, 'DEEP_CLEANING', 'PENDING', $2);`,
              [room.id, `Generated post-maintenance resolution for issue #${issueId}`]
            );

            await client.query(
              `INSERT INTO public.room_status_history (
                room_id, from_status, to_status, changed_by_staff_id
              ) VALUES ($1, 'MAINTENANCE', 'DIRTY', $2);`,
              [room.id, staffId]
            );
          }
        }
      }

      // 3. Write audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'MAINTENANCE_ISSUE_RESOLVED',
          entityType: 'maintenance_issues',
          entityId: issueId,
          outletId: cur.outlet_id || null,
          oldState: { status: cur.status },
          newState: { status: 'RESOLVED', resolvedByStaffId: staffId, notes },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return await HousekeepingService.getMaintenanceIssueById(issueId, client);
    });

    realtimeBroadcaster
      .publish({
        outletId: issue.outletId || 'hotel',
        channel: 'maintenance',
        sequenceNumber: 1,
        eventType: 'ISSUE_RESOLVED',
        payload: {
          issueId: issue.id,
          roomId: issue.roomId,
          roomNumber: issue.roomNumber,
          outletId: issue.outletId
        },
        timestamp: new Date().toISOString()
      })
      .catch(() => {});

    return issue;
  }
}
