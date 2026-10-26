import type { Request, Response, NextFunction } from 'express';
import { getDbPool } from '../../db/pool.js';

const UUID = /^[A-Za-z0-9_]+$/;

function canManage(req: Request): boolean {
  const roles = req.staff?.roles.map(r => r.id) ?? [];
  return roles.includes('SUPER_ADMIN') ||
    (roles.includes('RESTAURANT_OWNER') &&
      (req.staff?.outlets.length ?? 0) > 0);
}

export async function listRoleMaster(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const [roles, departments] = await Promise.all([
      getDbPool().query(
        'SELECT * FROM pali_runtime.list_staff_role_master()'
      ),
      getDbPool().query(
        'SELECT * FROM pali_runtime.list_staff_departments()'
      )
    ]);
    res.json({
      items: roles.rows,
      departments: departments.rows,
      canManage: canManage(req)
    });
  } catch (err) {
    next(err);
  }
}

export async function createRoleMaster(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  if (!canManage(req)) {
    res.status(403).json({ message: 'Permission denied' });
    return;
  }

  const name = typeof req.body?.name === 'string'
    ? req.body.name.trim() : '';
  const departmentId = typeof req.body?.departmentId === 'string'
    ? req.body.departmentId : '';

  if (!name || name.length > 100 ||
      !UUID.test(departmentId) || departmentId.length > 40) {
    res.status(400).json({ message: 'Invalid designation or department' });
    return;
  }

  try {
    const result = await getDbPool().query(
      'SELECT pali_runtime.create_role_designation($1,$2) AS id',
      [name, departmentId]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
}

export async function editRoleMaster(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  if (!canManage(req)) {
    res.status(403).json({ message: 'Permission denied' });
    return;
  }

  const id = String(req.params.id || '');
  const name = typeof req.body?.name === 'string'
    ? req.body.name.trim() : '';
  const departmentId = typeof req.body?.departmentId === 'string'
    ? req.body.departmentId : '';

  if (!UUID.test(id) || id.length > 50 ||
      !name || name.length > 100 ||
      !UUID.test(departmentId) || departmentId.length > 40) {
    res.status(400).json({ message: 'Invalid designation update' });
    return;
  }

  try {
    const result = await getDbPool().query(
      'SELECT pali_runtime.edit_role_designation($1,$2,$3) AS id',
      [id, name, departmentId]
    );
    if (!result.rows[0]?.id) {
      res.status(404).json({ message: 'Designation not found' });
      return;
    }
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
}

export async function removeRoleMaster(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  if (!canManage(req)) {
    res.status(403).json({ message: 'Permission denied' });
    return;
  }

  const id = String(req.params.id || '');
  if (!UUID.test(id) || id.length > 50) {
    res.status(400).json({ message: 'Invalid designation ID' });
    return;
  }

  try {
    const result = await getDbPool().query(
      'SELECT pali_runtime.remove_role_designation($1) AS id',
      [id]
    );
    if (!result.rows[0]?.id) {
      res.status(404).json({ message: 'Designation not found' });
      return;
    }
    res.json({ deleted: true });
  } catch (err: any) {
    if (err?.code === '23503' || err?.code === '42501') {
      res.status(409).json({
        message: 'This designation is protected or still has employees, permissions, or other references.'
      });
      return;
    }
    next(err);
  }
}
