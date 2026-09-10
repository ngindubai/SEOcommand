export type ContentBenchmark = { url: string; title: string; headings: string[]; wordCount: number; capturedAt: string };
const words = (text: string): string[] => text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
function syllables(word: string) { if (word.length <= 3) return 1; return Math.max(1, (word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").match(/[aeiouy]{1,2}/g) ?? []).length); }
export function analyseContent(text: string, keywords: string[], benchmarks: ContentBenchmark[] = []) {
  const allWords = words(text), count = allWords.length, sentences = text.split(/[.!?]+(?:\s|$)/).filter((item) => words(item).length).length;
  const headings = [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => match[1]!);
  const normal = ` ${allWords.join(" ")} `;
  const coverage = [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))].map((keyword) => { const phrase = words(keyword).join(" "), needle = ` ${phrase} `; let occurrences = 0, offset = 0; if (phrase) while ((offset = normal.indexOf(needle, offset)) !== -1) { occurrences++; offset++; } return { keyword, occurrences, inHeading: headings.some((heading) => ` ${words(heading).join(" ")} `.includes(needle)) }; });
  const topics = [...new Set(benchmarks.flatMap((item) => item.headings))].slice(0, 80).map((heading) => { const meaningful = words(heading).filter((word) => word.length > 3); const matches = meaningful.filter((word) => allWords.includes(word)).length; return { heading, missing: meaningful.length >= 2 && matches / meaningful.length < .5 }; });
  return { words: count, sentences, headings, readingMinutes: count ? Math.ceil(count / 220) : 0, readability: count >= 100 && sentences > 0 ? Math.round((206.835 - 1.015 * count / sentences - 84.6 * allWords.reduce((sum, word) => sum + syllables(word), 0) / count) * 10) / 10 : null, coverage, topics, benchmarkWordRange: benchmarks.length ? { min: Math.min(...benchmarks.map((item) => item.wordCount)), max: Math.max(...benchmarks.map((item) => item.wordCount)) } : null };
}
export function benchmarkHtml(html: string, url: string, capturedAt = new Date().toISOString()): ContentBenchmark {
  const clean = (text: string) => text.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
  const body = html.replace(/<(script|style|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  return { url, capturedAt, title: clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""), headings: [...body.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((match) => clean(match[1]!)).filter(Boolean).slice(0, 40), wordCount: words(clean(body)).length };
}
