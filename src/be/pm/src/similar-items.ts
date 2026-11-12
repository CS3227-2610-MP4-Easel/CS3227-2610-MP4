import { registerContextSource, type ContextRow, type ContextSource } from "@agile/ai-context";
import type { FilteredDbClient } from "@agile/db";
import type { PmSettings } from "./settings.js";

type Deps = { db: FilteredDbClient; settings: PmSettings };
type Candidate = { id: string; projectId: string; title: string; type: "EPIC" | "TASK"; hits: number };

const MAX_KEYWORDS = 8;
const CANDIDATES_PER_TABLE = 50;
const MAX_ROWS = 5;
const MAX_TEXT = 200;

function keywordsOf(query: string): string[] {
  const found = query.match(/[\p{L}\p{N}]{4,}/gu) ?? [];
  return [...new Set(found.map((word) => word.toLowerCase()))].slice(0, MAX_KEYWORDS);
}

function compareCodePoints(a: string, b: string): number {
  const left = Array.from(a);
  const right = Array.from(b);
  const length = Math.min(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const x = left[i]!.codePointAt(0)!;
    const y = right[i]!.codePointAt(0)!;
    if (x !== y) return x < y ? -1 : 1;
  }
  return left.length === right.length ? 0 : left.length < right.length ? -1 : 1;
}

/** Titles of epics and tasks in the caller's member projects that share keywords with `options.query` (spec SD5). */
export function createSimilarItemsSource(deps: Deps): ContextSource {
  const { db, settings } = deps;
  return async ({ caller, options }): Promise<ContextRow[]> => {
    if (!settings.similarItems) return [];
    if (typeof options.query !== "string") return [];
    const keywords = keywordsOf(options.query);
    if (keywords.length === 0) return [];
    // Narrow to the caller's own projects before searching; W6's membership check is only a backstop.
    const memberships = await db.projectMember.findMany({ where: { userId: caller.userId }, select: { projectId: true } });
    const ids = memberships.map((row) => row.projectId);
    if (ids.length === 0) return [];
    const query = {
      where: { projectId: { in: ids }, OR: keywords.map((k) => ({ title: { contains: k, mode: "insensitive" as const } })) },
      orderBy: { id: "asc" as const },
      take: CANDIDATES_PER_TABLE,
      select: { id: true, projectId: true, title: true },
    };
    const [epics, tasks] = await Promise.all([db.epic.findMany(query), db.task.findMany(query)]);
    const rank = (title: string): number => {
      const lower = title.toLowerCase();
      return keywords.filter((k) => lower.includes(k)).length;
    };
    const candidates: Candidate[] = [
      ...epics.map((row): Candidate => ({ ...row, type: "EPIC", hits: rank(row.title) })),
      ...tasks.map((row): Candidate => ({ ...row, type: "TASK", hits: rank(row.title) })),
    ];
    candidates.sort((a, b) =>
      b.hits - a.hits
      || (a.type === b.type ? 0 : a.type === "EPIC" ? -1 : 1)
      || compareCodePoints(a.title, b.title)
      || compareCodePoints(a.id, b.id));
    return candidates
      .filter((row) => row.hits > 0)
      .slice(0, MAX_ROWS)
      .map((row): ContextRow => ({ projectId: row.projectId, ref: { type: row.type, id: row.id }, text: Array.from(row.title).slice(0, MAX_TEXT).join("") }));
  };
}

export function registerSimilarItems(deps: Deps): void {
  registerContextSource("pm.similarItems", createSimilarItemsSource(deps));
}
