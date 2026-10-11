/** Unknown sizes remain eligible until the browser has loaded the actual image. */
export function isOverlongImage(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > width * 3;
}
