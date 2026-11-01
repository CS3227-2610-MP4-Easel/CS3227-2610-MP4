import assert from "node:assert/strict";
import { test } from "node:test";
import { generateOpenApiDocument } from "../src/openapi.js";

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
