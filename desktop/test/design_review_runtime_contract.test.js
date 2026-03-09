import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const mainRs = readFileSync(join(here, "..", "src-tauri", "src", "main.rs"), "utf8");

test("design review provider command runs on a blocking task instead of the immediate tauri command thread", () => {
  assert.match(
    mainRs,
    /async fn run_design_review_provider_request\(\s*request: serde_json::Value,\s*\) -> Result<serde_json::Value, String>/
  );
  assert.match(
    mainRs,
    /tauri::async_runtime::spawn_blocking\(move \|\| run_design_review_provider_request_sync\(request\)\)/
  );
});

test("design review provider sync dispatcher supports the final apply kind", () => {
  assert.match(mainRs, /"apply"\s*=>\s*run_design_review_apply_request\(&request,\s*&vars\)/);
});
