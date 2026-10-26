/** Convert a nonnegative decimal rupee input without silently rounding fractions of paise. */
export function rupeesToPaise(value:string):number|null {
  if(!/^\d+(?:\.\d{1,2})?$/.test(value.trim()))return null;
  const [whole,fraction='']=value.trim().split('.');
  const result=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  return Number.isSafeInteger(result)?result:null;
}
