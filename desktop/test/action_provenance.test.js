import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ACTION_PROVENANCE,
  actionProvenanceHasModelCost,
  appendActionProvenanceDescription,
  describeActionProvenance,
  normalizeActionProvenance,
  renderActionProvenanceBadge,
  resolveActionProvenance,
} from "../src/action_provenance.js";

test("action provenance normalizes and resolves local, hybrid, and external execution classes", () => {
  assert.equal(normalizeActionProvenance("local_only"), ACTION_PROVENANCE.LOCAL_ONLY);
  assert.equal(
    resolveActionProvenance({
      executionType: "local_first",
      executionKind: "model_capability",
    }),
    ACTION_PROVENANCE.LOCAL_FIRST
  );
  assert.equal(
    resolveActionProvenance({
      executionKind: "local_edit",
    }),
    ACTION_PROVENANCE.LOCAL_ONLY
  );
  assert.equal(
    resolveActionProvenance({
      capability: "background_replace",
    }),
    ACTION_PROVENANCE.EXTERNAL_MODEL
  );
});

test("action provenance descriptions stay compact and model-backed actions no longer emit inline dot markup", () => {
  assert.equal(describeActionProvenance(ACTION_PROVENANCE.LOCAL_ONLY), "Runs locally only.");
  assert.equal(
    appendActionProvenanceDescription("Design Review", ACTION_PROVENANCE.EXTERNAL_MODEL),
    "Design Review. Uses an external model call."
  );
  assert.equal(actionProvenanceHasModelCost(ACTION_PROVENANCE.LOCAL_ONLY), false);
  assert.equal(actionProvenanceHasModelCost(ACTION_PROVENANCE.LOCAL_FIRST), true);
  assert.equal(renderActionProvenanceBadge(ACTION_PROVENANCE.LOCAL_ONLY), "");
  assert.equal(renderActionProvenanceBadge(ACTION_PROVENANCE.LOCAL_FIRST), "");
  assert.equal(renderActionProvenanceBadge(ACTION_PROVENANCE.EXTERNAL_MODEL), "");
});
