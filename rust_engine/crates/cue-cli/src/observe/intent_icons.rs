#![allow(dead_code)]

use std::path::Path;

use serde_json::{Map, Value};

use crate::IntentIconsVisionInference;

pub(crate) fn intent_icons_instruction(mother: bool) -> String {
    crate::intent_icons_instruction(mother)
}

pub(crate) fn normalize_intent_icons_payload(
    payload: Map<String, Value>,
    frame_id: &str,
) -> Map<String, Value> {
    crate::normalize_intent_icons_payload(payload, frame_id)
}

pub(crate) fn vision_infer_intent_icons_payload(
    path: &Path,
    mother: bool,
    model_hint: &str,
) -> Option<IntentIconsVisionInference> {
    crate::vision_infer_intent_icons_payload(path, mother, model_hint)
}
