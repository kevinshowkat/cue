use std::path::Path;

use crate::lib_impl::DescriptionVisionInference;

pub(crate) fn vision_infer_description(
    path: &Path,
    max_chars: usize,
) -> Option<DescriptionVisionInference> {
    crate::lib_impl::vision_infer_description(path, max_chars)
}
