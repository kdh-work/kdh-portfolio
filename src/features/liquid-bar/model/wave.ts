/** 입력 포화와 관계없이 최종 진폭에서 세기 차이를 유지한다. */
export const waveStrengths = [
  { value: .35, label: "잔잔" },
  { value: 1, label: "보통" },
  { value: 2, label: "출렁" },
] as const;

export function stepWave(offset: number, velocity: number, dt: number) {
  const nextVelocity = (velocity - offset * .09 * dt) * Math.pow(.88, dt);
  return { velocity: nextVelocity, offset: Math.max(-4, Math.min(4, offset + nextVelocity * dt)) };
}

/** 장식적 SVG 수면. 데이터 비율은 baseline으로만 결정한다. */
export function wavePath(baseline: number, displacement: number, phase: number): string {
  const points: string[] = [];
  for (let x = 0; x <= 100; x += 4) {
    const slope = displacement * (x / 100 - .5);
    const wave = Math.sin(x * .09 + phase) * Math.abs(displacement) * .2;
    const y = Math.max(1, Math.min(99, baseline + slope + wave));
    points.push(`${x},${y.toFixed(3)}`);
  }
  return `M0,100 L${points.join(" L")} L100,100 Z`;
}
