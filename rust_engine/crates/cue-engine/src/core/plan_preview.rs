use anyhow::Result;
use serde_json::{Map, Value};

use crate::{NativeEngine, PlanPreview};

pub(crate) fn preview_plan(
    engine: &mut NativeEngine,
    prompt: &str,
    settings: &Map<String, Value>,
    intent: &Map<String, Value>,
) -> Result<PlanPreview> {
    engine.preview_plan_core_impl(prompt, settings, intent)
}
