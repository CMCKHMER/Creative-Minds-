export interface ScoreEntry {
  name: string;
  score: number;
  level: number;
  date: number;
}

const KEY = "brickforge_scores_v1";
export const MAX_ENTRIES = 8;

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScoreEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => typeof e.score === "number")
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function saveScores(list: ScoreEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {
    /* ignore */
  }
}

export function qualifies(score: number): boolean {
  if (score <= 0) return false;
  const list = loadScores();
  if (list.length < MAX_ENTRIES) return true;
  return score > list[list.length - 1].score;
}

/** Adds an entry and returns its rank (1-based) */
export function addScore(entry: ScoreEntry): number {
  const list = loadScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, MAX_ENTRIES);
  saveScores(trimmed);
  return trimmed.indexOf(entry) + 1;
}

export function bestScore(): number {
  const list = loadScores();
  return list.length ? list[0].score : 0;
}

export function loadLastName(): string {
  try {
    return localStorage.getItem("brickforge_name") || "";
  } catch {
    return "";
  }
}

export function saveLastName(name: string) {
  try {
    localStorage.setItem("brickforge_name", name);
  } catch {
    /* ignore */
  }
}
