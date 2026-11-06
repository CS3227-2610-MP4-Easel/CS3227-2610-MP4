// F10: phase of each assistant message. A skill invocation sets the phase until the next one; inside a subagent
// its type's mapping wins; a nested subagent inherits the phase of the message that launched it; else `other`.
//
// message: {message_id, agent_id, parent_agent_id, agent_type, launched_by, skills: [skill names called in it],
//           tool_use_ids: [ids of tool calls in it]}; messages of one agent are in transcript order.

const OTHER = 'other';

export function assignPhases(messages, phaseMap = {}) {
  const phaseOf = new Map(); // message_id -> phase
  const owner = new Map(); // tool_use_id -> message
  for (const m of messages) for (const id of m.tool_use_ids ?? []) owner.set(id, m);

  const byAgent = new Map();
  for (const m of messages) {
    if (!byAgent.has(m.agent_id)) byAgent.set(m.agent_id, []);
    byAgent.get(m.agent_id).push(m);
  }

  const done = new Set();
  const process = (agentId) => {
    if (done.has(agentId)) return;
    const list = byAgent.get(agentId);
    const first = list[0];
    const isMain = first.parent_agent_id == null;
    let inherited = OTHER;
    if (!isMain) {
      const launcher = owner.get(first.launched_by);
      if (launcher) {
        process(launcher.agent_id);
        inherited = phaseOf.get(launcher.message_id) ?? OTHER;
      }
    }
    const fixed = !isMain && first.agent_type != null && phaseMap[first.agent_type] !== undefined ? phaseMap[first.agent_type] : null;
    let current = fixed ?? inherited;
    for (const m of list) {
      phaseOf.set(m.message_id, current);
      if (fixed === null && m.skills?.length) {
        const last = m.skills[m.skills.length - 1];
        current = phaseMap[last] ?? OTHER; // takes effect from the next message
      }
    }
    done.add(agentId);
  };
  for (const agentId of byAgent.keys()) process(agentId);
  return phaseOf;
}
