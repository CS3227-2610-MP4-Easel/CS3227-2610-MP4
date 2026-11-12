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
export type Facts = {
  asOf: string;
  pointsTotal: number;
  pointsDone: number;
  pointsRemaining: number;
  unestimatedTasks: number;
  velocity: { sprintId: string; name: string; completedPoints: number }[];
  avgVelocity: number | null;
  projectedCompletionDate: string | null;
  checkpoints: { id: string; name: string; targetDate: string; remainingPoints: number; projectedDate: string | null; risk: 'ON_TRACK' | 'AT_RISK' | 'UNKNOWN' }[];
  overload: { userId: string; displayName: string; openPoints: number; avgCompletedPerSprint: number | null; projects: { projectId: string; name: string; openPoints: number }[] }[];
};
export type LeadDigest = { id: string; projectId: string; facts: Facts; explanation: string | null; degraded: boolean; flagged: boolean; proposalId: string | null; cached: boolean; createdAt: string };
export type Suggestion = { id: string; text: string; state: 'PENDING' | 'APPLIED' | 'DISMISSED' };

export type TeamStandup = { date: string; person: Person; yesterday: string[]; today: string[]; blockers: string[]; outcome: 'GENERATED' | 'EDITED' | 'ACCEPTED'; activityOnly: boolean; flagged: boolean };
export type AiSession = { id: string; feature: string; startedAt: string; outcome: 'Accepted' | 'Rejected' | 'Open'; regens: number; feedback: 'up' | 'down' | null; calls: number; prompt: number; completion: number; cost: number; elapsed: number };

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

export type Page<T> = { items: T[]; page: number; size: number; total: number };
export type LiveUserRole = 'PM' | 'DEV_LEAD' | 'DEVELOPER';
export type LiveProjectStatus = 'ACTIVE' | 'ARCHIVED';
export type LiveTaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type LiveStoryPoints = 1 | 2 | 3 | 5 | 8 | 13;

export type LiveProjectDetail = {
  id: string;
  name: string;
  brief: string | null;
  status: LiveProjectStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  progress: { pointsTotal: number; pointsDone: number; percent: number; unestimatedTasks: number };
};

export type LiveProgress = {
  pointsTotal: number;
  pointsDone: number;
  percent: number;
  unestimatedTasks: number;
  velocity: { sprintId: string; name: string; completedPoints: number }[];
};

export type LiveMember = { userId: string; displayName: string; role: LiveUserRole; addedAt: string };

export type LiveCheckpoint = {
  id: string;
  projectId: string;
  name: string;
  targetDate: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type LiveEpic = {
  id: string;
  projectId: string;
  checkpointId: string | null;
  title: string;
  description: string | null;
  position: number;
  taskCount: number;
  pointsTotal: number;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type LiveTask = {
  id: string;
  projectId: string;
  epicId: string;
  sprintId: string | null;
  assigneeId: string | null;
  title: string;
  description: string | null;
  acceptanceCriteria: string[];
  status: LiveTaskStatus;
  blocked: boolean;
  blockedReason: string | null;
  storyPoints: LiveStoryPoints | null;
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type LiveTaskListFilters = {
  status?: LiveTaskStatus;
  epicId?: string;
  assigneeId?: string;
  blocked?: boolean;
};

export type LiveEpicCreateInput = { title: string; description?: string | null; checkpointId?: string | null };
export type LiveCheckpointCreateInput = { name: string; targetDate: string };
export type LiveTaskCreateInput = {
  epicId: string;
  title: string;
  description?: string | null;
  acceptanceCriteria?: string[];
  storyPoints?: LiveStoryPoints | null;
  assigneeId?: string | null;
};
export type LiveTaskUpdateInput = {
  title?: string;
  description?: string | null;
  acceptanceCriteria?: string[];
  storyPoints?: LiveStoryPoints | null;
  assigneeId?: string | null;
  version: number;
};
export type LiveTaskStatusInput = { status: LiveTaskStatus; blocked?: boolean; blockedReason?: string | null; version: number };
