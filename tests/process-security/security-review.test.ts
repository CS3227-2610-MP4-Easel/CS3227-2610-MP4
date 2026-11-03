import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BOOTSTRAP_BASE_SHA,
  BOOTSTRAP_PATHS,
  BOOTSTRAP_TARGET_BRANCH,
  SECURITY_REVIEWER,
  getRequiredHumanApprover,
  isSensitivePath,
  parseSensitiveManifestText,
  resolveBaseSensitivePatterns,
  validateSecurityReview,
} from "../../scripts/check-security-review.mjs";

const headSha = "a".repeat(40);
const sensitivePaths = [".github/workflows/ci.yml"];

function artifact(overrides = {}) {
  return {
    prHead: headSha,
    reviewer: SECURITY_REVIEWER,
    lens: "Attacker",
    targetPaths: sensitivePaths,
    findings: [],
    decision: "pass",
    humanApproval: { login: "@xiao-congchen", approved: true },
    ...overrides,
  };
}

function review(login: string, overrides = {}) {
  return {
    user: { login },
    state: "APPROVED",
    commit_id: headSha,
    submitted_at: "2026-11-04T00:00:00Z",
    id: 1,
    ...overrides,
  };
}

function approvals(prAuthor = "teleifo", overrides = []) {
  return [
    review("ludannnn"),
    review(getRequiredHumanApprover(prAuthor), { id: 2 }),
    ...overrides,
  ];
}

test("F10 canonical manifest classification covers all control surfaces", () => {
  assert.equal(isSensitivePath(".github/workflows/ci.yml"), true);
  assert.equal(isSensitivePath("package.json"), true);
  assert.equal(isSensitivePath("src/be/contracts/src/index.ts"), true);
  assert.equal(isSensitivePath("tests/security/attack-corpus/prompt.txt"), true);
  assert.equal(isSensitivePath("README.md"), false);
});

test("F14/E21 bootstrap uses the exact fixed rollout identity and list", () => {
  assert.equal(BOOTSTRAP_TARGET_BRANCH, "development");
  assert.equal(BOOTSTRAP_BASE_SHA, "7bd65440023a0123ac92445e5b6e58ec838ee57c");
  assert.deepEqual(resolveBaseSensitivePatterns({
    baseManifest: null,
    baseBranch: BOOTSTRAP_TARGET_BRANCH,
    baseSha: BOOTSTRAP_BASE_SHA,
    prNumber: "42",
    bootstrapPrNumber: "42",
  }), BOOTSTRAP_PATHS);
});

test("F14/E22/E24 bootstrap rejects wrong identity, unknown keys, and duplicate keys", () => {
  assert.throws(() => resolveBaseSensitivePatterns({
    baseManifest: null,
    baseBranch: "main",
    baseSha: BOOTSTRAP_BASE_SHA,
    prNumber: "42",
    bootstrapPrNumber: "42",
  }), /bootstrap requires the development target/);
  assert.throws(() => resolveBaseSensitivePatterns({
    baseManifest: null,
    baseBranch: BOOTSTRAP_TARGET_BRANCH,
    baseSha: BOOTSTRAP_BASE_SHA,
    prNumber: "41",
    bootstrapPrNumber: "42",
  }), /bootstrap requires the configured pull request/);
  assert.throws(() => parseSensitiveManifestText('{"version":1,"paths":[],"extra":true}'), /exactly version and paths/);
  assert.throws(() => parseSensitiveManifestText('{"version":1,"version":1,"paths":[]}'), /duplicate JSON object key/);
});

test("F14/E23/E25 post-rollout missing or malformed manifests fail closed", () => {
  assert.throws(() => resolveBaseSensitivePatterns({
    baseManifest: null,
    baseBranch: BOOTSTRAP_TARGET_BRANCH,
    baseSha: "c".repeat(40),
    prNumber: "42",
    bootstrapPrNumber: "42",
  }), /base sensitive-path manifest is required after bootstrap/);
  assert.throws(() => parseSensitiveManifestText('{"version":1,"paths":["workflow/**","workflow/**"]}'), /paths must be unique/);
});

test("F13/E8 missing and stale review artifacts fail closed", () => {
  assert.deepEqual(validateSecurityReview({
    artifact: null,
    headSha,
    prAuthor: "contributor",
    changedPaths: sensitivePaths,
    reviews: approvals("contributor"),
  }), ["security-review artifact is required for sensitive changes"]);
  assert.deepEqual(validateSecurityReview({
    artifact: artifact({ prHead: "b".repeat(40) }),
    headSha,
    prAuthor: "contributor",
    changedPaths: sensitivePaths,
    reviews: approvals("contributor"),
  }), ["security-review artifact does not match the PR head"]);
});

test("E16/E18 author-dependent pairing and self-review fail closed", () => {
  assert.equal(getRequiredHumanApprover("@teleifo"), "@xiao-congchen");
  assert.equal(getRequiredHumanApprover("contributor"), "@teleifo");
  assert.match(validateSecurityReview({
    artifact: artifact(),
    headSha,
    prAuthor: "@ludannnn",
    changedPaths: sensitivePaths,
    reviews: approvals("@ludannnn"),
  }).join("\n"), /security reviewer cannot be the pull request author/);
  assert.match(validateSecurityReview({
    artifact: artifact(),
    headSha,
    prAuthor: "@teleifo",
    changedPaths: sensitivePaths,
    reviews: [review("ludannnn"), review("teleifo", { id: 2 })],
  }).join("\n"), /GitHub review from @xiao-congchen is required/);
});

test("F13/E17 a forged artifact without current GitHub reviews fails", () => {
  const errors = validateSecurityReview({
    artifact: artifact(),
    headSha,
    prAuthor: "contributor",
    changedPaths: sensitivePaths,
    reviews: [],
  });
  assert.equal(errors.length, 2);
  assert.ok(errors.every((error) => /GitHub review/.test(error)));
});

test("F13/E19 latest review state must be an exact-head approval", () => {
  const base = approvals("teleifo");
  assert.deepEqual(validateSecurityReview({
    artifact: artifact(),
    headSha,
    prAuthor: "teleifo",
    changedPaths: sensitivePaths,
    reviews: base.map((item) => item.user.login === "ludannnn" ? { ...item, commit_id: "b".repeat(40) } : item),
  }).filter((error) => /GitHub review/.test(error)), ["GitHub review from @ludannnn must approve the exact PR head"]);

  const superseded = [
    ...base,
    review("ludannnn", { id: 3, submitted_at: "2026-11-04T01:00:00Z", state: "CHANGES_REQUESTED" }),
  ];
  assert.deepEqual(validateSecurityReview({
    artifact: artifact(),
    headSha,
    prAuthor: "teleifo",
    changedPaths: sensitivePaths,
    reviews: superseded,
  }).filter((error) => /GitHub review/.test(error)), ["GitHub review from @ludannnn must be the latest exact-head approval"]);
});

test("E20 paginated review responses are flattened and tied by timestamp then id", () => {
  const reviews = [
    [review("ludannnn", { id: 10, submitted_at: "2026-11-04T01:00:00Z" })],
    [review("Xiao-Congchen", { id: 11, submitted_at: "2026-11-04T01:00:00Z" })],
  ];
  assert.deepEqual(validateSecurityReview({
    artifact: artifact(),
    headSha,
    prAuthor: "teleifo",
    changedPaths: sensitivePaths,
    reviews,
  }), []);
});

test("F13 non-sensitive changes do not require security evidence", () => {
  assert.deepEqual(validateSecurityReview({
    artifact: null,
    headSha,
    prAuthor: "contributor",
    changedPaths: ["README.md"],
    reviews: null,
  }), []);
});
