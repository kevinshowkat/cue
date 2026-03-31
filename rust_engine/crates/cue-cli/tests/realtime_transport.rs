#![allow(dead_code, unused_imports)]

#[path = "../src/realtime/mod.rs"]
mod realtime;

use std::io;
use std::time::Duration;

use realtime::{
    build_realtime_websocket_request, is_anyhow_realtime_transport_error, RealtimeEnv,
    RealtimeError, RealtimeErrorKind, RealtimeRetryPolicy, REALTIME_BETA_HEADER_VALUE,
};

#[test]
fn realtime_ws_request_includes_upgrade_headers() {
    let request = build_realtime_websocket_request(
        "https://api.openai.com/v1",
        "gpt-realtime-mini",
        "test-api-key",
    )
    .unwrap();
    let uri = request.uri().to_string();
    let headers = request.headers();

    assert!(
        uri.contains("/realtime?model=gpt-realtime-mini"),
        "unexpected realtime uri: {uri}"
    );
    assert!(headers.contains_key("sec-websocket-key"));
    assert_eq!(
        headers.get("upgrade").and_then(|v| v.to_str().ok()),
        Some("websocket")
    );
    assert!(headers
        .get("connection")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.to_ascii_lowercase().contains("upgrade"))
        .unwrap_or(false));
    assert_eq!(
        headers.get("authorization").and_then(|v| v.to_str().ok()),
        Some("Bearer test-api-key")
    );
    assert_eq!(
        headers.get("openai-beta").and_then(|v| v.to_str().ok()),
        Some(REALTIME_BETA_HEADER_VALUE)
    );
}

#[test]
fn realtime_retry_policy_applies_defaults_and_clamps() {
    let defaults = RealtimeRetryPolicy::from_env(&RealtimeEnv::new());
    assert_eq!(defaults.max_retries, 2);
    assert_eq!(defaults.base_backoff_ms, 350);
    assert_eq!(defaults.backoff_for_attempt(0), Duration::from_millis(350));

    let env = RealtimeEnv::from_pairs([
        ("CUE_REALTIME_TRANSPORT_RETRIES", "99"),
        ("CUE_REALTIME_TRANSPORT_RETRY_BACKOFF_MS", "10"),
    ]);
    let policy = RealtimeRetryPolicy::from_env(&env);

    assert_eq!(policy.max_retries, 6);
    assert_eq!(policy.base_backoff_ms, 50);
    assert_eq!(policy.backoff_for_attempt(3), Duration::from_millis(150));
}

#[test]
fn realtime_transport_errors_are_classified_as_transport() {
    let broken_pipe = anyhow::Error::new(tungstenite::Error::Io(io::Error::new(
        io::ErrorKind::BrokenPipe,
        "broken pipe",
    )));
    assert!(is_anyhow_realtime_transport_error(&broken_pipe));

    let typed = RealtimeError::from_anyhow(broken_pipe);
    assert_eq!(typed.kind, RealtimeErrorKind::Transport);

    let timeout_message = anyhow::anyhow!("Realtime intent inference timed out.");
    let typed_timeout = RealtimeError::from_anyhow(timeout_message);
    assert_eq!(typed_timeout.kind, RealtimeErrorKind::Terminal);
}
