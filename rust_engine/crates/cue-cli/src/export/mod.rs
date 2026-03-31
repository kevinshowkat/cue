use std::path::Path;

use anyhow::Result;

pub(crate) fn export_html_native(run_dir: &Path, out_path: &Path) -> Result<()> {
    crate::lib_impl::export_html_native(run_dir, out_path)
}

pub(crate) fn escape_html(value: &str) -> String {
    crate::lib_impl::escape_html(value)
}
