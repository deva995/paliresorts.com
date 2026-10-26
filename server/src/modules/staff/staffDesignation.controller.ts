import { Request, Response, NextFunction } from 'express';
import { getDbPool } from '../../db/pool.js';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function assignStaffDesignation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const staffId = String(req.params.id || '');
  const body = req.body;

  if (
    !UUID.test(staffId) ||
    !body ||
    Object.keys(body).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(body, 'designationId') ||
    !(body.designationId === null ||
      (typeof body.designationId === 'string' &&
       UUID.test(body.designationId)))
  ) {
    res.status(400).json({
      message: 'Valid staff ID and designationId are required'
    });
    return;
  }

  try {
    const result = await getDbPool().query(
      `SELECT * FROM pali_runtime.assign_employee_designation(
         $1::uuid, $2::uuid
       )`,
      [staffId, body.designationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        message: 'Employee or active designation not found'
      });
      return;
    }

    res.status(200).json({ item: result.rows[0] });
  } catch (err) {
    next(err);
  }
}
