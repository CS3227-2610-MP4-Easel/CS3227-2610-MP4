type RelationCardinality = "one" | "many";
export type VisibilityEntry = {
  softDelete: boolean;
  projectScope: "required" | "nullable" | "root";
  relations: Record<string, string>;
  cardinality: Record<string, RelationCardinality>;
};

const entry = (softDelete: boolean, projectScope: VisibilityEntry["projectScope"], relations: Record<string, string>, cardinality: Record<string, RelationCardinality>): VisibilityEntry => ({ softDelete, projectScope, relations, cardinality });

export const VISIBILITY_POLICY: Readonly<Record<string, VisibilityEntry>> = Object.freeze({
  Project: entry(false, "root", { members: "ProjectMember", checkpoints: "Checkpoint", epics: "Epic", sprints: "Sprint", tasks: "Task", taskEvents: "TaskEvent", proposals: "AiProposal", sessions: "AiSession", calls: "LlmCall", activityItems: "ActivityItem", standups: "Standup", digests: "ProjectDigest" }, { members: "many", checkpoints: "many", epics: "many", sprints: "many", tasks: "many", taskEvents: "many", proposals: "many", sessions: "many", calls: "many", activityItems: "many", standups: "many", digests: "many" }),
  ProjectMember: entry(false, "required", { project: "Project", assignedTasks: "Task" }, { project: "one", assignedTasks: "many" }),
  Checkpoint: entry(true, "required", { project: "Project", epics: "Epic" }, { project: "one", epics: "many" }),
  Epic: entry(true, "required", { project: "Project", checkpoint: "Checkpoint", tasks: "Task" }, { project: "one", checkpoint: "one", tasks: "many" }),
  Sprint: entry(true, "required", { project: "Project", tasks: "Task" }, { project: "one", tasks: "many" }),
  Task: entry(true, "required", { project: "Project", epic: "Epic", sprint: "Sprint", assignee: "ProjectMember", events: "TaskEvent" }, { project: "one", epic: "one", sprint: "one", assignee: "one", events: "many" }),
  TaskEvent: entry(false, "required", { task: "Task", project: "Project", actor: "User" }, { task: "one", project: "one", actor: "one" }),
  AiProposal: entry(false, "required", { project: "Project", session: "AiSession", epics: "ProposalEpic", digests: "ProjectDigest" }, { project: "one", session: "one", epics: "many", digests: "many" }),
  ProposalEpic: entry(false, "required", { proposal: "AiProposal" }, { proposal: "one" }),
  AiSession: entry(false, "nullable", { user: "User", project: "Project", calls: "LlmCall", proposals: "AiProposal", standups: "Standup", digests: "ProjectDigest" }, { user: "one", project: "one", calls: "many", proposals: "many", standups: "many", digests: "many" }),
  LlmCall: entry(false, "nullable", { session: "AiSession", project: "Project", summaries: "ItemSummary" }, { session: "one", project: "one", summaries: "many" }),
  ActivityItem: entry(false, "required", { project: "Project", uploader: "User", summaries: "ItemSummary" }, { project: "one", uploader: "one", summaries: "many" }),
  ItemSummary: entry(false, "required", { item: "ActivityItem", call: "LlmCall" }, { item: "one", call: "one" }),
  Standup: entry(false, "required", { project: "Project", developer: "User", session: "AiSession" }, { project: "one", developer: "one", session: "one" }),
  ProjectDigest: entry(false, "required", { project: "Project", proposal: "AiProposal", session: "AiSession" }, { project: "one", proposal: "one", session: "one" }),
});

const compoundSelectors: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  ProjectMember: { projectId_userId: "projectId,userId" },
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
  if (!policy) return { ...callerWhere };
  const base: Record<string, unknown> = {};
  if (policy.projectScope === "root") base.status = "ACTIVE";
  if (policy.softDelete) base.deletedAt = null;
  if (policy.projectScope === "required") base.project = { status: "ACTIVE" };
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

function transformRelationValue(targetModel: string, value: unknown, cardinality: RelationCardinality): unknown {
  if (value === true) return cardinality === "many" ? { where: visibleWhere(targetModel, {}) } : value;
  if (!isRecord(value)) return value;
  const transformed = { ...value };
  if (cardinality === "many") transformed.where = visibleWhere(targetModel, isRecord(transformed.where) ? transformed.where : {});
  if (isRecord(transformed.select)) transformed.select = transformNested(targetModel, transformed.select);
  if (isRecord(transformed.include)) transformed.include = transformNested(targetModel, transformed.include);
  if (isRecord(transformed._count)) transformed._count = transformCount(targetModel, transformed._count);
  return transformed;
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
  if (!result || !isRecord(result)) return result;
  const policy = VISIBILITY_POLICY[model];
  if (!policy) return result;
  if (policy.softDelete && result.deletedAt !== undefined && result.deletedAt !== null) return null;
  if (policy.projectScope === "root" && result.status !== "ACTIVE") return null;
  if (policy.projectScope !== "root" && result.project && isRecord(result.project) && result.project.status !== "ACTIVE") return null;
  return result;
}
