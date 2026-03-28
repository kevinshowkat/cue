import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MAGIC_SELECT_LOCAL_RUNTIME_CONTRACT,
  MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT,
  evictLocalMagicSelectImage,
  prepareLocalMagicSelectImage,
  releaseLocalMagicSelectImage,
  runLocalMagicSelectClick,
  runWarmLocalMagicSelectClick,
} from "../src/magic_select_runtime.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const protocolCommit = "382794399b46b6f59d43196bc4c620511351edc5";
const runtimeCommit = "7c6b834dc2dba9d418f7a23f24f6376fad1b7611";
const preparedContract = "juggernaut.magic_select.local.prepared.v1";

function gitShow(objectPath) {
  return execFileSync("git", ["show", objectPath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

const protocolRuntime = gitShow(`${protocolCommit}:desktop/src/magic_select_runtime.js`);
const workerRuntime = gitShow(`${runtimeCommit}:desktop/src-tauri/src/main.rs`);
const runbook = readFileSync(join(repoRoot, "docs", "runbooks", "LOCAL_MAGIC_SELECT_RUNTIME.md"), "utf8");
const prompts = readFileSync(join(repoRoot, "AGENT_PROMPTS.md"), "utf8");
const benchmarkScript = readFileSync(join(repoRoot, "scripts", "benchmark_magic_select_runtime.py"), "utf8");

test("worker-protocol source of truth exports the prepared runtime contract and exact JS names", () => {
  assert.match(protocolRuntime, new RegExp(`export const MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT = "${preparedContract}";`));
  assert.match(protocolRuntime, /const MAGIC_SELECT_ACTIONS = Object\.freeze\(\{\s*click: "magic_select_click",\s*prepare: "magic_select_prepare",\s*warmClick: "magic_select_warm_click",\s*release: "magic_select_release",\s*\}\);/s);
  assert.match(protocolRuntime, /export async function prepareLocalMagicSelectImage\(/);
  assert.match(protocolRuntime, /export async function runWarmLocalMagicSelectClick\(/);
  assert.match(protocolRuntime, /export async function releaseLocalMagicSelectImage\(/);
  assert.match(protocolRuntime, /export const evictLocalMagicSelectImage = releaseLocalMagicSelectImage;/);
  assert.match(protocolRuntime, /"prepare_local_magic_select_image"/);
  assert.match(protocolRuntime, /"run_local_magic_select_warm_click"/);
  assert.match(protocolRuntime, /"release_local_magic_select_image"/);
});

test("worker-runtime source of truth exposes the exact Tauri commands, actions, and error payload fields", () => {
  assert.match(workerRuntime, new RegExp(`const MAGIC_SELECT_LOCAL_CONTRACT: &str = "${preparedContract}";`));
  assert.match(workerRuntime, /const MAGIC_SELECT_LOCAL_PREPARE_ACTION: &str = "magic_select_prepare";/);
  assert.match(workerRuntime, /const MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION: &str = "magic_select_warm_click";/);
  assert.match(workerRuntime, /const MAGIC_SELECT_LOCAL_RELEASE_ACTION: &str = "magic_select_release";/);
  assert.match(workerRuntime, /fn prepare_local_magic_select_image\(/);
  assert.match(workerRuntime, /fn run_local_magic_select_warm_click\(/);
  assert.match(workerRuntime, /fn release_local_magic_select_image\(/);
  assert.match(workerRuntime, /"code": code,/);
  assert.match(workerRuntime, /"nonDestructive": true,/);
  assert.match(workerRuntime, /"contract": MAGIC_SELECT_LOCAL_CONTRACT,/);
  assert.match(workerRuntime, /"action": action,/);
  assert.match(workerRuntime, /"imageId": image_id\.map\(str::to_string\),/);
  assert.match(workerRuntime, /"preparedImageId": prepared_image_id\.map\(str::to_string\),/);
  assert.match(workerRuntime, /map\.insert\("details"\.to_string\(\), details\);/);
  assert.match(workerRuntime, /map\.insert\("warnings"\.to_string\(\), serde_json::json!\(warnings\)\);/);
});

test("worker-runtime source of truth returns the documented prepare, warm-click, and release success fields", () => {
  assert.match(workerRuntime, /"ok": true,\s*"contract": MAGIC_SELECT_LOCAL_CONTRACT,\s*"action": MAGIC_SELECT_LOCAL_PREPARE_ACTION,\s*"imageId": image_id,\s*"preparedImageId": prepared_image_id,\s*"preparedImage": prepared_image,\s*"receipt": \{/s);
  assert.match(workerRuntime, /"ok": true,\s*"contract": MAGIC_SELECT_LOCAL_CONTRACT,\s*"action": MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,\s*"imageId": image_id,\s*"candidate": candidate,\s*"group": group,\s*"receipt": \{/s);
  assert.match(workerRuntime, /"warnings": warnings,\s*"preparedImageId": prepared_image_id,\s*"preparedImage": prepared_image,/s);
  assert.match(workerRuntime, /"ok": true,\s*"contract": MAGIC_SELECT_LOCAL_CONTRACT,\s*"action": MAGIC_SELECT_LOCAL_RELEASE_ACTION,\s*"imageId": image_id,\s*"preparedImageId": prepared_image_id,\s*"warnings": warnings,/s);
});

test("local docs and benchmark support files describe the committed prepared runtime names", () => {
  assert.match(runbook, new RegExp(`Contract: \`${preparedContract.replace(/\./g, "\\.")}\``));
  assert.match(runbook, /prepareLocalMagicSelectImage/);
  assert.match(runbook, /runWarmLocalMagicSelectClick/);
  assert.match(runbook, /releaseLocalMagicSelectImage/);
  assert.match(runbook, /evictLocalMagicSelectImage/);
  assert.match(runbook, /prepare_local_magic_select_image/);
  assert.match(runbook, /run_local_magic_select_warm_click/);
  assert.match(runbook, /release_local_magic_select_image/);
  assert.match(runbook, /magic_select_prepare/);
  assert.match(runbook, /magic_select_warm_click/);
  assert.match(runbook, /magic_select_release/);
  assert.match(runbook, /`preparedImageId`/);
  assert.match(runbook, /`preparedImage`/);
  assert.match(runbook, /`details` when present/);
  assert.match(prompts, new RegExp(preparedContract.replace(/\./g, "\\.")));
  assert.match(prompts, /prepareLocalMagicSelectImage/);
  assert.match(prompts, /runWarmLocalMagicSelectClick/);
  assert.match(prompts, /releaseLocalMagicSelectImage/);
  assert.match(prompts, /evictLocalMagicSelectImage/);
  assert.match(benchmarkScript, new RegExp(`"${preparedContract.replace(/\./g, "\\.")}"`));
  assert.match(benchmarkScript, /"magic_select_warm_click"/);
});

test("prepareLocalMagicSelectImage normalizes the prepared-image contract into a reusable handle", async () => {
  const calls = [];
  const result = await prepareLocalMagicSelectImage({
    imageId: "img-7",
    imagePath: "/tmp/source.png",
    runDir: "/tmp/run-7",
    stableSourceRef: "receipt-local-7",
    source: "communication_magic_select",
    settings: {
      maskThreshold: 280,
      maxContourPoints: 8,
    },
    invokeFn: async (command, payload) => {
      calls.push({ command, payload });
      return {
        ok: true,
        contract: MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT,
        action: "magic_select_prepare",
        preparedImageId: "prepared-img-7",
        preparedImage: {
          imageId: "img-7",
          imagePath: "/tmp/source.png",
          runDir: "/tmp/run-7",
          stableSourceRef: "receipt-local-7",
          source: "communication_magic_select",
          preparedAt: 1712345678901,
          expiresAt: 1712345680000,
          useCount: 2,
          reproducibility: {
            modelId: "mobile_sam_vit_t",
            modelRevision: "sha256:1234567890ab",
            imageHash: "imgsha",
          },
        },
        warnings: ["cache primed"],
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "prepare_local_magic_select_image");
  assert.deepEqual(calls[0].payload.request, {
    imageId: "img-7",
    imagePath: "/tmp/source.png",
    runDir: "/tmp/run-7",
    stableSourceRef: "receipt-local-7",
    source: "communication_magic_select",
    settings: {
      maskThreshold: 255,
      maxContourPoints: 16,
    },
  });

  assert.equal(result.contract, MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT);
  assert.equal(result.action, "magic_select_prepare");
  assert.equal(result.preparedImageId, "prepared-img-7");
  assert.deepEqual(result.preparedImage.settings, {
    maskThreshold: 255,
    maxContourPoints: 16,
  });
  assert.equal(result.preparedImage.imagePath, "/tmp/source.png");
  assert.equal(result.preparedImage.preparedAt, 1712345678901);
  assert.equal(result.preparedImage.expiresAt, 1712345680000);
  assert.equal(result.preparedImage.useCount, 2);
  assert.equal(result.preparedImage.reproducibility.modelId, "mobile_sam_vit_t");
  assert.deepEqual(result.warnings, ["cache primed"]);
});

test("runWarmLocalMagicSelectClick hits a prepared image contract and preserves the handle metadata", async () => {
  const calls = [];
  const preparedImage = {
    id: "prepared-img-7",
    imageId: "img-7",
    imagePath: "/tmp/source.png",
    runDir: "/tmp/run-7",
    stableSourceRef: "receipt-local-7",
    source: "communication_magic_select",
    settings: {
      maskThreshold: 180,
      maxContourPoints: 64,
    },
    preparedAt: 1712345678901,
  };
  const result = await runWarmLocalMagicSelectClick({
    preparedImage,
    clickAnchor: { x: 18.6, y: 29.2 },
    invokeFn: async (command, payload) => {
      calls.push({ command, payload });
      return {
        ok: true,
        contract: MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT,
        action: "magic_select_warm_click",
        preparedImage: {
          id: "prepared-img-7",
          lastUsedAt: 1712345679900,
          useCount: 3,
          expiresAt: 1712345680500,
        },
        group: {
          imageId: "img-7",
          anchor: { x: 19, y: 29 },
          candidates: [
            {
              id: "magic-select-a1b2c3",
              bounds: { x: 12, y: 18, w: 40, h: 50 },
              contourPoints: [
                { x: 12, y: 18 },
                { x: 52, y: 18 },
                { x: 52, y: 68 },
                { x: 12, y: 68 },
              ],
              maskRef: {
                path: "/tmp/run-7/artifact-mask.png",
                sha256: "abc123",
                width: 90,
                height: 120,
                format: "png",
              },
              confidence: 0.91,
              source: "local_model:mobile_sam_vit_t",
            },
          ],
          chosenCandidateId: "magic-select-a1b2c3",
          updatedAt: 1712345679901,
        },
        receipt: {
          path: "/tmp/run-7/receipt-magic-select-warm.json",
          reproducibility: {
            modelId: "mobile_sam_vit_t",
            modelRevision: "sha256:1234567890ab",
            imageHash: "imgsha",
          },
        },
        warnings: ["cache_hit"],
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "run_local_magic_select_warm_click");
  assert.deepEqual(calls[0].payload.request, {
    preparedImageId: "prepared-img-7",
    imageId: "img-7",
    clickAnchor: { x: 19, y: 29 },
    source: "communication_magic_select",
  });

  assert.equal(result.contract, MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT);
  assert.equal(result.action, "magic_select_warm_click");
  assert.equal(result.preparedImageId, "prepared-img-7");
  assert.equal(result.preparedImage.imagePath, "/tmp/source.png");
  assert.equal(result.preparedImage.lastUsedAt, 1712345679900);
  assert.equal(result.preparedImage.expiresAt, 1712345680500);
  assert.equal(result.preparedImage.useCount, 3);
  assert.deepEqual(result.preparedImage.settings, {
    maskThreshold: 180,
    maxContourPoints: 64,
  });
  assert.equal(result.candidate.id, "magic-select-a1b2c3");
  assert.deepEqual(result.group.anchor, { x: 19, y: 29 });
  assert.equal(result.group.reproducibility.modelId, "mobile_sam_vit_t");
  assert.equal(result.receipt.path, "/tmp/run-7/receipt-magic-select-warm.json");
  assert.deepEqual(result.warnings, ["cache_hit"]);
});

test("runWarmLocalMagicSelectClick exposes stable non-destructive prepared-image failures", async () => {
  await assert.rejects(
    () =>
      runWarmLocalMagicSelectClick({
        preparedImageId: "prepared-404",
        imageId: "img-9",
        clickAnchor: { x: 4, y: 8 },
        invokeFn: async () => ({
          ok: false,
          contract: MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT,
          action: "magic_select_warm_click",
          code: "magic_select_prepared_image_missing",
          message: "Prepared image was evicted before the warm click.",
          preparedImageId: "prepared-404",
          warnings: ["evicted"],
          details: {
            evicted: true,
          },
        }),
      }),
    (error) => {
      assert.equal(error.code, "magic_select_prepared_image_missing");
      assert.equal(error.nonDestructive, true);
      assert.equal(error.contract, MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT);
      assert.equal(error.action, "magic_select_warm_click");
      assert.equal(error.imageId, "img-9");
      assert.equal(error.preparedImageId, "prepared-404");
      assert.deepEqual(error.warnings, ["evicted"]);
      assert.deepEqual(error.details, {
        evicted: true,
      });
      assert.match(error.message, /evicted/);
      return true;
    }
  );
});

test("releaseLocalMagicSelectImage acknowledges released and evicted prepared images", async () => {
  const calls = [];
  const result = await releaseLocalMagicSelectImage({
    preparedImage: {
      id: "prepared-img-7",
      imageId: "img-7",
    },
    reason: "canvas_closed",
    invokeFn: async (command, payload) => {
      calls.push({ command, payload });
      return {
        ok: true,
        contract: MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT,
        action: "magic_select_release",
        preparedImageId: "prepared-img-7",
        imageId: "img-7",
        released: true,
        evicted: true,
        warnings: ["cache_entry_removed"],
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "release_local_magic_select_image");
  assert.deepEqual(calls[0].payload.request, {
    preparedImageId: "prepared-img-7",
    imageId: "img-7",
    reason: "canvas_closed",
  });

  assert.equal(result.contract, MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT);
  assert.equal(result.action, "magic_select_release");
  assert.equal(result.preparedImageId, "prepared-img-7");
  assert.equal(result.released, true);
  assert.equal(result.evicted, true);
  assert.deepEqual(result.warnings, ["cache_entry_removed"]);
});

test("evictLocalMagicSelectImage aliases the release contract", () => {
  assert.equal(evictLocalMagicSelectImage, releaseLocalMagicSelectImage);
});
