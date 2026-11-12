import type { PrismaClient } from "@prisma/client";
import { createDbClient } from "@agile/db";
import { createProposal } from "../src/index.js";
import type { Fixtures } from "./fakes.js";

export async function seed(base: PrismaClient, f: Fixtures, epicCount = 2) {
  const pm = await f.user();
  const project = await f.project(pm);
  await f.member(project, pm);
  const sessionId = await f.aiSession(pm, project);
  const db = createDbClient(base);
  const proposalId = await createProposal(db, {
    projectId: project, creatorId: pm, sessionId, flagged: false, approach: "the approach", checkpoints: [], retrieved: [],
    epics: Array.from({ length: epicCount }, (_, i) => ({ title: `Epic ${i}`, description: `d${i}`, checkpointName: null })),
  });
  return { pm, project, sessionId, db, proposalId };
}

/** Holds a row lock on the proposal until `release` is called; resolves `locked` once the lock is taken. */
export function holdProposalLock(base: PrismaClient, proposalId: string, inside?: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<void>) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let locked!: () => void;
  const lockedPromise = new Promise<void>((resolve) => { locked = resolve; });
  const holder = { pid: 0 };
  const done = base.$transaction(async (tx) => {
    await tx.aiProposal.update({ where: { id: proposalId }, data: { updatedAt: new Date() } });
    if (inside) await inside(tx);
    const rows = await tx.$queryRaw<{ pid: number }[]>`select pg_backend_pid() as pid`;
    holder.pid = Number(rows[0].pid);
    locked();
    await gate;
  }, { timeout: 30_000 });
  // A failed hold must not leave the test waiting forever.
  done.catch(() => locked());
  return { release, locked: lockedPromise, done, holder };
}

