import assert from "node:assert/strict";
import { test } from "node:test";
import { generateOpenApiDocument } from "../src/openapi.js";
import { createOpenApiSchemaRegistry, OPENAPI_SCHEMA_REGISTRY } from "../src/openapi-schemas.js";
import { getPolicyMap } from "../src/policy.js";

test("every templated path declares its required parameters", () => {
  const document = generateOpenApiDocument(getPolicyMap());
  for (const [path, operations] of Object.entries(document.paths)) {
    const names = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
    for (const operation of Object.values(operations) as any[]) {
      assert.deepEqual((operation.parameters ?? []).map((parameter: any) => parameter.name), names);
      for (const parameter of operation.parameters ?? []) assert.equal(parameter.required, true);
    }
  }
  assert.deepEqual((document.paths["/api/pm/proposals/{proposalId}/epics/{index}"].patch as any).parameters[1].schema, { type: "integer", minimum: 0 });
});

test("OpenAPI generator merges multiple methods under one path", () => {
  const document = generateOpenApiDocument([
    { operationId: "ITEM_READ", method: "GET", path: "/api/items", policyKey: "endpoint-1", requestSchema: { type: "none" }, responseSchema: { type: "object" } },
    { operationId: "ITEM_WRITE", method: "POST", path: "/api/items", policyKey: "endpoint-2", requestSchema: { type: "object" }, responseSchema: { type: "object" } },
  ]);
  assert.equal(Object.keys(document.paths["/api/items"]).length, 2);
  assert.equal(document.paths["/api/items"].get.operationId, "ITEM_READ");
  assert.equal(document.paths["/api/items"].post.operationId, "ITEM_WRITE");
  assert.deepEqual(document.paths["/api/items"].post.requestBody.content["application/json"].schema, { type: "object" });
  assert.deepEqual(document.paths["/api/items"].post.responses["200"].content["application/json"].schema, { type: "object" });
});

test("OpenAPI generation rejects placeholder schemas and emits status-specific responses", () => {
  assert.throws(() => generateOpenApiDocument([{ operationId: "EMPTY", method: "GET", path: "/api/empty", policyKey: "endpoint-1", responseSchema: {} }]), /response schema is required/);
  const document = generateOpenApiDocument([{ operationId: "ITEM_CREATE", method: "POST", path: "/api/items", policyKey: "endpoint-1", requestSchema: { type: "object" }, responseSchema: { type: "object" }, successStatus: 201 }]);
  assert.ok(document.paths["/api/items"].post.responses["201"]);
});

test("F4/E9 every policy reference resolves through the component registry", () => {
  const document = generateOpenApiDocument([
    { operationId: "PROJECT_LIST", method: "GET", path: "/api/projects", policyKey: "endpoint-6", responseSchema: { $ref: "#/components/schemas/PROJECT_LISTResponse" } },
  ]);
  assert.deepEqual(document.paths["/api/projects"].get.responses["200"].content["application/json"].schema, { $ref: "#/components/schemas/PROJECT_LISTResponse" });
  assert.deepEqual(document.components.schemas.PROJECT_LISTResponse, OPENAPI_SCHEMA_REGISTRY.PROJECT_LISTResponse);
});

test("F4/E21 unresolved references and conflicting registrations fail atomically", () => {
  assert.throws(() => generateOpenApiDocument([{ operationId: "MISSING", method: "GET", path: "/api/missing", policyKey: "endpoint-1", responseSchema: { $ref: "#/components/schemas/MISSINGResponse" } }], {}), /OPENAPI_UNRESOLVED_REF/);
  assert.throws(() => createOpenApiSchemaRegistry([["DUP", { type: "string" }], ["DUP", { type: "number" }]]), /OPENAPI_SCHEMA_CONFLICT/);
});

test("F4/E22 identical schema registrations are idempotent", () => {
  const registry = createOpenApiSchemaRegistry([["SAME", { type: "string" }], ["SAME", { type: "string" }]]);
  assert.deepEqual(registry.SAME, { type: "string" });
});

test("W14 endpoint 27/46 pages and mutation bounds are represented in OpenAPI", () => {
  const sprintPage = OPENAPI_SCHEMA_REGISTRY.SPRINT_LISTResponse as any;
  const proposalPage = OPENAPI_SCHEMA_REGISTRY.LEAD_PROPOSAL_LISTResponse as any;
  assert.equal(sprintPage.type, "object");
  assert.equal(sprintPage.properties.page.maximum, 10000);
  assert.equal(sprintPage.properties.size.maximum, 100);
  assert.equal(proposalPage.type, "object");
  assert.equal(proposalPage.properties.items.items.properties.kind.enum[0], "REPLAN");
  assert.equal((OPENAPI_SCHEMA_REGISTRY.LEAD_PROPOSAL_APPROVERequest as any).properties.suggestionIds.maxItems, 100);
  assert.equal((OPENAPI_SCHEMA_REGISTRY.SPRINT_CLOSERequest as any).properties.carryOver.maxItems, 1000);
});
