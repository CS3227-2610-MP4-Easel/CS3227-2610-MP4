// Shared by report.mjs and implreport.mjs: a report failure with the exit code the command returns.
export class ReportError extends Error {
  constructor(message, exit) { super(message); this.exit = exit; }
}
