#![allow(dead_code)]

use std::path::Path;

use anyhow::Result;
use serde_json::{Map, Value};

use crate::lib_impl::MotherGenerateRequest;

pub(crate) fn mother_generate_request_from_payload(
    payload: &Map<String, Value>,
    quality_preset: &str,
    target_provider: Option<&str>,
) -> Result<MotherGenerateRequest> {
    crate::lib_impl::mother_generate_request_from_payload(payload, quality_preset, target_provider)
}

pub(crate) fn run_native_recreate_loop(
    engine: &mut cue_engine::NativeEngine,
    reference_path: &Path,
    quality_preset: &str,
    images_per_iteration: u64,
) -> Result<Map<String, Value>> {
    crate::lib_impl::run_native_recreate_loop(
        engine,
        reference_path,
        quality_preset,
        images_per_iteration,
    )
}

pub(crate) fn infer_recreate_prompt(reference_path: &Path) -> (String, String, Option<String>) {
    crate::lib_impl::infer_recreate_prompt(reference_path)
}

pub(crate) fn infer_prompt_from_receipts(
    reference_path: &Path,
) -> Option<(String, Option<String>)> {
    crate::lib_impl::infer_prompt_from_receipts(reference_path)
}

pub(crate) fn compare_similarity(reference: &Path, candidate: &Path) -> Result<Map<String, Value>> {
    crate::lib_impl::compare_similarity(reference, candidate)
}

pub(crate) fn write_similarity_to_receipt(
    receipt_path: &Path,
    similarity: &Map<String, Value>,
) -> Result<()> {
    crate::lib_impl::write_similarity_to_receipt(receipt_path, similarity)
}
