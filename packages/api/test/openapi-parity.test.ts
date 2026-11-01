import assert from "node:assert/strict";
import { test } from "node:test";
import { generateOpenApiDocument, getPolicyMap } from "@agile/contracts";

test("N6/OpenAPI parity has exactly one generated operation per policy record", () => {
  const policies = getPolicyMap();
  const document = generateOpenApiDocument(policies);
  const operations = Object.values(document.paths).flatMap((path) => Object.values(path as Record<string, { operationId: string; [key: string]: any }>));
  assert.equal(operations.length, 57);
  assert.equal(new Set(operations.map((operation) => operation.operationId)).size, 57);
  const policyByOperation = new Map(policies.map((policy) => [policy.operationId, policy]));
  for (const operation of operations) {
    const policy = policyByOperation.get(operation.operationId);
    assert.match(operation.operationId, /^[A-Z][A-Z0-9_]+$/);
    assert.equal(operation["x-policy-key"], policy?.policyKey);
    const response = operation.responses[String(policy?.successStatus ?? 200)];
    assert.ok(response);
    if (policy?.successStatus !== 204) assert.ok(response.content["application/json"].schema.$ref);
    if (policy?.requestSchema) assert.ok(operation.requestBody.content["application/json"].schema.$ref);
  }
});
