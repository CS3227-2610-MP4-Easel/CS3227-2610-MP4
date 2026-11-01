// Shapes follow docs/architecture/contracts.md until packages/contracts exists.
export type TaskStatus = 'todo' | 'prog' | 'rev' | 'done';
export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'CLOSED';
export type Person = 'pn' | 'ml' | 'wo';

export type Task = {
  id: string;
  epic: string;
  title: string;
  points: number | null;
  assignee: Person | null;
  status: TaskStatus;
  blockedReason: string;
  sprintId: string | null;
  description: string;
  criteria: string[];
  version: number;
};

export type Epic = { id: string; title: string; description: string; checkpointId: string | null };
export type Sprint = { id: string; name: string; status: SprintStatus; startDate: string; endDate: string; version: number };
export type Member = { id: string; name: string; email: string; role: 'PM' | 'DEV_LEAD' | 'DEVELOPER' };
export type Checkpoint = { id: string; name: string; targetDate: string };
export type Project = { id: string; name: string; status: 'ACTIVE' | 'ARCHIVED'; version: number };
export type Standup = { id: string; date: string; yesterday: string[]; today: string[]; blockers: string[]; outcome: 'GENERATED' | 'EDITED' | 'ACCEPTED' };
export type Digest = { generatedAt: string; cached: boolean };
export type Suggestion = { id: string; text: string; state: 'PENDING' | 'APPLIED' | 'DISMISSED' };

export type Db = {
  project: Project;
  epics: Epic[];
  tasks: Task[];
  sprints: Sprint[];
  members: Member[];
  checkpoints: Checkpoint[];
  standup: Standup;
  digest: Digest;
  suggestions: Suggestion[];
  summariesMissing: number;
};
