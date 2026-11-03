import assert from "node:assert/strict";
import { test } from "node:test";
import { validateSecurityReview } from "../../scripts/check-security-review.mjs";

const headSha = "a".repeat(40);
const sensitivePaths = [".github/workflows/ci.yml"];

function artifact(overrides = {}) {
  return {
    prHead: headSha,
    reviewer: "@ludannnn",
    lens: "Attacker",
    targetPaths: sensitivePaths,
    findings: [],
    decision: "pass",
    humanApproval: { login: "@teleifo", approved: true },
    ...overrides,
  };
}

test("F13/E8 missing and stale review artifacts fail closed", () => {
  assert.deepEqual(validateSecurityReview({ artifact: null, headSha, prAuthor: "contributor", changedPaths: sensitivePaths }), [
    "security-review artifact is required for sensitive changes",
  ]);
  assert.deepEqual(validateSecurityReview({
    artifact: artifact({ prHead: "b".repeat(40) }),
    headSha,
    prAuthor: "contributor",
    changedPaths: sensitivePaths,
  }), ["security-review artifact does not match the PR head"]);
});

test("F13/E10 self-authored or non-independent reviews fail closed", () => {
  assert.deepEqual(validateSecurityReview({
    artifact: artifact({ reviewer: "contributor" }),
    headSha,
    prAuthor: "contributor",
    changedPaths: sensitivePaths,
  }), ["security-reviewer cannot be the pull request author"]);
  assert.deepEqual(validateSecurityReview({
    artifact: artifact({ humanApproval: { login: "@ludannnn", approved: true } }),
    headSha,
    prAuthor: "contributor",
    changedPaths: sensitivePaths,
  }), ["human approval must be independent of the security reviewer"]);
});

test("F13/E8 a current independent pass is accepted for sensitive changes", () => {
  assert.deepEqual(validateSecurityReview({
    artifact: artifact(),
    headSha,
    prAuthor: "contributor",
    changedPaths: sensitivePaths,
  }), []);
});

test("F13 non-sensitive changes do not require a security-review artifact", () => {
  assert.deepEqual(validateSecurityReview({
    artifact: null,
    headSha,
    prAuthor: "contributor",
    changedPaths: ["README.md"],
  }), []);
});
