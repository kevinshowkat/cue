import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DESKTOP_MODEL_PACK_ACTIONS,
  DESKTOP_MODEL_PACK_INSTALL_CONTRACT,
  DESKTOP_MODEL_PACK_UPDATE_CONTRACT,
  DESKTOP_MODEL_PACK_UPDATE_EVENT,
  DESKTOP_MODEL_PACK_UPDATE_KINDS,
  DESKTOP_SESSION_ACTIONS,
  DESKTOP_SESSION_COMMAND_CONTRACT,
  DESKTOP_SESSION_UPDATE_CONTRACT,
  DESKTOP_SESSION_UPDATE_KINDS,
  buildDesktopModelPackInstallRequest,
  buildDesktopModelPackStatusRequest,
  buildDesktopSessionDispatchRequest,
  buildDesktopSessionStartRequest,
  buildDesktopSessionStatusRequest,
  buildDesktopSessionStopRequest,
  readDesktopModelPackStatus,
  parseLegacyPtyLine,
  unwrapDesktopModelPackUpdate,
  unwrapDesktopSessionUpdate,
} from "../src/canvas_protocol.js";

test("desktop session start request uses the typed bridge contract and run-scoped session identity", () => {
  const request = buildDesktopSessionStartRequest({
    runDir: "/tmp/cue-run-1",
    memoryEnabled: true,
    textModel: "gpt-5.4",
    imageModel: "gemini-3.1-flash-image-preview",
    activeImagePath: "/tmp/source.png",
  });

  assert.equal(request.contract, DESKTOP_SESSION_COMMAND_CONTRACT);
  assert.equal(request.action, DESKTOP_SESSION_ACTIONS.START);
  assert.equal(request.session.runDir, "/tmp/cue-run-1");
  assert.equal(request.launch.memoryEnabled, true);
  assert.equal(request.launch.textModel, "gpt-5.4");
  assert.equal(request.launch.imageModel, "gemini-3.1-flash-image-preview");
  assert.equal(request.launch.activeImagePath, "/tmp/source.png");
});

test("desktop session dispatch request normalizes legacy commands into a typed payload", () => {
  const request = buildDesktopSessionDispatchRequest({
    runDir: "/tmp/cue-run-2",
    data: '/use "/tmp/source image.png"\n',
  });

  assert.equal(request.contract, DESKTOP_SESSION_COMMAND_CONTRACT);
  assert.equal(request.action, DESKTOP_SESSION_ACTIONS.DISPATCH);
  assert.equal(request.session.runDir, "/tmp/cue-run-2");
  assert.equal(request.command.kind, "legacy_command");
  assert.equal(request.command.command, "/use");
  assert.equal(request.command.argsText, '"/tmp/source image.png"');
});

test("legacy PTY parsing keeps plain prompts distinct from slash commands", () => {
  assert.deepEqual(parseLegacyPtyLine("make this cleaner\n"), {
    kind: "legacy_prompt",
    prompt: "make this cleaner",
    raw: "make this cleaner",
  });

  assert.deepEqual(parseLegacyPtyLine("/image_model nano-banana\n"), {
    kind: "legacy_command",
    command: "/image_model",
    argsText: "nano-banana",
    recognized: true,
    raw: "/image_model nano-banana",
  });
});

test("desktop session status request keeps the same contract and action surface", () => {
  const request = buildDesktopSessionStatusRequest({ runDir: "/tmp/cue-run-3" });

  assert.equal(request.contract, DESKTOP_SESSION_COMMAND_CONTRACT);
  assert.equal(request.action, DESKTOP_SESSION_ACTIONS.STATUS);
  assert.equal(request.session.runDir, "/tmp/cue-run-3");
});

test("desktop session stop request keeps the same contract and run-scoped identity", () => {
  const request = buildDesktopSessionStopRequest({ runDir: "/tmp/cue-run-5" });

  assert.equal(request.contract, DESKTOP_SESSION_COMMAND_CONTRACT);
  assert.equal(request.action, DESKTOP_SESSION_ACTIONS.STOP);
  assert.equal(request.session.runDir, "/tmp/cue-run-5");
});

test("desktop model pack install request uses the typed host boundary", () => {
  const request = buildDesktopModelPackInstallRequest({
    packId: "cue.magic-select",
    source: "desktop_runtime",
    allowExisting: false,
  });

  assert.equal(request.contract, DESKTOP_MODEL_PACK_INSTALL_CONTRACT);
  assert.equal(request.action, DESKTOP_MODEL_PACK_ACTIONS.INSTALL);
  assert.equal(request.pack.packId, "cue.magic-select");
  assert.equal(request.options.source, "desktop_runtime");
  assert.equal(request.options.allowExisting, false);
});

test("desktop model pack status request stays on the same command family", () => {
  const request = buildDesktopModelPackStatusRequest({
    packId: "cue.magic-select",
  });

  assert.equal(request.contract, DESKTOP_MODEL_PACK_INSTALL_CONTRACT);
  assert.equal(request.action, DESKTOP_MODEL_PACK_ACTIONS.STATUS);
  assert.equal(request.pack.packId, "cue.magic-select");
});

test("desktop model pack status reader invokes the typed host command name", async () => {
  const calls = [];
  const invokeFn = async (command, payload) => {
    calls.push({ command, payload });
    return { ok: true };
  };
  const request = buildDesktopModelPackStatusRequest({
    packId: "cue.magic-select",
  });

  const result = await readDesktopModelPackStatus(invokeFn, request);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, [
    {
      command: "desktop_model_pack_status",
      payload: { request },
    },
  ]);
});

test("desktop model pack updates unwrap the typed status and progress payload", () => {
  assert.equal(DESKTOP_MODEL_PACK_UPDATE_EVENT, "cue-desktop-model-pack-update");

  const update = unwrapDesktopModelPackUpdate({
    contract: DESKTOP_MODEL_PACK_UPDATE_CONTRACT,
    requestId: "cue-pack-1",
    kind: DESKTOP_MODEL_PACK_UPDATE_KINDS.MODEL_PACK,
    pack: {
      packId: "cue.magic-select",
      packVersion: "1.0.0",
      status: "installing",
      manifestPath: "/tmp/.cue/model-packs/cue.magic-select/manifest.json",
      modelIds: ["mobile_sam_vit_t"],
      warnings: ["pack_ready"],
    },
    progress: {
      phase: "verify",
      completedBytes: 1024,
      totalBytes: 2048,
    },
    detail: "verifying manifest",
  });

  assert.equal(update.contract, DESKTOP_MODEL_PACK_UPDATE_CONTRACT);
  assert.equal(update.requestId, "cue-pack-1");
  assert.equal(update.kind, DESKTOP_MODEL_PACK_UPDATE_KINDS.MODEL_PACK);
  assert.equal(update.pack.packId, "cue.magic-select");
  assert.equal(update.pack.status, "installing");
  assert.equal(update.progress.phase, "verify");
  assert.equal(update.progress.completedBytes, 1024);
  assert.equal(update.detail, "verifying manifest");
});

test("desktop session update unwrap preserves run-scoped status and event payloads", () => {
  const status = unwrapDesktopSessionUpdate({
    contract: DESKTOP_SESSION_UPDATE_CONTRACT,
    kind: DESKTOP_SESSION_UPDATE_KINDS.STATUS,
    session: { runDir: "/tmp/cue-run-4" },
    runtime: { phase: "ready", running: true },
    launch: { mode: "native", label: "brood-rs" },
  });
  assert.equal(status.kind, DESKTOP_SESSION_UPDATE_KINDS.STATUS);
  assert.equal(status.runDir, "/tmp/cue-run-4");
  assert.equal(status.runtime.phase, "ready");
  assert.equal(status.launch.label, "brood-rs");

  const event = unwrapDesktopSessionUpdate({
    contract: DESKTOP_SESSION_UPDATE_CONTRACT,
    kind: DESKTOP_SESSION_UPDATE_KINDS.EVENT,
    session: { runDir: "/tmp/cue-run-4" },
    event: { type: "artifact_created", artifact_id: "artifact-1" },
  });
  assert.equal(event.kind, DESKTOP_SESSION_UPDATE_KINDS.EVENT);
  assert.equal(event.runDir, "/tmp/cue-run-4");
  assert.deepEqual(event.event, {
    type: "artifact_created",
    artifact_id: "artifact-1",
  });
});
