use std::path::Path;

use crate::DescriptionVisionInference;

pub(crate) fn vision_infer_description(
    path: &Path,
    max_chars: usize,
) -> Option<DescriptionVisionInference> {
    crate::vision_infer_description(path, max_chars)
}
