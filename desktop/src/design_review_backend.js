import { invoke } from "@tauri-apps/api/tauri";

import { DESIGN_REVIEW_PROVIDER_COMMAND } from "./design_review_contract.js";

export function invokeDesignReviewProviderRequest(request = {}) {
  return invoke(DESIGN_REVIEW_PROVIDER_COMMAND, { request });
}
