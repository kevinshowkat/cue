use std::path::Path;

use crate::lib_impl::TextVisionInference;

pub(crate) fn vision_infer_canvas_context(
    path: &Path,
    requested_model: Option<String>,
) -> Option<TextVisionInference> {
    crate::lib_impl::vision_infer_canvas_context(path, requested_model)
}
