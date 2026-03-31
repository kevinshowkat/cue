use anyhow::Result;
use serde_json::{Map, Value};

use crate::NativeEngine;

pub(crate) fn generate(
    engine: &mut NativeEngine,
    prompt: &str,
    settings: Map<String, Value>,
    intent: Map<String, Value>,
) -> Result<Vec<Map<String, Value>>> {
    engine.generate_core_impl(prompt, settings, intent)
}

pub(crate) fn finish(engine: &mut NativeEngine) -> Result<()> {
    engine.finish_core_impl()
}
