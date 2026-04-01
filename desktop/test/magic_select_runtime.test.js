import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildMagicSelectRunPaths,
  MAGIC_SELECT_LEGACY_LOCAL_RUNTIME_CONTRACT,
  MAGIC_SELECT_LOCAL_PACK_ID,
  MAGIC_SELECT_LOCAL_PRIMARY_MODEL_ID,
  MAGIC_SELECT_LOCAL_RUNTIME_CONTRACT,
  MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT,
  MAGIC_SELECT_RUN_LAYOUT,
  evictLocalMagicSelectImage,
  normalizeMagicSelectRuntimeResolution,
  prepareLocalMagicSelectImage,
  releaseLocalMagicSelectImage,
  runLocalMagicSelectClick,
  runWarmLocalMagicSelectClick,
} from "../src/magic_select_runtime.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const preparedContract = "juggernaut.magic_select.local.prepared.v1";
const protocolRuntime = readFileSync(
  join(repoRoot, "desktop", "src", "magic_select_runtime.js"),
  "utf8"
);
const workerRuntime = readFileSync(
  join(repoRoot, "desktop", "src-tauri", "src", "main.rs"),
  "utf8"
);
const runtimeDoc = readFileSync(join(repoRoot, "docs", "local-magic-select-runtime.md"), "utf8");
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

test("magic select runtime exports the canonical prepared contract and runtime resolution metadata", () => {
  assert.equal(MAGIC_SELECT_LEGACY_LOCAL_RUNTIME_CONTRACT, "juggernaut.magic_select.local.v1");
  assert.equal(MAGIC_SELECT_LOCAL_RUNTIME_CONTRACT, MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT);
  assert.equal(MAGIC_SELECT_LOCAL_PACK_ID, "cue.magic-select");
  assert.equal(MAGIC_SELECT_LOCAL_PRIMARY_MODEL_ID, "mobile_sam_vit_t");
  assert.equal(MAGIC_SELECT_RUN_LAYOUT.sessionDocument, "session.json");
  assert.equal(MAGIC_SELECT_RUN_LAYOUT.eventsLog, "events.jsonl");
});

test("worker-runtime source of truth exposes the exact Tauri commands, actions, and error payload fields", () => {
  assert.match(workerRuntime, new RegExp(`const MAGIC_SELECT_LOCAL_CONTRACT: &str = "${preparedContract}";`));
  assert.match(workerRuntime, /const DESKTOP_MODEL_PACK_INSTALL_CONTRACT: &str = "cue\.desktop\.model-pack\.install\.v1";/);
  assert.match(workerRuntime, /const DESKTOP_MODEL_PACK_UPDATE_CONTRACT: &str = "cue\.desktop\.model-pack\.update\.v1";/);
  assert.match(workerRuntime, /const DESKTOP_MODEL_PACK_UPDATE_EVENT: &str = "cue-desktop-model-pack-update";/);
  assert.match(workerRuntime, /const DESKTOP_MODEL_PACK_ACTION_STATUS: &str = "pack\.status";/);
  assert.match(workerRuntime, /const MAGIC_SELECT_LOCAL_PREPARE_ACTION: &str = "magic_select_prepare";/);
  assert.match(workerRuntime, /const MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION: &str = "magic_select_warm_click";/);
  assert.match(workerRuntime, /const MAGIC_SELECT_LOCAL_RELEASE_ACTION: &str = "magic_select_release";/);
  assert.match(workerRuntime, /fn desktop_model_pack_status\(/);
  assert.match(workerRuntime, /emit_all\(DESKTOP_MODEL_PACK_UPDATE_EVENT, payload\)/);
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
  assert.match(workerRuntime, /"ok": true,\s*"contract": MAGIC_SELECT_LOCAL_CONTRACT,\s*"action": MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,\s*"imageId": image_id,\s*"candidate": candidate,\s*"group": \{/s);
  assert.match(workerRuntime, /"group": \{[\s\S]*"reproducibility": group\["reproducibility"\]\.clone\(\),[\s\S]*"warnings": warnings\.clone\(\),[\s\S]*\},\s*"receipt": \{/s);
  assert.match(workerRuntime, /"warnings": warnings,\s*"preparedImageId": prepared_image_id,\s*"preparedImage": prepared_image,/s);
  assert.match(workerRuntime, /"ok": true,\s*"contract": MAGIC_SELECT_LOCAL_CONTRACT,\s*"action": MAGIC_SELECT_LOCAL_RELEASE_ACTION,\s*"imageId": image_id,\s*"preparedImageId": prepared_image_id,\s*"warnings": warnings,/s);
});

test("local docs and benchmark support files describe the committed prepared runtime names", () => {
  assert.match(runtimeDoc, new RegExp(`Contract: \`${preparedContract.replace(/\./g, "\\.")}\``));
  assert.match(runtimeDoc, /prepareLocalMagicSelectImage/);
  assert.match(runtimeDoc, /runWarmLocalMagicSelectClick/);
  assert.match(runtimeDoc, /releaseLocalMagicSelectImage/);
  assert.match(runtimeDoc, /evictLocalMagicSelectImage/);
  assert.match(runtimeDoc, /install_desktop_model_pack/);
  assert.match(runtimeDoc, /cue\.desktop\.model-pack\.install\.v1/);
  assert.match(runtimeDoc, /desktop_model_pack_status/);
  assert.match(runtimeDoc, /cue\.desktop\.model-pack\.update\.v1/);
  assert.match(runtimeDoc, /cue-desktop-model-pack-update/);
  assert.match(runtimeDoc, /pack\.status/);
  assert.match(runtimeDoc, /cue\.magic-select/);
  assert.match(runtimeDoc, /`pack\.status` snapshots/);
  assert.match(runtimeDoc, /`progress\.phase`/);
  assert.match(runtimeDoc, /`pack\.status`/);
  assert.match(runtimeDoc, /`runPaths`/);
  assert.match(runtimeDoc, /`modelPackId`/);
  assert.match(runtimeDoc, /`runtimeResolution`/);
  assert.match(runtimeDoc, /prepare_local_magic_select_image/);
  assert.match(runtimeDoc, /run_local_magic_select_warm_click/);
  assert.match(runtimeDoc, /release_local_magic_select_image/);
  assert.match(runtimeDoc, /magic_select_prepare/);
  assert.match(runtimeDoc, /magic_select_warm_click/);
  assert.match(runtimeDoc, /magic_select_release/);
  assert.match(runtimeDoc, /`preparedImageId`/);
  assert.match(runtimeDoc, /`preparedImage`/);
  assert.match(runtimeDoc, /`details` when present/);
  assert.match(prompts, new RegExp(preparedContract.replace(/\./g, "\\.")));
  assert.match(prompts, /prepareLocalMagicSelectImage/);
  assert.match(prompts, /runWarmLocalMagicSelectClick/);
  assert.match(prompts, /releaseLocalMagicSelectImage/);
  assert.match(prompts, /evictLocalMagicSelectImage/);
  assert.match(benchmarkScript, new RegExp(`"${preparedContract.replace(/\./g, "\\.")}"`));
  assert.match(benchmarkScript, /"magic_select_warm_click"/);
  assert.match(benchmarkScript, /cue\.magic-select/);
  assert.match(benchmarkScript, /CUE_MAGIC_SELECT_PACK_MANIFEST/);
  assert.match(benchmarkScript, /CUE_MAGIC_SELECT_MODEL_PATH/);
  assert.match(benchmarkScript, /installed_pack_manifest/);
});

test("buildMagicSelectRunPaths mirrors the Cue run contract layout", () => {
  assert.deepEqual(buildMagicSelectRunPaths("/tmp/cue_runs/run-17"), {
    runDir: "/tmp/cue_runs/run-17",
    sessionPath: "/tmp/cue_runs/run-17/session.json",
    legacySessionPath: "/tmp/cue_runs/run-17/juggernaut-session.json",
    timelinePath: "/tmp/cue_runs/run-17/session-timeline.json",
    eventsPath: "/tmp/cue_runs/run-17/events.jsonl",
    artifactsDir: "/tmp/cue_runs/run-17/artifacts",
    receiptsDir: "/tmp/cue_runs/run-17/receipts",
  });
});

test("normalizeMagicSelectRuntimeResolution preserves pack and install provenance when present", () => {
  const resolution = normalizeMagicSelectRuntimeResolution(
    {
      runtime: "local_magic_select_worker",
      runtimeId: "tauri_mobile_sam_python_worker_cpu",
      modelId: "mobile_sam_vit_t",
      modelRevision: "sha256:1234567890ab",
      modelPath: "/tmp/models/mobile_sam.pt",
      helperPath: "/tmp/helpers/magic_select_mobile_sam.py",
      modelPackId: MAGIC_SELECT_LOCAL_PACK_ID,
      modelPackVersion: "1.0.0",
      modelAssetSha256: "sha256:modelasset",
      modelInstallSource: "cue_pack_manager",
      entitlementMode: "paid_local_pack",
      manifestPath: "/tmp/.cue/models/packs/cue.magic-select/1.0.0/manifest.json",
      resolutionSource: "installed_pack_manifest",
    },
    {
      image_hash: "imgsha",
    }
  );

  assert.deepEqual(resolution, {
    resolutionOrder: ["installed_pack_manifest", "cue_home_env", "cue_env", "legacy_env"],
    resolutionSource: "installed_pack_manifest",
    runtime: "local_magic_select_worker",
    runtimeId: "tauri_mobile_sam_python_worker_cpu",
    imageHash: "imgsha",
    modelId: "mobile_sam_vit_t",
    modelRevision: "sha256:1234567890ab",
    modelPath: "/tmp/models/mobile_sam.pt",
    helperPath: "/tmp/helpers/magic_select_mobile_sam.py",
    packId: MAGIC_SELECT_LOCAL_PACK_ID,
    packVersion: "1.0.0",
    manifestPath: "/tmp/.cue/models/packs/cue.magic-select/1.0.0/manifest.json",
    modelAssetSha256: "sha256:modelasset",
    modelInstallSource: "cue_pack_manager",
    entitlementMode: "paid_local_pack",
  });
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
      if (command === "install_desktop_model_pack") {
        return {
          ok: true,
          contract: "cue.desktop.model-pack.install.v1",
          action: "pack.install",
          pack: {
            packId: "cue.magic-select",
            packVersion: "1.0.0",
            manifestPath: "/tmp/.cue/models/packs/cue.magic-select/manifest.json",
          },
          resolution: {
            runtime: "magic_select_local",
            runtimeId: "tauri_mobile_sam_python_worker_cpu",
            packId: "cue.magic-select",
            packVersion: "1.0.0",
            manifestPath: "/tmp/.cue/models/packs/cue.magic-select/manifest.json",
            modelId: "mobile_sam_vit_t",
            modelRevision: "sha256:1234567890ab",
            modelPath: "/tmp/.cue/models/mobile_sam_vit_t.safetensors",
            helperPath: "/tmp/cue/scripts/magic_select_mobile_sam.py",
            modelAssetSha256: "sha256:modelasset",
            modelInstallSource: "host_install",
            entitlementMode: "local_only",
            resolutionSource: "installed_pack_manifest",
            resolutionOrder: ["installed_pack_manifest", "cue_home_env", "cue_env", "legacy_env"],
          },
          warnings: ["pack_ready"],
        };
      }
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

  assert.equal(calls.length, 2);
  assert.equal(calls[0].command, "install_desktop_model_pack");
  assert.equal(calls[0].payload.request.contract, "cue.desktop.model-pack.install.v1");
  assert.equal(calls[0].payload.request.action, "pack.install");
  assert.equal(calls[0].payload.request.pack.packId, "cue.magic-select");
  assert.equal(calls[0].payload.request.options.source, "communication_magic_select");
  assert.equal(calls[0].payload.request.options.allowExisting, false);
  assert.match(calls[0].payload.request.requestId, /^cue-pack-/);
  assert.equal(calls[1].command, "prepare_local_magic_select_image");
  assert.deepEqual(calls[1].payload.request, {
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
  assert.equal(result.preparedImage.runDir, "/tmp/run-7");
  assert.deepEqual(result.preparedImage.runPaths, {
    runDir: "/tmp/run-7",
    sessionPath: "/tmp/run-7/session.json",
    legacySessionPath: "/tmp/run-7/juggernaut-session.json",
    timelinePath: "/tmp/run-7/session-timeline.json",
    eventsPath: "/tmp/run-7/events.jsonl",
    artifactsDir: "/tmp/run-7/artifacts",
    receiptsDir: "/tmp/run-7/receipts",
  });
  assert.equal(result.preparedImage.runtime, "magic_select_local");
  assert.equal(result.preparedImage.runtimeId, "tauri_mobile_sam_python_worker_cpu");
  assert.equal(result.preparedImage.modelPackId, "cue.magic-select");
  assert.equal(result.preparedImage.modelPackVersion, "1.0.0");
  assert.equal(result.preparedImage.modelAssetSha256, "sha256:modelasset");
  assert.equal(result.preparedImage.modelInstallSource, "host_install");
  assert.equal(result.preparedImage.entitlementMode, "local_only");
  assert.equal(result.preparedImage.manifestPath, "/tmp/.cue/models/packs/cue.magic-select/manifest.json");
  assert.equal(result.preparedImage.modelPath, "/tmp/.cue/models/mobile_sam_vit_t.safetensors");
  assert.equal(result.preparedImage.helperPath, "/tmp/cue/scripts/magic_select_mobile_sam.py");
  assert.equal(result.preparedImage.resolutionSource, "installed_pack_manifest");
  assert.deepEqual(result.preparedImage.resolutionOrder, [
    "installed_pack_manifest",
    "cue_home_env",
    "cue_env",
    "legacy_env",
  ]);
  assert.equal(result.preparedImage.runtimeResolution.resolutionSource, "installed_pack_manifest");
  assert.deepEqual(result.preparedImage.runtimeResolution.resolutionOrder, [
    "installed_pack_manifest",
    "cue_home_env",
    "cue_env",
    "legacy_env",
  ]);
  assert.equal(result.preparedImage.preparedAt, 1712345678901);
  assert.equal(result.preparedImage.expiresAt, 1712345680000);
  assert.equal(result.preparedImage.useCount, 2);
  assert.equal(result.preparedImage.runtimeResolution.modelId, "mobile_sam_vit_t");
  assert.equal(result.preparedImage.runtimeResolution.imageHash, "imgsha");
  assert.equal(result.preparedImage.reproducibility.modelId, "mobile_sam_vit_t");
  assert.deepEqual(result.warnings, ["pack_ready", "cache primed"]);
});

test("prepareLocalMagicSelectImage accepts bridge-style session.runDir and preserves pack provenance on the prepared handle", async () => {
  const calls = [];
  const result = await prepareLocalMagicSelectImage({
    imageId: "img-11",
    imagePath: "/tmp/source-11.png",
    session: {
      runDir: "/tmp/cue_runs/run-11",
    },
    sourceReceiptPath: "/tmp/cue_runs/run-11/receipts/import-11.json",
    source: "communication_magic_select",
    invokeFn: async (command, payload) => {
      calls.push({ command, payload });
      if (command === "install_desktop_model_pack") {
        return {
          ok: true,
          contract: "cue.desktop.model-pack.install.v1",
          action: "pack.install",
          pack: {
            packId: MAGIC_SELECT_LOCAL_PACK_ID,
            packVersion: "1.0.0",
          },
          resolution: {
            packId: MAGIC_SELECT_LOCAL_PACK_ID,
            packVersion: "1.0.0",
            resolutionSource: "installed_pack_manifest",
          },
        };
      }
      return {
        ok: true,
        preparedImageId: "prepared-img-11",
        preparedImage: {
          imageId: "img-11",
          imagePath: "/tmp/source-11.png",
          run: {
            runDir: "/tmp/cue_runs/run-11",
          },
          stableSourceRef: "/tmp/cue_runs/run-11/receipts/import-11.json",
          runtime: "local_magic_select_worker",
          runtimeId: "tauri_mobile_sam_python_worker_cpu",
          imageHash: "imgsha11",
          modelId: "mobile_sam_vit_t",
          modelRevision: "sha256:model11",
          modelPackId: MAGIC_SELECT_LOCAL_PACK_ID,
          modelPackVersion: "1.0.0",
          modelAssetSha256: "sha256:model-asset-11",
          modelInstallSource: "cue_pack_manager",
          entitlementMode: "paid_local_pack",
          runtimeResolution: {
            resolutionSource: "installed_pack_manifest",
          },
        },
      };
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].command, "install_desktop_model_pack");
  assert.equal(calls[1].command, "prepare_local_magic_select_image");
  assert.equal(calls[1].payload.request.runDir, "/tmp/cue_runs/run-11");
  assert.equal(
    calls[1].payload.request.stableSourceRef,
    "/tmp/cue_runs/run-11/receipts/import-11.json"
  );
  assert.equal(result.preparedImage.runDir, "/tmp/cue_runs/run-11");
  assert.equal(result.preparedImage.runPaths?.eventsPath, "/tmp/cue_runs/run-11/events.jsonl");
  assert.equal(result.preparedImage.runtime, "local_magic_select_worker");
  assert.equal(result.preparedImage.runtimeId, "tauri_mobile_sam_python_worker_cpu");
  assert.equal(result.preparedImage.imageHash, "imgsha11");
  assert.equal(result.preparedImage.modelPackId, MAGIC_SELECT_LOCAL_PACK_ID);
  assert.equal(result.preparedImage.modelPackVersion, "1.0.0");
  assert.equal(result.preparedImage.modelInstallSource, "cue_pack_manager");
  assert.equal(result.preparedImage.entitlementMode, "paid_local_pack");
  assert.equal(
    result.preparedImage.runtimeResolution?.resolutionSource,
    "installed_pack_manifest"
  );
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

test("runLocalMagicSelectClick uses the prepared contract fallback and requires a stable run context", async () => {
  const calls = [];
  const result = await runLocalMagicSelectClick({
    imageId: "img-13",
    imagePath: "/tmp/source-13.png",
    session: {
      runDir: "/tmp/cue_runs/run-13",
    },
    sourceReceiptPath: "/tmp/cue_runs/run-13/receipts/import-13.json",
    clickAnchor: { x: 41.4, y: 19.7 },
    invokeFn: async (command, payload) => {
      calls.push({ command, payload });
      if (command === "install_desktop_model_pack") {
        return {
          ok: true,
          contract: "cue.desktop.model-pack.install.v1",
          action: "pack.install",
          pack: {
            packId: MAGIC_SELECT_LOCAL_PACK_ID,
            packVersion: "1.0.0",
          },
          resolution: {
            packId: MAGIC_SELECT_LOCAL_PACK_ID,
            packVersion: "1.0.0",
            resolutionSource: "installed_pack_manifest",
          },
        };
      }
      return {
        ok: true,
        action: "magic_select_warm_click",
        preparedImageId: "prepared-img-13",
        preparedImage: {
          imageId: "img-13",
          imagePath: "/tmp/source-13.png",
          runDir: "/tmp/cue_runs/run-13",
        },
        group: {
          imageId: "img-13",
          anchor: { x: 41, y: 20 },
          candidates: [
            {
              id: "magic-select-direct-13",
              bounds: { x: 12, y: 8, w: 32, h: 24 },
              contourPoints: [
                { x: 12, y: 8 },
                { x: 44, y: 8 },
                { x: 44, y: 32 },
                { x: 12, y: 32 },
              ],
              maskRef: {
                path: "/tmp/cue_runs/run-13/artifacts/mask-13.png",
                sha256: "mask13",
                width: 90,
                height: 120,
                format: "png",
              },
            },
          ],
        },
      };
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].command, "install_desktop_model_pack");
  assert.equal(calls[1].command, "run_local_magic_select_click");
  assert.equal(calls[1].payload.request.runDir, "/tmp/cue_runs/run-13");
  assert.equal(
    calls[1].payload.request.stableSourceRef,
    "/tmp/cue_runs/run-13/receipts/import-13.json"
  );
  assert.equal(result.contract, MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT);
  assert.equal(result.preparedImage.runPaths?.receiptsDir, "/tmp/cue_runs/run-13/receipts");

  await assert.rejects(
    () =>
      runLocalMagicSelectClick({
        imageId: "img-missing",
        imagePath: "/tmp/source-missing.png",
        clickAnchor: { x: 1, y: 2 },
      }),
    /runDir or session\.runDir/
  );
  assert.equal(MAGIC_SELECT_LOCAL_RUNTIME_CONTRACT, MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT);
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

test("runLocalMagicSelectClick installs the pack through the typed Bridge seam before executing the local click", async () => {
  const calls = [];
  const result = await runLocalMagicSelectClick({
    imageId: "img-42",
    imagePath: "/tmp/source-42.png",
    runDir: "/tmp/run-42",
    stableSourceRef: "/tmp/run-42/receipts/import.json",
    clickAnchor: { x: 21.8, y: 10.4 },
    source: "communication_magic_select",
    invokeFn: async (command, payload) => {
      calls.push({ command, payload });
      if (command === "install_desktop_model_pack") {
        return {
          ok: true,
          contract: "cue.desktop.model-pack.install.v1",
          action: "pack.install",
          pack: {
            packId: "cue.magic-select",
            packVersion: "1.0.0",
            manifestPath: "/tmp/.cue/models/packs/cue.magic-select/manifest.json",
          },
          resolution: {
            runtime: "magic_select_local",
            runtimeId: "tauri_mobile_sam_python_worker_cpu",
            packId: "cue.magic-select",
            packVersion: "1.0.0",
            manifestPath: "/tmp/.cue/models/packs/cue.magic-select/manifest.json",
            modelId: "mobile_sam_vit_t",
            modelRevision: "sha256:1234567890ab",
            modelPath: "/tmp/.cue/models/mobile_sam_vit_t.safetensors",
            helperPath: "/tmp/cue/scripts/magic_select_mobile_sam.py",
            modelAssetSha256: "sha256:modelasset",
            modelInstallSource: "host_install",
            entitlementMode: "local_only",
            resolutionSource: "installed_pack_manifest",
            resolutionOrder: ["installed_pack_manifest", "cue_home_env", "cue_env", "legacy_env"],
          },
          warnings: ["pack_ready"],
        };
      }
      return {
        ok: true,
        contract: MAGIC_SELECT_LOCAL_RUNTIME_CONTRACT,
        action: "magic_select_click",
        preparedImageId: "prepared-img-42",
        preparedImage: {
          imageId: "img-42",
          imagePath: "/tmp/source-42.png",
          preparedAt: 1712345678901,
        },
        group: {
          imageId: "img-42",
          anchor: { x: 22, y: 10 },
          candidates: [
            {
              id: "magic-select-42",
              bounds: { x: 12, y: 4, w: 24, h: 18 },
              contourPoints: [
                { x: 12, y: 4 },
                { x: 36, y: 4 },
                { x: 36, y: 22 },
                { x: 12, y: 22 },
              ],
              maskRef: {
                path: "/tmp/run-42/artifacts/mask-42.png",
                sha256: "sha256:mask42",
                width: 24,
                height: 18,
                format: "png",
              },
              confidence: 0.97,
              source: "local_model:mobile_sam_vit_t",
            },
          ],
          chosenCandidateId: "magic-select-42",
        },
        warnings: ["clicked"],
      };
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].command, "install_desktop_model_pack");
  assert.equal(calls[1].command, "run_local_magic_select_click");
  assert.deepEqual(calls[1].payload.request, {
    imageId: "img-42",
    imagePath: "/tmp/source-42.png",
    runDir: "/tmp/run-42",
    stableSourceRef: "/tmp/run-42/receipts/import.json",
    clickAnchor: { x: 22, y: 10 },
    source: "communication_magic_select",
    settings: {
      maskThreshold: 127,
      maxContourPoints: 256,
    },
  });
  assert.equal(result.preparedImage.modelPackId, "cue.magic-select");
  assert.equal(result.preparedImage.modelPackVersion, "1.0.0");
  assert.equal(result.preparedImage.runDir, "/tmp/run-42");
  assert.equal(result.preparedImage.runtimeId, "tauri_mobile_sam_python_worker_cpu");
  assert.equal(result.preparedImage.resolutionSource, "installed_pack_manifest");
  assert.deepEqual(result.warnings, ["pack_ready", "clicked"]);
});
