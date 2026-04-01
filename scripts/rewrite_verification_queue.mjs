#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = dirname(scriptPath);

export const repoRoot = resolve(scriptDir, "..");
export const verificationDocsPath = resolve(repoRoot, "docs", "benchmark-playbook.md");
export const rewriteMilestone = "macos_screenshot_polish_baseline";
export const rewriteVerifyBranch = "main";
export const verificationArtifactPaths = Object.freeze({
  benchmarkMagicSelectRuntime: resolve(
    repoRoot,
    "outputs",
    "verification",
    "benchmark.magic_select_runtime",
    "benchmark.json"
  ),
  smokeMacosCleanMachine: resolve(
    repoRoot,
    "outputs",
    "verification",
    "smoke.macos_clean_machine",
    "smoke.log"
  ),
});
export const publishedProofPaths = Object.freeze({
  shellTabbedSessionsV1: resolve(repoRoot, "desktop", "test", "tabbed_sessions_v1_contract.test.js"),
  shellNativeSystemMenu: resolve(repoRoot, "desktop", "test", "native_system_menu_contract.test.js"),
  canvasSessionTimeline: resolve(repoRoot, "desktop", "test", "session_timeline.test.js"),
  exportRasterContract: resolve(repoRoot, "desktop", "test", "export_raster_contract.test.js"),
  exportPsdContract: resolve(repoRoot, "desktop", "test", "export_psd_contract.test.js"),
});

export const blockerVerificationStatus = Object.freeze([
  Object.freeze({
    blockerId: "B3",
    status: "ready",
    queueId: "proof.shell.tabbed_sessions_v1",
    proofPath: publishedProofPaths.shellTabbedSessionsV1,
    summary: "Shell published canonical-first reopen with legacy session snapshot fallback in the tabbed sessions proof.",
  }),
  Object.freeze({
    blockerId: "B4",
    status: "ready",
    queueId: "proof.export.export_raster_contract",
    proofPath: publishedProofPaths.exportRasterContract,
    summary: "Export published the flattened raster proof for PNG, JPG, WEBP, and TIFF.",
  }),
  Object.freeze({
    blockerId: "B7",
    status: "ready",
    queueId: "proof.shell.native_system_menu_contract",
    proofPath: publishedProofPaths.shellNativeSystemMenu,
    summary: "Shell published the native system menu baseline proof with Make Space excluded before custom tools.",
  }),
  Object.freeze({
    blockerId: "B9",
    status: "ready",
    queueId: "proof.domain.session_timeline_contract",
    proofPath: publishedProofPaths.canvasSessionTimeline,
    summary:
      "Canvas canonical cue.timeline.v1 writes now always emit nodes[*].snapshot_ref, purge snapshot-less legacy nodes, and resolve head/latest ids against the written node set.",
  }),
]);

export const runbookProofEntryIds = Object.freeze([
  "proof.shell.tabbed_sessions_v1",
  "proof.review.design_review_contract",
  "proof.inference.magic_select_runtime",
  "proof.export.export_psd_contract",
  "benchmark.magic_select_runtime",
  "smoke.macos_clean_machine",
]);

export const releaseCheckEntryIds = Object.freeze([
  "proof.shell.tabbed_sessions_v1",
  "proof.review.design_review_contract",
  "proof.inference.magic_select_runtime",
  "proof.export.export_psd_contract",
]);

function requireOptionValue(value, optionName, entryId) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error(`Missing required option --${optionName} for ${entryId}.`);
  }
  return normalized;
}

function createStaticEntry(entry) {
  return Object.freeze(entry);
}

function createCommandEntry(entry) {
  return Object.freeze({
    ...entry,
    buildCommand(options = {}) {
      return typeof entry.buildCommand === "function" ? entry.buildCommand(options) : entry.command.slice();
    },
  });
}

export const verificationQueue = Object.freeze([
  createStaticEntry({
    id: "proof.shell.tabbed_sessions_v1",
    label: "Session tabs parity proof",
    area: "Shell/Sessions",
    milestone: rewriteMilestone,
    owner: "Verify",
    branch: rewriteVerifyBranch,
    groups: ["release-check", "runbook-proof", "parity-proof", "blocker-ready"],
    blockers: ["B3"],
    parityRows: [
      "Shell | Single desktop window with one shared canvas and in-app session tabs",
      "Sessions | New Run or New session opens a new tab without wiping the current tab",
      "Sessions | Open Run opens an existing run in a new tab",
      "Sessions | Fork tab preserves the current state as a sibling variant",
      "Persistence | Reopen saved runs from session-timeline.json and juggernaut-session.json lineage",
      "Sessions | Busy tabs block unsafe switching, closing, or forking",
    ],
    proofArtifacts: [publishedProofPaths.shellTabbedSessionsV1],
    command: ["node", "--test", publishedProofPaths.shellTabbedSessionsV1],
    commandPreview: `node --test ${publishedProofPaths.shellTabbedSessionsV1}`,
    notes:
      "Maps the session and tab rows onto the published shell proof, including canonical-first reopen and the legacy session snapshot fallback closure for B3.",
  }),
  createStaticEntry({
    id: "proof.shell.native_system_menu_contract",
    label: "Native system menu parity proof",
    area: "Shell/Menus",
    milestone: rewriteMilestone,
    owner: "Verify",
    branch: rewriteVerifyBranch,
    groups: ["parity-proof", "blocker-ready"],
    blockers: ["B7"],
    parityRows: [
      "Shell | Native File menu parity for new/open/save/close/import/export/settings",
    ],
    proofArtifacts: [publishedProofPaths.shellNativeSystemMenu],
    command: ["node", "--test", publishedProofPaths.shellNativeSystemMenu],
    commandPreview: `node --test ${publishedProofPaths.shellNativeSystemMenu}`,
    notes:
      "Tracks the published shell-side B7 closure for the native system menu baseline and the pre-custom-tool communication slot layout.",
  }),
  createStaticEntry({
    id: "proof.domain.session_timeline_contract",
    label: "Canonical session timeline parity proof",
    area: "Domain/Canvas",
    milestone: rewriteMilestone,
    owner: "Verify",
    branch: rewriteVerifyBranch,
    groups: ["parity-proof", "blocker-ready"],
    blockers: ["B9"],
    parityRows: [
      "History/compare | Restore prior timeline states without re-running model work",
    ],
    proofArtifacts: [publishedProofPaths.canvasSessionTimeline],
    command: ["node", "--test", publishedProofPaths.canvasSessionTimeline],
    commandPreview: `node --test ${publishedProofPaths.canvasSessionTimeline}`,
    notes:
      "Tracks the published B9 closure for canonical cue.timeline.v1 writes with nodes[*].snapshot_ref always present on canonical write.",
  }),
  createStaticEntry({
    id: "proof.review.design_review_contract",
    label: "Design Review request parity proof",
    area: "Review/Apply",
    milestone: rewriteMilestone,
    owner: "Verify",
    branch: rewriteVerifyBranch,
    groups: ["release-check", "runbook-proof", "parity-proof"],
    parityRows: [
      "Review/apply | Explicit Design Review trigger",
      "Review/apply | Proposal tray or proposal cards",
    ],
    proofArtifacts: ["desktop/test/design_review_contract.test.js"],
    command: ["node", "--test", "desktop/test/design_review_contract.test.js"],
    commandPreview: "node --test desktop/test/design_review_contract.test.js",
    notes:
      "Pins the request and planner contract that design review relies on before the smoke gate exercises proposal flow end to end.",
  }),
  createStaticEntry({
    id: "proof.inference.magic_select_runtime",
    label: "Magic Select runtime parity proof",
    area: "Inference",
    milestone: rewriteMilestone,
    owner: "Verify",
    branch: rewriteVerifyBranch,
    groups: ["release-check", "runbook-proof", "parity-proof"],
    parityRows: [
      "Communication rail | Magic Select",
      "Runtime direction | Local model pack substrate for Magic Select and future local image operations",
    ],
    proofArtifacts: ["desktop/test/magic_select_runtime.test.js"],
    command: ["node", "--test", "desktop/test/magic_select_runtime.test.js"],
    commandPreview: "node --test desktop/test/magic_select_runtime.test.js",
    notes:
      "Covers the prepared local Magic Select runtime contract plus the benchmark-facing names that other branches depend on.",
  }),
  createStaticEntry({
    id: "proof.export.export_psd_contract",
    label: "Receipt-backed PSD export parity proof",
    area: "Export",
    milestone: rewriteMilestone,
    owner: "Verify",
    branch: rewriteVerifyBranch,
    groups: ["release-check", "runbook-proof", "parity-proof"],
    parityRows: [
      "Export | Titlebar export menu for PSD, PNG, JPG, WEBP, TIFF",
      "Export | Receipt-backed export for the current visible tab state",
      "Export | Flattened PSD export",
    ],
    proofArtifacts: [publishedProofPaths.exportPsdContract],
    command: ["node", "--test", publishedProofPaths.exportPsdContract],
    commandPreview: `node --test ${publishedProofPaths.exportPsdContract}`,
    notes:
      "Keeps the export proof aligned with the current screenshot-polish baseline and the release-check gate.",
  }),
  createStaticEntry({
    id: "proof.export.export_raster_contract",
    label: "Flattened raster export parity proof",
    area: "Export",
    milestone: rewriteMilestone,
    owner: "Verify",
    branch: rewriteVerifyBranch,
    groups: ["parity-proof", "blocker-ready"],
    blockers: ["B4"],
    parityRows: [
      "Export | Flattened PNG, JPG, WEBP, TIFF export",
    ],
    proofArtifacts: [publishedProofPaths.exportRasterContract],
    command: ["node", "--test", publishedProofPaths.exportRasterContract],
    commandPreview: `node --test ${publishedProofPaths.exportRasterContract}`,
    notes:
      "Tracks the published export-side B4 closure for raster output through the shared exportRunInFormat path.",
  }),
  createCommandEntry({
    id: "benchmark.magic_select_runtime",
    label: "Magic Select benchmark capture",
    area: "Benchmarks",
    milestone: rewriteMilestone,
    owner: "Verify",
    branch: rewriteVerifyBranch,
    groups: ["runbook-proof", "benchmark"],
    parityRows: [
      "Communication rail | Magic Select",
      "Runtime direction | Local model pack substrate for Magic Select and future local image operations",
    ],
    proofArtifacts: ["scripts/benchmark_magic_select_runtime.py", "docs/benchmark-playbook.md"],
    artifactOutputPaths: [verificationArtifactPaths.benchmarkMagicSelectRuntime],
    commandPreview:
      `python3 scripts/benchmark_magic_select_runtime.py --image-path /abs/path/input.png --model-path /abs/path/mobile_sam.pt --output-json ${verificationArtifactPaths.benchmarkMagicSelectRuntime}`,
    buildCommand(options = {}) {
      const imagePath = requireOptionValue(options.imagePath, "image-path", "benchmark.magic_select_runtime");
      const modelPath = requireOptionValue(options.modelPath, "model-path", "benchmark.magic_select_runtime");
      const outputJson = String(options.outputJson || "").trim() || verificationArtifactPaths.benchmarkMagicSelectRuntime;
      const command = [
        "python3",
        "scripts/benchmark_magic_select_runtime.py",
        "--image-path",
        imagePath,
        "--model-path",
        modelPath,
        "--output-json",
        outputJson,
      ];
      if (String(options.anchor || "").trim()) {
        command.push("--anchor", String(options.anchor).trim());
      }
      if (String(options.warmClicks || "").trim()) {
        command.push("--warm-clicks", String(options.warmClicks).trim());
      }
      if (String(options.threads || "").trim()) {
        command.push("--threads", String(options.threads).trim());
      }
      if (String(options.targetWarmMs || "").trim()) {
        command.push("--target-warm-ms", String(options.targetWarmMs).trim());
      }
      return command;
    },
    notes:
      `Benchmark capture remains a first-class queue item. Its canonical output artifact path is ${verificationArtifactPaths.benchmarkMagicSelectRuntime}.`,
  }),
  createCommandEntry({
    id: "smoke.macos_clean_machine",
    label: "macOS clean-machine smoke gate",
    area: "Platform",
    milestone: rewriteMilestone,
    owner: "Verify",
    branch: rewriteVerifyBranch,
    groups: ["runbook-proof", "smoke-gate"],
    parityRows: ["Platform | macOS launchable parity for the screenshot-polish slice"],
    proofArtifacts: ["scripts/macos_clean_machine_smoke.sh"],
    artifactOutputPaths: [verificationArtifactPaths.smokeMacosCleanMachine],
    commandPreview: "bash ./scripts/macos_clean_machine_smoke.sh /abs/path/Cue.dmg",
    buildCommand(options = {}) {
      const dmgPath = requireOptionValue(options.dmgPath, "dmg-path", "smoke.macos_clean_machine");
      return ["bash", "./scripts/macos_clean_machine_smoke.sh", dmgPath];
    },
    notes:
      `The first milestone gate is a DMG-backed macOS smoke run. Its canonical output artifact path is ${verificationArtifactPaths.smokeMacosCleanMachine}.`,
  }),
]);

export const verificationQueueById = new Map(verificationQueue.map((entry) => [entry.id, entry]));

function toSerializableEntry(entry) {
  return {
    id: entry.id,
    label: entry.label,
    area: entry.area,
    milestone: entry.milestone,
    owner: entry.owner,
    branch: entry.branch,
    groups: entry.groups.slice(),
    parityRows: entry.parityRows.slice(),
    proofArtifacts: entry.proofArtifacts.slice(),
    artifactOutputPaths: Array.isArray(entry.artifactOutputPaths) ? entry.artifactOutputPaths.slice() : [],
    commandPreview: entry.commandPreview,
    blockers: Array.isArray(entry.blockers) ? entry.blockers.slice() : [],
    notes: entry.notes,
  };
}

export function selectVerificationQueue({ ids = [], group = null } = {}) {
  const wantedIds = Array.isArray(ids)
    ? ids.map((entryId) => String(entryId || "").trim()).filter(Boolean)
    : [];
  let entries = verificationQueue.slice();
  if (wantedIds.length) {
    const wantedSet = new Set(wantedIds);
    entries = entries.filter((entry) => wantedSet.has(entry.id));
  }
  if (group) {
    const normalizedGroup = String(group).trim();
    entries = entries.filter((entry) => entry.groups.includes(normalizedGroup));
  }
  return entries;
}

export function resolveVerificationCommand(entryId, options = {}) {
  const entry = verificationQueueById.get(String(entryId || "").trim());
  if (!entry) {
    throw new Error(`Unknown verification queue entry: ${entryId}`);
  }
  if (typeof entry.buildCommand === "function") {
    return entry.buildCommand(options);
  }
  if (Array.isArray(entry.command)) {
    return entry.command.slice();
  }
  throw new Error(`Verification queue entry is missing a runnable command: ${entryId}`);
}

function formatCommand(command) {
  return command
    .map((part) => {
      const value = String(part);
      return /\s/.test(value) ? JSON.stringify(value) : value;
    })
    .join(" ");
}

function runCommands(entries, options = {}) {
  if (!entries.length) {
    throw new Error("No verification queue entries matched the requested selection.");
  }
  for (const entry of entries) {
    const command = resolveVerificationCommand(entry.id, options);
    console.log(`[queue] ${entry.id}: ${entry.label}`);
    console.log(`[queue] command: ${formatCommand(command)}`);
    const result = spawnSync(command[0], command.slice(1), {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env,
    });
    if (result.status !== 0) {
      throw new Error(`Verification queue entry failed: ${entry.id}`);
    }
  }
}

function printEntries(entries, { json = false } = {}) {
  if (json) {
    console.log(JSON.stringify(entries.map(toSerializableEntry), null, 2));
    return;
  }
  console.log(`Rewrite verification queue`);
  console.log(`milestone: ${rewriteMilestone}`);
  console.log(`verification docs: ${verificationDocsPath}`);
  for (const entry of entries) {
    console.log(`- ${entry.id}: ${entry.label}`);
    console.log(`  groups: ${entry.groups.join(", ")}`);
    if (Array.isArray(entry.blockers) && entry.blockers.length) {
      console.log(`  blockers: ${entry.blockers.join(", ")}`);
    }
    console.log(`  proof: ${entry.proofArtifacts.join(", ")}`);
    if (Array.isArray(entry.artifactOutputPaths) && entry.artifactOutputPaths.length) {
      console.log(`  output: ${entry.artifactOutputPaths.join(", ")}`);
    }
    console.log(`  command: ${entry.commandPreview}`);
  }
}

function takeValue(argv, index, flag) {
  if (index + 1 >= argv.length) {
    throw new Error(`Expected a value after ${flag}.`);
  }
  return argv[index + 1];
}

function parseCli(argv) {
  const parsed = {
    command: "list",
    ids: [],
    group: null,
    json: false,
    options: {},
  };
  let modeSeen = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!modeSeen && !arg.startsWith("-") && ["list", "run", "help"].includes(arg)) {
      parsed.command = arg;
      modeSeen = true;
      continue;
    }
    switch (arg) {
      case "--group":
        parsed.group = takeValue(argv, index, arg);
        index += 1;
        break;
      case "--json":
        parsed.json = true;
        break;
      case "--image-path":
        parsed.options.imagePath = takeValue(argv, index, arg);
        index += 1;
        break;
      case "--model-path":
        parsed.options.modelPath = takeValue(argv, index, arg);
        index += 1;
        break;
      case "--output-json":
        parsed.options.outputJson = takeValue(argv, index, arg);
        index += 1;
        break;
      case "--dmg-path":
        parsed.options.dmgPath = takeValue(argv, index, arg);
        index += 1;
        break;
      case "--anchor":
        parsed.options.anchor = takeValue(argv, index, arg);
        index += 1;
        break;
      case "--warm-clicks":
        parsed.options.warmClicks = takeValue(argv, index, arg);
        index += 1;
        break;
      case "--threads":
        parsed.options.threads = takeValue(argv, index, arg);
        index += 1;
        break;
      case "--target-warm-ms":
        parsed.options.targetWarmMs = takeValue(argv, index, arg);
        index += 1;
        break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        parsed.ids.push(arg);
        break;
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage:
  node scripts/rewrite_verification_queue.mjs list [--group GROUP] [--json] [ENTRY_ID...]
  node scripts/rewrite_verification_queue.mjs run [--group GROUP] [ENTRY_ID...]
  node scripts/rewrite_verification_queue.mjs run benchmark.magic_select_runtime --image-path /abs/path/input.png --model-path /abs/path/mobile_sam.pt [--output-json /abs/path/benchmark.json]
  node scripts/rewrite_verification_queue.mjs run smoke.macos_clean_machine --dmg-path /abs/path/Cue.dmg`);
}

export function main(argv = process.argv.slice(2)) {
  const parsed = parseCli(argv);
  if (parsed.command === "help") {
    printHelp();
    return;
  }
  const entries = selectVerificationQueue({
    ids: parsed.ids,
    group: parsed.group,
  });
  if (parsed.command === "list") {
    printEntries(entries, { json: parsed.json });
    return;
  }
  if (parsed.command === "run") {
    runCommands(entries, parsed.options);
    return;
  }
  throw new Error(`Unsupported command: ${parsed.command}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === scriptPath) {
  try {
    main();
  } catch (error) {
    console.error(`[queue][error] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
