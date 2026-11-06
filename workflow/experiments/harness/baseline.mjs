// Built-in sets of Claude Code, measured by the T2 spike (isolation.md). They are constants per CLI
// version: `--setting-sources project` does not remove them, so every expected set includes them.
export const BASELINE_VERSION = '2.1.316';

export const BUILTIN_SKILLS = [
  'design', 'slides', 'design-sync', 'dataviz', 'artifact-diagramming', 'artifact-capabilities', 'update-config',
  'verify', 'debug', 'code-review', 'simplify', 'batch', 'fewer-permission-prompts', 'doctor', 'loop', 'schedule',
  'claude-api', 'run', 'run-skill-generator', 'plugin-authoring',
];

export const BUILTIN_AGENTS = ['claude', 'claude-code-guide', 'Explore', 'general-purpose', 'Plan', 'statusline-setup', 'web-fetch'];

export const BUILTIN_PLUGINS = ['cc-plugin-agents-md', 'cc-plugin-telemetry', 'cc-plugin-plugin-authoring'];

export const BASELINE_TOOLS = [
  'Task', 'Artifact', 'ArtifactComments', 'ArtifactData', 'Bash', 'CronCreate', 'CronDelete', 'CronList', 'DesignSync',
  'Edit', 'EnterWorktree', 'ExitWorktree', 'Glob', 'Grep', 'ListAgents', 'Monitor', 'NotebookEdit', 'PowerShell',
  'PushNotification', 'Read', 'RemoteTrigger', 'ReportFindings', 'ScheduleWakeup', 'SendMessage', 'Skill', 'TaskStop',
  'ToolSearch', 'WebFetch', 'WebSearch', 'Write',
];
