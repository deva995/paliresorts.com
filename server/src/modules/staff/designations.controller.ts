import { Request, Response, NextFunction } from 'express';
import { getDbPool } from '../../db/pool.js';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const designationQuery = (scoped: boolean) => `
  SELECT d.id, d.code, d.name,
         d.is_active AS "isActive",
         ${scoped
           ? `COUNT(DISTINCT s.id) FILTER (WHERE EXISTS (
                SELECT 1 FROM public.staff_outlet_access soa
                WHERE soa.staff_id = s.id
                  AND soa.outlet_id = ANY($1::varchar[])
              ))::integer`
           : 'COUNT(DISTINCT s.id)::integer'
         } AS "staffCount"
  FROM public.designations d
  LEFT JOIN public.staff s ON s.designation_id = d.id
  GROUP BY d.id, d.code, d.name, d.is_active
  ORDER BY d.name
`;

function databaseError(err: unknown, res: Response, next: NextFunction) {
  const code = (err as { code?: string })?.code;
  if (code === '23505') {
    res.status(409).json({ message: 'Designation already exists' });
    return;
  }
  if (code === '23503') {
    res.status(409).json({ message: 'Designation is still referenced' });
    return;
  }
  next(err);
}

export async function listDesignations(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.staff) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const isSuperAdmin = req.staff.roles.some(
      role => role.id === 'SUPER_ADMIN'
    );
    const allowedOutlets = req.staff.outlets.map(
      outlet => outlet.outletId
    );

    const result = await getDbPool().query(
      designationQuery(!isSuperAdmin),
      isSuperAdmin ? [] : [allowedOutlets]
    );
    res.status(200).json({ items: result.rows });
  } catch (err) {
    next(err);
  }
}

export async function createDesignation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const name = typeof req.body?.name === 'string'
    ? req.body.name.trim() : '';

  const code = typeof req.body?.code === 'string'
    ? req.body.code.trim().toUpperCase() : '';

  if (
    !name || name.length > 100 ||
    !/^[A-Z][A-Z0-9_]{0,49}$/.test(code)
  ) {
    res.status(400).json({
      message: 'Valid designation name and code are required'
    });
    return;
  }

  try {
    const result = await getDbPool().query(
      `SELECT * FROM pali_runtime.create_staff_designation($1, $2)`,
      [code, name]
    );
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    databaseError(err, res, next);
  }
}

export async function updateDesignation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const id = String(req.params.id || '');
  const body = req.body || {};
  const keys = Object.keys(body);

  if (
    !uuidPattern.test(id) ||
    keys.length === 0 ||
    keys.some(k => !['name', 'isActive'].includes(k)) ||
    (body.name !== undefined &&
      (typeof body.name !== 'string' ||
       !body.name.trim() ||
       body.name.trim().length > 100)) ||
    (body.isActive !== undefined &&
      typeof body.isActive !== 'boolean')
  ) {
    res.status(400).json({ message: 'Invalid designation update' });
    return;
  }

  const changes: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) {
    values.push(body.name.trim());
    changes.push(`name = $${values.length}`);
  }

  if (body.isActive !== undefined) {
    values.push(body.isActive);
    changes.push(`is_active = $${values.length}`);
  }

  values.push(id);

  try {
    const result = await getDbPool().query(
      `SELECT * FROM pali_runtime.update_staff_designation_master(
         $1::uuid, $2::text, $3::boolean
       )`,
      [
        id,
        body.name === undefined ? null : body.name.trim(),
        body.isActive === undefined ? null : body.isActive
      ]
    );

    if (!result.rows.length) {
      res.status(404).json({ message: 'Designation not found' });
      return;
    }

    res.status(200).json({ item: result.rows[0] });
  } catch (err) {
    databaseError(err, res, next);
  }
}


// Permanent removal. The database checks assignment references while
// locking the designation row, preventing a stale UI count from being trusted.
export async function deleteDesignation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const id = String(req.params.id || '');

  if (!uuidPattern.test(id)) {
    res.status(400).json({ message: 'Invalid designation ID' });
    return;
  }

  try {
    const result = await getDbPool().query(
      `SELECT pali_runtime.delete_staff_designation($1::uuid) AS id`,
      [id]
    );

    if (!result.rows[0]?.id) {
      res.status(404).json({ message: 'Designation not found' });
      return;
    }

    res.status(200).json({ deleted: true });
  } catch (err) {
    databaseError(err, res, next);
  }
}
