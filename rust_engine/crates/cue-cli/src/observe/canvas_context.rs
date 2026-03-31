use std::path::Path;

use crate::TextVisionInference;

pub(crate) fn vision_infer_canvas_context(
    path: &Path,
    requested_model: Option<String>,
) -> Option<TextVisionInference> {
    crate::vision_infer_canvas_context(path, requested_model)
}
