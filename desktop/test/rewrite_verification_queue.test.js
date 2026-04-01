import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const queueModulePath = resolve(repoRoot, "scripts", "rewrite_verification_queue.mjs");

async function loadQueueModule() {
  return import(`${pathToFileURL(queueModulePath).href}?source=${Date.now()}`);
}

test("rewrite verification queue keeps the runbook proof set mapped to local artifacts", async () => {
  const {
    rewriteMilestone,
    runbookProofEntryIds,
    selectVerificationQueue,
    verificationQueue,
  } = await loadQueueModule();

  assert.equal(new Set(verificationQueue.map((entry) => entry.id)).size, verificationQueue.length);

  const runbookEntries = selectVerificationQueue({ group: "runbook-proof" });
  assert.deepEqual(
    runbookEntries.map((entry) => entry.id),
    runbookProofEntryIds
  );

  for (const entry of runbookEntries) {
    assert.equal(entry.owner, "Verify");
    assert.equal(entry.branch, "main");
    assert.equal(entry.milestone, rewriteMilestone);
    assert.ok(entry.parityRows.length >= 1);
    assert.ok(entry.notes.length >= 1);
    for (const artifact of entry.proofArtifacts) {
      assert.ok(existsSync(resolve(repoRoot, artifact)), `${entry.id} artifact missing: ${artifact}`);
    }
  }
});

test("release-check queue stays auto-runnable and smoke or benchmark entries resolve with explicit inputs", async () => {
  const {
    releaseCheckEntryIds,
    resolveVerificationCommand,
    selectVerificationQueue,
    verificationArtifactPaths,
  } = await loadQueueModule();

  const releaseEntries = selectVerificationQueue({ group: "release-check" });
  assert.deepEqual(
    releaseEntries.map((entry) => entry.id),
    releaseCheckEntryIds
  );

  for (const entry of releaseEntries) {
    const command = resolveVerificationCommand(entry.id);
    assert.ok(Array.isArray(command));
    assert.equal(command[0], "node");
    assert.equal(command[1], "--test");
    assert.match(command[2], /(?:^desktop\/test\/|\/desktop\/test\/)/);
  }

  assert.deepEqual(resolveVerificationCommand("smoke.macos_clean_machine", { dmgPath: "/tmp/Cue.dmg" }), [
    "bash",
    "./scripts/macos_clean_machine_smoke.sh",
    "/tmp/Cue.dmg",
  ]);

  assert.deepEqual(
    resolveVerificationCommand("benchmark.magic_select_runtime", {
      imagePath: "/tmp/input.png",
      modelPath: "/tmp/mobile_sam.pt",
      warmClicks: "6",
      threads: "2",
    }),
    [
      "python3",
      "scripts/benchmark_magic_select_runtime.py",
      "--image-path",
      "/tmp/input.png",
      "--model-path",
      "/tmp/mobile_sam.pt",
      "--output-json",
      verificationArtifactPaths.benchmarkMagicSelectRuntime,
      "--warm-clicks",
      "6",
      "--threads",
      "2",
    ]
  );

  assert.deepEqual(
    resolveVerificationCommand("benchmark.magic_select_runtime", {
      imagePath: "/tmp/input.png",
      modelPath: "/tmp/mobile_sam.pt",
      outputJson: "/tmp/benchmark.json",
    }),
    [
      "python3",
      "scripts/benchmark_magic_select_runtime.py",
      "--image-path",
      "/tmp/input.png",
      "--model-path",
      "/tmp/mobile_sam.pt",
      "--output-json",
      "/tmp/benchmark.json",
    ]
  );

  const [benchmarkEntry] = selectVerificationQueue({ ids: ["benchmark.magic_select_runtime"] });
  const [smokeEntry] = selectVerificationQueue({ ids: ["smoke.macos_clean_machine"] });
  assert.deepEqual(benchmarkEntry.artifactOutputPaths, [verificationArtifactPaths.benchmarkMagicSelectRuntime]);
  assert.deepEqual(smokeEntry.artifactOutputPaths, [verificationArtifactPaths.smokeMacosCleanMachine]);
});

test("newly closed blocker proofs point at the published shell, canvas, or export paths", async () => {
  const {
    blockerVerificationStatus,
    publishedProofPaths,
    selectVerificationQueue,
  } = await loadQueueModule();

  const expectedReadyBlockers = [
    ["B3", "proof.shell.tabbed_sessions_v1", publishedProofPaths.shellTabbedSessionsV1],
    ["B4", "proof.export.export_raster_contract", publishedProofPaths.exportRasterContract],
    ["B7", "proof.shell.native_system_menu_contract", publishedProofPaths.shellNativeSystemMenu],
    ["B9", "proof.domain.session_timeline_contract", publishedProofPaths.canvasSessionTimeline],
  ];

  for (const [blockerId, queueId, proofPath] of expectedReadyBlockers) {
    const blocker = blockerVerificationStatus.find((entry) => entry.blockerId === blockerId);
    assert.ok(blocker, `Missing blocker record for ${blockerId}`);
    assert.equal(blocker.status, "ready");
    assert.equal(blocker.queueId, queueId);
    assert.equal(blocker.proofPath, proofPath);
    assert.ok(existsSync(proofPath), `${blockerId} proof path missing: ${proofPath}`);

    const [queueEntry] = selectVerificationQueue({ ids: [queueId] });
    assert.ok(queueEntry, `Missing queue entry for ${queueId}`);
    assert.ok(queueEntry.groups.includes("blocker-ready"));
    assert.ok(queueEntry.blockers.includes(blockerId));
    assert.deepEqual(queueEntry.proofArtifacts, [proofPath]);
  }
});
