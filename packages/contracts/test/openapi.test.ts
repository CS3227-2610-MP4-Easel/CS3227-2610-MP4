import assert from "node:assert/strict";
import { test } from "node:test";
import { generateOpenApiDocument } from "../src/openapi.js";

test("OpenAPI generator merges multiple methods under one path", () => {
  const document = generateOpenApiDocument([
    { operationId: "read", method: "GET", path: "/api/items", policyKey: "endpoint-1", responseSchema: {} },
    { operationId: "write", method: "POST", path: "/api/items", policyKey: "endpoint-2", responseSchema: {} },
  ]);
  assert.equal(Object.keys(document.paths["/api/items"]).length, 2);
  assert.equal(document.paths["/api/items"].get.operationId, "read");
  assert.equal(document.paths["/api/items"].post.operationId, "write");
});
