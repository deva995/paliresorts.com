import { Request, Response, NextFunction } from 'express';
import { getDbPool } from '../../db/pool.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function updateStaffProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const id = String(req.params.id || '');
  const body = req.body;

  if (!UUID.test(id) || !body ||
      typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({ message: 'Invalid employee update' });
    return;
  }

  const allowed = ['firstName', 'lastName', 'email', 'phone'];
  const keys = Object.keys(body);

  if (
    !keys.length ||
    keys.some(key => !allowed.includes(key)) ||
    keys.some(key => typeof body[key] !== 'string') ||
    (body.firstName !== undefined &&
      (!body.firstName.trim() || body.firstName.trim().length > 100)) ||
    (body.lastName !== undefined && body.lastName.trim().length > 100) ||
    (body.email !== undefined &&
      (body.email.length > 150 ||
       !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))) ||
    (body.phone !== undefined &&
      (body.phone.trim().length < 5 || body.phone.trim().length > 20))
  ) {
    res.status(400).json({ message: 'Invalid employee fields' });
    return;
  }

  const columns: Record<string, string> = {
    firstName: 'first_name',
    lastName: 'last_name',
    email: 'email',
    phone: 'phone'
  };

  const assignments: string[] = [];
  const values: string[] = [];

  for (const key of keys) {
    const value = key === 'email'
      ? body[key].trim().toLowerCase()
      : body[key].trim();

    values.push(value);
    assignments.push(`${columns[key]} = $${values.length}`);
  }

  values.push(id);

  try {
    const result = await getDbPool().query(
      `SELECT * FROM pali_runtime.edit_employee_profile(
         $1::uuid, $2::text, $3::text, $4::text, $5::text
       )`,
      [
        id,
        body.firstName === undefined ? null : body.firstName.trim(),
        body.lastName === undefined ? null : body.lastName.trim(),
        body.email === undefined ? null : body.email.trim().toLowerCase(),
        body.phone === undefined ? null : body.phone.trim()
      ]
    );

    if (!result.rows.length) {
      res.status(404).json({ message: 'Employee not found' });
      return;
    }

    res.status(200).json({ item: result.rows[0] });
  } catch (err) {
    if ((err as {code?: string})?.code === '23505') {
      res.status(409).json({ message: 'Employee email or phone already exists' });
      return;
    }
    next(err);
  }
}
