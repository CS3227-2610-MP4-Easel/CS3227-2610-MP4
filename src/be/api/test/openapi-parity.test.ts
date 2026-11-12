import assert from "node:assert/strict";
import { test } from "node:test";
import { generateOpenApiDocument, getPolicyMap } from "@agile/contracts";

test("N6/OpenAPI parity has exactly one generated operation per policy record", () => {
  const policies = getPolicyMap();
  const document = generateOpenApiDocument(policies);
  const operations = Object.values(document.paths).flatMap((path) => Object.values(path as Record<string, { operationId: string; [key: string]: any }>));
  assert.equal(operations.length, 61);
  assert.equal(new Set(operations.map((operation) => operation.operationId)).size, 61);
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
  const components = document.components.schemas as Record<string, unknown>;
  for (const operation of operations) {
    const policy = policyByOperation.get(operation.operationId);
    const responseRef = (operation.responses[String(policy?.successStatus ?? 200)] as any).content?.["application/json"]?.schema?.$ref as string | undefined;
    if (responseRef) assert.ok(components[responseRef.split("/").pop()!]);
    const requestRef = (operation.requestBody as any)?.content?.["application/json"]?.schema?.$ref as string | undefined;
    if (requestRef) assert.ok(components[requestRef.split("/").pop()!]);
  }
  assert.deepEqual((components.AUTH_REGISTERRequest as any).required.sort(), ["code", "displayName", "role"]);
  assert.equal((components.AUTH_REGISTERRequest as any).additionalProperties, false);
  assert.deepEqual((components.TASK_CREATERequest as any).required, ["epicId", "title"]);
  assert.equal((components.TASK_CREATERequest as any).additionalProperties, false);
  assert.deepEqual((components.TASK_STATUS_UPDATERequest as any).properties.status.enum, ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]);
  assert.equal((components.TASK_CREATEResponse as any).properties.version.exclusiveMinimum, 0);
  assert.equal((components.DEV_UPLOAD_CREATERequest as any).properties.items.maxItems, 100);
  assert.equal((components.SPRINT_CREATERequest as any).properties.startDate.format, "date");
  assert.notEqual((components.TASK_CREATEResponse as any).additionalProperties, true);
  for (const name of ["EPIC_LIST", "TASK_LIST", "TASK_EVENT_LIST", "PM_PROPOSAL_LIST", "LEAD_PROPOSAL_LIST", "USAGE_SESSION_LIST"]) {
    const response = components[`${name}Response`] as any;
    assert.deepEqual(response.required, ["items", "page", "size", "total"]);
    assert.equal(response.properties.items.type, "array");
  }
  assert.equal((components.PROJECT_MEMBER_LISTResponse as any).type, "array");
});
