pub fn clamp_retry_count(value: usize, max: usize) -> usize {
    value.min(max)
}

pub fn clamp_retry_backoff_seconds(value: f64, min: f64, max: f64) -> f64 {
    value.clamp(min, max)
}
