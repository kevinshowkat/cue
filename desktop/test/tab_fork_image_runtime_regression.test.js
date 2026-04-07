import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const rendererPath = join(here, "..", "src", "app", "canvas_renderer.js");
const app = readFileSync(appPath, "utf8");
const rendererSource = readFileSync(rendererPath, "utf8");

function extractFunctionSource(name, source = app) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  assert.notEqual(start, undefined, `Could not find function ${name}`);
  const signatureStart = source.indexOf("(", start);
  assert.notEqual(signatureStart, -1, `Could not find signature for ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = signatureStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (parenDepth === 0 && char === "{") {
      bodyStart = index;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `Could not find body for ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract function ${name}`);
}

function instantiateFunction(name, deps = {}) {
  const source = extractFunctionSource(name);
  const keys = Object.keys(deps);
  const values = Object.values(deps);
  return new Function(...keys, `return (${source});`)(...values);
}

test("fork rehydration reuses decoded image handles for cloned canvas items and Mother drafts", () => {
  const readSessionRuntimeImageHandle = instantiateFunction("readSessionRuntimeImageHandle");
  const rehydrateForkedTabSessionImageRuntime = instantiateFunction("rehydrateForkedTabSessionImageRuntime", {
    readSessionRuntimeImageHandle,
    Map,
    Set,
    Array,
    String,
  });

  const sourceCanvasHandle = {
    complete: true,
    naturalWidth: 1920,
    naturalHeight: 1080,
    marker: "source-canvas",
  };
  const sourceSecondaryHandle = {
    complete: true,
    naturalWidth: 1280,
    naturalHeight: 720,
    marker: "source-secondary",
  };
  const sourceDraftHandle = {
    complete: true,
    naturalWidth: 512,
    naturalHeight: 512,
    marker: "source-draft",
  };

  const sourcePrimary = { id: "img-1", path: "/tmp/combine.png", img: sourceCanvasHandle };
  const sourceSecondary = { id: "img-2", path: "/tmp/other.png", img: sourceSecondaryHandle };
  const sourceDraft = { id: "draft-1", path: "/tmp/draft.png", img: sourceDraftHandle };

  const forkPrimary = { id: "img-1", path: "/tmp/combine.png", img: { bogus: true }, imgLoading: true };
  const forkSecondary = { id: "img-2", path: "/tmp/other.png", img: { bogus: true }, imgLoading: true };
  const forkDraft = { id: "draft-1", path: "/tmp/draft.png", img: { bogus: true }, imgLoading: true };

  const forkedSession = {
    images: [forkPrimary],
    imagesById: new Map([
      ["img-1", forkPrimary],
      ["img-2", forkSecondary],
    ]),
    motherIdle: {
      drafts: [forkDraft],
    },
  };
  const sourceSession = {
    images: [sourcePrimary, sourceSecondary],
    imagesById: new Map([
      ["img-1", sourcePrimary],
      ["img-2", sourceSecondary],
    ]),
    motherIdle: {
      drafts: [sourceDraft],
    },
  };

  const result = rehydrateForkedTabSessionImageRuntime(forkedSession, sourceSession);

  assert.equal(result, forkedSession);
  assert.equal(forkPrimary.img, sourceCanvasHandle);
  assert.equal(forkPrimary.imgLoading, false);
  assert.equal(forkSecondary.img, sourceSecondaryHandle);
  assert.equal(forkSecondary.imgLoading, false);
  assert.equal(forkDraft.img, sourceDraftHandle);
  assert.equal(forkDraft.imgLoading, false);
});

test("fork rehydration clears unusable cloned image handles when no valid source handle exists", () => {
  const readSessionRuntimeImageHandle = instantiateFunction("readSessionRuntimeImageHandle");
  const rehydrateForkedTabSessionImageRuntime = instantiateFunction("rehydrateForkedTabSessionImageRuntime", {
    readSessionRuntimeImageHandle,
    Map,
    Set,
    Array,
    String,
  });

  const forkImage = { id: "img-1", path: "/tmp/combine.png", img: {}, imgLoading: true };
  const forkDraft = { id: "draft-1", path: "/tmp/draft.png", img: {}, imgLoading: true };
  const forkedSession = {
    images: [forkImage],
    imagesById: new Map([["img-1", forkImage]]),
    motherIdle: {
      drafts: [forkDraft],
    },
  };
  const sourceSession = {
    images: [
      {
        id: "img-1",
        path: "/tmp/combine.png",
        img: { complete: false, naturalWidth: 0, naturalHeight: 0 },
      },
    ],
    motherIdle: {
      drafts: [
        {
          id: "draft-1",
          path: "/tmp/draft.png",
          img: { complete: false, naturalWidth: 0, naturalHeight: 0 },
        },
      ],
    },
  };

  rehydrateForkedTabSessionImageRuntime(forkedSession, sourceSession);

  assert.equal(forkImage.img, null);
  assert.equal(forkImage.imgLoading, false);
  assert.equal(forkDraft.img, null);
  assert.equal(forkDraft.imgLoading, false);
});

test("forked single-image render requests a reload when the cloned session only has persisted image metadata", () => {
  const renderSource = extractFunctionSource("render", rendererSource);
  assert.match(
    renderSource,
    /if \(state\.canvasMode === "multi"\) \{[\s\S]*\} else \{[\s\S]*if \(item\?\.path\) ensureCanvasImageLoaded\(item\);[\s\S]*const img = readSessionRuntimeImageHandle\(item\);/
  );
  assert.match(app, /function createForkedTabSession\(session = null,\s*\{ label = null \} = \{\}\) \{[\s\S]*rehydrateForkedTabSessionImageRuntime\(next,\s*source\);/);
});
