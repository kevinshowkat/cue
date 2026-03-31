use std::path::Path;

use anyhow::Result;

pub(crate) fn export_html_native(run_dir: &Path, out_path: &Path) -> Result<()> {
    crate::export_html_native(run_dir, out_path)
}

pub(crate) fn escape_html(value: &str) -> String {
    crate::escape_html(value)
}
