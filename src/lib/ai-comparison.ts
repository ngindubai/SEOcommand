export type ComparableAnswer = { id: string; prompt: string; platform: string; capturedOn: string; capturedAt: string; sampleIndex: number; mentioned: boolean; cited: boolean; sentiment: string; responseText: string; responseHash: string; modelName: string };
export function matchedAiComparison(answers: ComparableAnswer[], first: string, second: string) {
  const key = (a: ComparableAnswer) => `${a.prompt}\0${a.capturedOn}\0${a.sampleIndex}`;
  const latest = (platform: string) => new Map([...answers].filter((a) => a.platform === platform).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)).map((a) => [key(a), a]));
  if (first === second) return { pairs: [], metrics: [] };
  const a = latest(first), b = latest(second), pairs = [...a].filter(([k]) => b.has(k)).map(([k, answer]) => ({ key: k, first: answer, second: b.get(k)! }));
  const metrics = (["first", "second"] as const).map((side) => ({ platform: side === "first" ? first : second, samples: pairs.length, mentionRate: pairs.length ? pairs.filter((p) => p[side].mentioned).length / pairs.length * 100 : null, citationRate: pairs.length ? pairs.filter((p) => p[side].cited).length / pairs.length * 100 : null }));
  return { pairs, metrics };
}
