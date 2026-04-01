import { exists, readTextFile, writeTextFile } from "@tauri-apps/api/fs";

export async function appendTextWithFallback(path, text, { maxBytes = null } = {}) {
  const outPath = String(path || "").trim();
  if (!outPath) throw new Error("appendTextWithFallback requires a valid path");
  const chunk = String(text || "");
  try {
    await writeTextFile(outPath, chunk, { append: true });
    return;
  } catch {
    let prior = "";
    try {
      if (await exists(outPath)) prior = await readTextFile(outPath);
    } catch {
      prior = "";
    }
    let next = `${prior}${chunk}`;
    if (Number.isFinite(maxBytes) && Number(maxBytes) > 0 && next.length > Number(maxBytes)) {
      next = next.slice(next.length - Number(maxBytes));
    }
    await writeTextFile(outPath, next);
  }
}

export function parseJsonlText(text) {
  const raw = typeof text === "string" ? text : "";
  if (!raw) return [];
  const rows = [];
  for (const line of raw.split("\n")) {
    const trimmed = String(line || "").trim();
    if (!trimmed) continue;
    try {
      rows.push(JSON.parse(trimmed));
    } catch {
      // Ignore malformed rows so append-only logs stay readable even when a
      // partial trailing write or manual edit sneaks in.
    }
  }
  return rows;
}

export async function appendJsonlWithFallback(path, payload, options = {}) {
  const line = `${JSON.stringify(payload)}\n`;
  await appendTextWithFallback(path, line, options);
}
