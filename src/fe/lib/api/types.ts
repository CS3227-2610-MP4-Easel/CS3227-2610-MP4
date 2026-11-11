// Shapes follow docs/architecture/contracts.md until packages/contracts exists.
export type User = { id: string; email: string; displayName: string; role: 'PM' | 'DEV_LEAD' | 'DEVELOPER' };
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

export type TeamStandup = { date: string; person: Person; yesterday: string[]; today: string[]; blockers: string[]; outcome: 'GENERATED' | 'EDITED' | 'ACCEPTED'; activityOnly: boolean; flagged: boolean };
export type AiSession = { id: string; feature: string; startedAt: string; outcome: 'Accepted' | 'Rejected' | 'Open'; regens: number; feedback: 'up' | 'down' | null; calls: number; prompt: number; completion: number; cost: number; elapsed: number };

// Plan proposal (endpoints 34 to 41); mirrors PlanProposalSchema in @agile/contracts.
export type PlanTask = { title: string; description: string; acceptanceCriteria: string[]; storyPoints: number | null };
export type PlanEpic = { index: number; title: string; description: string; checkpointName: string | null; contentHash: string; expansion: { status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED'; tasks: PlanTask[] | null; error: string | null } };
export type PlanProposal = {
  id: string;
  projectId: string;
  kind: 'PLAN';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';
  approach: string;
  checkpoints: { name: string; targetDate: string }[];
  epics: PlanEpic[];
  retrieved: { source: string; projectId: string; projectName: string; id: string; title: string }[];
  flagged: boolean;
  createdAt: string;
  version: number;
};
export type CheckpointDraft = { name: string; targetDate: string; previousName?: string };
export type EpicPatch = { title?: string; description?: string; checkpointName?: string | null; tasks?: PlanTask[] };

// Created data, read back after approve (endpoints 12, 16, 20); mirrors CheckpointSchema, EpicSchema, TaskSchema.
export type LiveProject = { id: string; name: string; brief: string | null; status: 'ACTIVE' | 'ARCHIVED'; version: number; progress?: { pointsTotal: number; pointsDone: number; percent: number; unestimatedTasks: number } };
export type LiveCheckpoint ={ id: string; name: string; targetDate: string; version: number };
export type LiveEpic = { id: string; checkpointId: string | null; title: string; description: string | null; position: number; taskCount: number; pointsTotal: number; version: number };
export type LiveTask = { id: string; epicId: string; title: string; description: string | null; acceptanceCriteria: string[]; status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'; storyPoints: number | null; assigneeId: string | null; sprintId: string | null; blocked: boolean; blockedReason: string | null; version: number };
export type LiveMember = { userId: string; displayName: string; role: 'PM' | 'DEV_LEAD' | 'DEVELOPER'; addedAt: string };
export type LiveSprint = { id: string; name: string; status: SprintStatus; startDate: string; endDate: string; version: number };
export type Page<T> = { items: T[]; page: number; size: number; total: number };

export type PlanApproved ={ proposalId: string; status: 'APPROVED'; created: { checkpoints: number; epics: number; tasks: number } };

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
  teamStandups: TeamStandup[];
  aiSessions: AiSession[];
};
