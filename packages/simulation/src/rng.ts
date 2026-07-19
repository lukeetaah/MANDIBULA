export function nextRandom(state: number): [number, number] {
  let x = state | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const next = x >>> 0 || 0x6d2b79f5;
  return [next, next / 0x1_0000_0000];
}

export function randomRange(
  state: number,
  min: number,
  max: number,
): [number, number] {
  const [next, value] = nextRandom(state);
  return [next, min + value * (max - min)];
}
