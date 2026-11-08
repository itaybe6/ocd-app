import frames from './productImageFrames.json';

type Frame = readonly number[];
const imageFrames: Record<string, Frame> = frames;

/** Fits the measured product bounds into a square without stretching the original photo. */
export function productImageFraming(imageUrl: string) {
  const frame = imageFrames[imageUrl];
  if (!frame || frame.length !== 5) return null;
  const [x, y, width, height, aspect] = frame;
  if (![x, y, width, height, aspect].every(Number.isFinite)
    || x < 0 || y < 0 || width <= 0 || height <= 0 || aspect <= 0
    || x + width > 1.001 || y + height > 1.001) return null;
  // Limit magnification even for tiny objects; leave unknown/new image versions untouched.
  const scale = Math.min(0.96 / Math.max(width * aspect, height), 1.8 / Math.max(aspect, 1));
  if (scale * Math.max(aspect, 1) <= 1.04) return null;
  const percent = (value: number): `${number}%` => `${value * 100}%`;
  return {
    width: percent(aspect * scale),
    height: percent(scale),
    start: percent((1 - width * aspect * scale) / 2 - x * aspect * scale),
    top: percent((1 - height * scale) / 2 - y * scale),
  };
}
