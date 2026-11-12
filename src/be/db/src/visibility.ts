type RelationCardinality = "one" | "many";
export type VisibilityEntry = {
  softDelete: boolean;
  projectScope: "required" | "nullable" | "root" | "none";
  projectPath?: string[];
  relations: Record<string, string>;
  cardinality: Record<string, RelationCardinality>;
};

const entry = (softDelete: boolean, projectScope: VisibilityEntry["projectScope"], relations: Record<string, string>, cardinality: Record<string, RelationCardinality>, projectPath?: string[]): VisibilityEntry => ({ softDelete, projectScope, relations, cardinality, ...(projectPath ? { projectPath } : {}) });

export const VISIBILITY_POLICY: Readonly<Record<string, VisibilityEntry>> = Object.freeze({
  Project: entry(false, "root", { creator: "User", members: "ProjectMember", checkpoints: "Checkpoint", epics: "Epic", sprints: "Sprint", tasks: "Task", taskEvents: "TaskEvent", proposals: "AiProposal", sessions: "AiSession", calls: "LlmCall", activityItems: "ActivityItem", standups: "Standup", digests: "ProjectDigest" }, { creator: "one", members: "many", checkpoints: "many", epics: "many", sprints: "many", tasks: "many", taskEvents: "many", proposals: "many", sessions: "many", calls: "many", activityItems: "many", standups: "many", digests: "many" }),
  User: entry(false, "none", { projectsCreated: "Project", memberships: "ProjectMember", membersAdded: "ProjectMember", tasksCreated: "Task", taskEvents: "TaskEvent", sessions: "AiSession", proposalsCreated: "AiProposal", proposalsApplied: "AiProposal", activityItems: "ActivityItem", standups: "Standup" }, { projectsCreated: "many", memberships: "many", membersAdded: "many", tasksCreated: "many", taskEvents: "many", sessions: "many", proposalsCreated: "many", proposalsApplied: "many", activityItems: "many", standups: "many" }),
  ProjectMember: entry(false, "required", { project: "Project", user: "User", adder: "User", assignedTasks: "Task" }, { project: "one", user: "one", adder: "one", assignedTasks: "many" }),
  Checkpoint: entry(true, "required", { project: "Project", epics: "Epic" }, { project: "one", epics: "many" }),
  Epic: entry(true, "required", { project: "Project", checkpoint: "Checkpoint", tasks: "Task" }, { project: "one", checkpoint: "one", tasks: "many" }),
  // SprintService performs project membership/archive checks before exposing these rows.
  Sprint: entry(true, "none", { project: "Project", tasks: "Task" }, { project: "one", tasks: "many" }),
  Task: entry(true, "required", { project: "Project", epic: "Epic", sprint: "Sprint", assignee: "ProjectMember", creator: "User", events: "TaskEvent" }, { project: "one", epic: "one", sprint: "one", assignee: "one", creator: "one", events: "many" }),
  TaskEvent: entry(false, "required", { task: "Task", project: "Project", actor: "User" }, { task: "one", project: "one", actor: "one" }),
  // ProposalService and the API policy layer enforce project access; resolvers need archived rows to map mutations to 409.
  AiProposal: entry(false, "none", { project: "Project", session: "AiSession", creator: "User", applier: "User", epics: "ProposalEpic", digests: "ProjectDigest" }, { project: "one", session: "one", creator: "one", applier: "one", epics: "many", digests: "many" }),
  ProposalEpic: entry(false, "required", { proposal: "AiProposal" }, { proposal: "one" }, ["proposal", "project"]),
  AiSession: entry(false, "nullable", { user: "User", project: "Project", calls: "LlmCall", proposals: "AiProposal", standups: "Standup", digests: "ProjectDigest" }, { user: "one", project: "one", calls: "many", proposals: "many", standups: "many", digests: "many" }),
  LlmCall: entry(false, "nullable", { session: "AiSession", project: "Project", summaries: "ItemSummary" }, { session: "one", project: "one", summaries: "many" }),
  ActivityItem: entry(false, "required", { project: "Project", uploader: "User", summaries: "ItemSummary" }, { project: "one", uploader: "one", summaries: "many" }),
  ItemSummary: entry(false, "required", { item: "ActivityItem", call: "LlmCall" }, { item: "one", call: "one" }, ["item", "project"]),
  Standup: entry(false, "required", { project: "Project", developer: "User", session: "AiSession" }, { project: "one", developer: "one", session: "one" }),
  ProjectDigest: entry(false, "required", { project: "Project", proposal: "AiProposal", session: "AiSession" }, { project: "one", proposal: "one", session: "one" }),
});

const compoundSelectors: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  ProjectMember: { projectId_userId: "projectId,userId" },
  Checkpoint: { projectId_id: "projectId,id" },
  Epic: { projectId_id: "projectId,id" },
  Sprint: { projectId_id: "projectId,id" },
  ProposalEpic: { proposalId_index: "proposalId,index" },
  ActivityItem: { projectId_uploadedBy_itemType_repo_externalId: "projectId,uploadedBy,itemType,repo,externalId" },
  ItemSummary: { itemId_contentHash_guardVersion_promptVersion: "itemId,contentHash,guardVersion,promptVersion" },
  Standup: { projectId_developerId_standupDate: "projectId,developerId,standupDate" },
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function normalizeUniqueSelector(model: string, where: Record<string, unknown>): Record<string, unknown> {
  const selectors = compoundSelectors[model] ?? {};
  for (const [selector, fieldList] of Object.entries(selectors)) {
    if (!(selector in where)) continue;
    const value = where[selector];
    const fields = fieldList.split(",");
    if (!isRecord(value) || fields.some((field) => !(field in value)) || Object.keys(value).some((field) => !fields.includes(field))) throw new Error("NOT_FOUND");
    const flattened = { ...where };
    delete flattened[selector];
    for (const field of fields) {
      if (field in flattened && flattened[field] !== value[field]) throw new Error("NOT_FOUND");
      flattened[field] = value[field];
    }
    return flattened;
  }
  return { ...where };
}

function visibleWhere(model: string, callerWhere: Record<string, unknown>): Record<string, unknown> {
  const policy = VISIBILITY_POLICY[model];
  if (!policy) throw new Error(`Missing visibility policy for ${model}`);
  const base: Record<string, unknown> = {};
  if (policy.projectScope === "root") base.status = "ACTIVE";
  if (policy.softDelete) base.deletedAt = null;
  if (policy.projectScope === "required") {
    const path = policy.projectPath ?? ["project"];
    let relation: Record<string, unknown> = { status: "ACTIVE" };
    for (const segment of path.slice().reverse()) relation = { [segment]: relation };
    Object.assign(base, relation);
  }
  if (policy.projectScope === "nullable") base.OR = [{ projectId: null }, { project: { status: "ACTIVE" } }];
  const caller = { ...callerWhere };
  const callerAnd = Array.isArray(caller.AND) ? caller.AND : caller.AND ? [caller.AND] : [];
  const callerOr = Array.isArray(caller.OR) ? caller.OR : undefined;
  delete caller.AND;
  delete caller.OR;
  if (callerOr || callerAnd.length > 0) return { AND: [...callerAnd, ...(callerOr ? [{ OR: callerOr }] : []), ...(Object.keys(caller).length > 0 ? [caller] : []), base] };
  if (Object.keys(caller).some((key) => key in base)) return { AND: [caller, base] };
  return { ...caller, ...base };
}

function isVisibleRecord(model: string, value: Record<string, unknown>): boolean {
  const policy = VISIBILITY_POLICY[model];
  if (!policy) return true;
  if (policy.softDelete && value.deletedAt !== undefined && value.deletedAt !== null) return false;
  if (policy.projectScope === "root" && value.status !== undefined && value.status !== "ACTIVE") return false;
  if (policy.projectScope === "required" && policy.projectPath) {
    let current: unknown = value;
    for (const segment of policy.projectPath) {
      if (!isRecord(current) || !isRecord(current[segment])) return true;
      current = current[segment];
    }
    if (isRecord(current) && current.status !== "ACTIVE") return false;
  } else if ((policy.projectScope === "required" || policy.projectScope === "nullable") && isRecord(value.project) && value.project.status !== undefined && value.project.status !== "ACTIVE") return false;
  return true;
}

export function sanitizeVisibleResult(model: string, value: unknown, args?: Record<string, unknown>): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeVisibleResult(model, item, args)).filter((item) => item !== null);
  if (!isRecord(value)) return value;
  if (!isVisibleRecord(model, value)) return null;
  const result = { ...value };
  const policy = VISIBILITY_POLICY[model];
  if (!policy) return result;
  for (const [relation, target] of Object.entries(policy.relations)) {
    if (!(relation in result)) continue;
    const relationValue = result[relation];
    const selections = isRecord(args?.select) ? args.select : isRecord(args?.include) ? args.include : {};
    const nested = isRecord(selections[relation]) ? selections[relation] as Record<string, unknown> : {};
    result[relation] = relationValue === null ? null : sanitizeVisibleResult(target, relationValue, args ? nested : undefined);
  }
  if (args && isRecord(args.select)) {
    for (const key of Object.keys(result)) if (!args.select[key]) delete result[key];
  } else if (args) {
    for (const key of Object.keys(policy.relations)) if (key in result && (!isRecord(args.include) || !args.include[key])) delete result[key];
  }
  if (isRecord(args?.omit)) for (const [key, omitted] of Object.entries(args.omit)) if (omitted) delete result[key];
  return result;
}

function includeVisibility(model: string, args: Record<string, unknown>): Record<string, unknown> {
  const policy = VISIBILITY_POLICY[model];
  if (!policy) return args;
  const result = { ...args };
  if (isRecord(result.select)) {
    result.select = { ...result.select };
    if (policy.softDelete) (result.select as Record<string, unknown>).deletedAt = true;
    if (policy.projectScope === "root") (result.select as Record<string, unknown>).status = true;
  }
  if (isRecord(result.omit)) {
    result.omit = { ...result.omit };
    if (policy.softDelete) (result.omit as Record<string, unknown>).deletedAt = false;
    if (policy.projectScope === "root") (result.omit as Record<string, unknown>).status = false;
  }
  const path = policy.projectScope === "required" ? policy.projectPath ?? ["project"] : policy.projectScope === "nullable" ? ["project"] : [];
  if (path.length) {
    const key = isRecord(result.select) ? "select" : "include";
    const selection = isRecord(result[key]) ? { ...result[key] as Record<string, unknown> } : {};
    const relation = path[0];
    const existing = selection[relation];
    if (existing !== true) {
      const child = isRecord(existing) ? existing : {};
      const injectPath = (segments: string[], nested: Record<string, unknown>): Record<string, unknown> => {
        if (!segments.length) {
          if (isRecord(nested.select)) return { ...nested, select: { ...nested.select, status: true } };
          if (isRecord(nested.omit)) return { ...nested, omit: { ...nested.omit, status: false } };
          return nested;
        }
        const container = isRecord(nested.select) ? "select" : "include";
        const fields = isRecord(nested[container]) ? { ...nested[container] as Record<string, unknown> } : {};
        const previous = fields[segments[0]];
        if (previous !== true) fields[segments[0]] = injectPath(segments.slice(1), isRecord(previous) ? previous : {});
        return { ...nested, [container]: fields };
      };
      selection[relation] = injectPath(path.slice(1), child);
    }
    result[key] = selection;
  }
  return result;
}

function transformRelationValue(targetModel: string, value: unknown, cardinality: RelationCardinality): unknown {
  if (value === true) return cardinality === "many" ? { where: visibleWhere(targetModel, {}) } : includeVisibility(targetModel, {});
  if (!isRecord(value)) return value;
  const transformed = { ...value };
  if (cardinality === "many") transformed.where = visibleWhere(targetModel, isRecord(transformed.where) ? transformed.where : {});
  if (isRecord(transformed.select)) transformed.select = transformNested(targetModel, transformed.select);
  if (isRecord(transformed.include)) transformed.include = transformNested(targetModel, transformed.include);
  if (isRecord(transformed._count)) transformed._count = transformCount(targetModel, transformed._count);
  return cardinality === "one" ? includeVisibility(targetModel, transformed) : transformed;
}

function transformCount(model: string, count: Record<string, unknown>): Record<string, unknown> {
  const result = { ...count };
  if (isRecord(result.select)) {
    result.select = Object.fromEntries(Object.entries(result.select).map(([relation, value]) => {
      const target = VISIBILITY_POLICY[model]?.relations[relation];
      const cardinality = VISIBILITY_POLICY[model]?.cardinality[relation];
      return [relation, target && cardinality === "many" ? transformRelationValue(target, value, cardinality) : value];
    }));
  }
  return result;
}

function transformNested(model: string, node: Record<string, unknown>): Record<string, unknown> {
  const result = { ...node };
  const policy = VISIBILITY_POLICY[model];
  if (!policy) return result;
  for (const [relation, target] of Object.entries(policy.relations)) {
    if (relation in result) result[relation] = transformRelationValue(target, result[relation], policy.cardinality[relation]);
  }
  if (isRecord(result._count)) result._count = transformCount(model, result._count);
  return result;
}

export function applyVisibilityToArgs(model: string, args: Record<string, unknown>): Record<string, unknown> {
  const result = { ...args };
  result.where = visibleWhere(model, isRecord(args.where) ? args.where : {});
  if (isRecord(result.select)) result.select = transformNested(model, result.select);
  if (isRecord(result.include)) result.include = transformNested(model, result.include);
  if (isRecord(result._count)) result._count = transformCount(model, result._count);
  return result;
}

export function isVisibleUniqueResult(model: string, result: unknown): unknown {
  return sanitizeVisibleResult(model, result);
}
