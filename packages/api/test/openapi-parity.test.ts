import assert from "node:assert/strict";
import { test } from "node:test";
import { generateOpenApiDocument, getPolicyMap } from "@agile/contracts";

test("N6/OpenAPI parity has exactly one generated operation per policy record", () => {
  const policies = getPolicyMap();
  const document = generateOpenApiDocument(policies.map((policy) => ({ operationId: policy.operationId, method: policy.method, path: policy.path, policyKey: policy.policyKey, responseSchema: {} })));
  const operations = Object.values(document.paths).flatMap((path) => Object.values(path as Record<string, { operationId: string }>));
  assert.equal(operations.length, 57);
  assert.equal(new Set(operations.map((operation) => operation.operationId)).size, 57);
});
