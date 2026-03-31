#![allow(dead_code)]

use std::path::Path;

pub(crate) fn prepare_vision_image(
    path: &Path,
    max_edge: u32,
) -> Option<(Vec<u8>, String)> {
    crate::prepare_vision_image(path, max_edge)
}

pub(crate) fn prepare_vision_image_data_url(path: &Path, max_edge: u32) -> Option<String> {
    crate::prepare_vision_image_data_url(path, max_edge)
}
