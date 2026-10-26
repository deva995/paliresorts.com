/** Validate the entered price before a blank numeric field can become zero. */
export function parseMenuPrice(value: string | number): number {
  if (typeof value === 'string' && !value.trim()) throw new Error('Enter a price zero or greater.');
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0 || !Number.isSafeInteger(Math.round(price * 100))) {
    throw new Error('Enter a valid price zero or greater.');
  }
  return price;
}
