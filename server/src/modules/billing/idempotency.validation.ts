import type {RequestHandler} from 'express';
import {BadRequestError} from '../../utils/errors.js';
/** Payments/refunds persist their caller key in a VARCHAR(64) column. */
export const validateBillingIdempotencyKey:RequestHandler=(req,_res,next)=>{
  const key=req.headers['idempotency-key'];
  if(key!==undefined&&(typeof key!=='string'||key.trim().length===0||key.length>64)){
    next(new BadRequestError('Idempotency-Key must contain 1 to 64 characters.'));return;
  }
  next();
};
