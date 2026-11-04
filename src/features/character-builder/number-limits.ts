export const NUMBER_LIMITS: Readonly<Record<string, { min: number; max: number; integer: boolean }>> = {
  detailCount: { min: 0, max: 20, integer: true },
  shotCount: { min: 1, max: 20, integer: true },
  steps: { min: 1, max: 150, integer: true },
  cfg: { min: 0, max: 30, integer: false },
  seed: { min: -1, max: 4294967295, integer: true },
};

export function isValidNumber(id: string, value: string): boolean {
  if (!value) return true;
  const limits = NUMBER_LIMITS[id];
  if (!limits || !/^-?\d+(?:\.\d+)?$/u.test(value)) return false;
  const number = Number(value);
  return Number.isFinite(number) && (!limits.integer || Number.isSafeInteger(number)) && number >= limits.min && number <= limits.max;
}
