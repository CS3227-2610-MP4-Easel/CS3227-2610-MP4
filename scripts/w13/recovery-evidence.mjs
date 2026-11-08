const FIELDS = ["target", "backupReference", "migrationChecksum", "restoreStartedAt", "restoreEndedAt", "rpoHours", "rtoHours", "seedResult", "owner", "outcome"];

export function validateRecoveryEvidence(evidence) {
  const unknown = Object.keys(evidence).filter((key) => !FIELDS.includes(key));
  if (unknown.length) throw new Error(`Unknown recovery evidence field ${unknown[0]}`);
  for (const field of FIELDS) if (evidence[field] === undefined || evidence[field] === null || evidence[field] === "") throw new Error(`Missing recovery evidence field ${field}`);
  if (evidence.target !== "restricted-rehearsal") throw new Error("Recovery target is not approved");
  if (!/^[0-9a-f]{64}$/.test(evidence.migrationChecksum)) throw new Error("Invalid migration checksum");
  const start = Date.parse(evidence.restoreStartedAt);
  const end = Date.parse(evidence.restoreEndedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error("Invalid restore timestamps");
  if (typeof evidence.rpoHours !== "number" || evidence.rpoHours > 24 || evidence.rpoHours < 0) throw new Error("RPO exceeds 24 hours");
  if (typeof evidence.rtoHours !== "number" || evidence.rtoHours > 4 || evidence.rtoHours < 0) throw new Error("RTO exceeds 4 hours");
  if (evidence.seedResult !== "pass") throw new Error("Seed result must pass");
  if (evidence.outcome !== "pass") throw new Error("Recovery outcome must pass");
  return true;
}
