use std::time::Duration;

use super::config::RealtimeEnv;

pub const REALTIME_TRANSPORT_RETRY_MAX_DEFAULT: usize = 2;
pub const REALTIME_TRANSPORT_RETRY_BACKOFF_MS_DEFAULT: u64 = 350;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RealtimeRetryPolicy {
    pub max_retries: usize,
    pub base_backoff_ms: u64,
}

impl Default for RealtimeRetryPolicy {
    fn default() -> Self {
        Self {
            max_retries: REALTIME_TRANSPORT_RETRY_MAX_DEFAULT,
            base_backoff_ms: REALTIME_TRANSPORT_RETRY_BACKOFF_MS_DEFAULT,
        }
    }
}

impl RealtimeRetryPolicy {
    pub fn from_env(env: &RealtimeEnv) -> Self {
        let max_retries = env
            .parse_usize("CUE_REALTIME_TRANSPORT_RETRIES")
            .map(|value| value.min(6))
            .unwrap_or(REALTIME_TRANSPORT_RETRY_MAX_DEFAULT);
        let base_backoff_ms = env
            .parse_u64("CUE_REALTIME_TRANSPORT_RETRY_BACKOFF_MS")
            .map(|value| value.clamp(50, 5000))
            .unwrap_or(REALTIME_TRANSPORT_RETRY_BACKOFF_MS_DEFAULT);
        Self {
            max_retries,
            base_backoff_ms,
        }
    }

    pub fn backoff_for_attempt(self, attempt: usize) -> Duration {
        let multiplier = u64::try_from(attempt.max(1)).unwrap_or(u64::MAX);
        Duration::from_millis(self.base_backoff_ms.saturating_mul(multiplier))
    }
}
