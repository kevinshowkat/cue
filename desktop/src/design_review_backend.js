import { invoke } from "@tauri-apps/api/tauri";

export function invokeDesignReviewProviderRequest(request = {}) {
  return invoke("run_design_review_provider_request", { request });
}
