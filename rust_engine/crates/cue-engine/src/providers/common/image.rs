pub fn normalize_output_extension(output_format: &str) -> &'static str {
    crate::normalize_output_extension(output_format)
}

pub fn parse_dims(size: &str) -> (u32, u32) {
    crate::parse_dims(size)
}
