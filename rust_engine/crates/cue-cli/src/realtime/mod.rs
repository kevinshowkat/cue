pub mod config;
pub mod errors;
pub mod retry;
pub mod sessions;
pub mod transport;

pub use config::{
    normalize_realtime_model_name, resolve_realtime_gemini_model_for_transport,
    CredentialAvailability, RealtimeEnv, RealtimeProvider, RealtimeSessionConfig,
};
pub use errors::{
    error_chain_message, is_anyhow_realtime_transport_error, is_reqwest_realtime_transport_error,
    is_transport_io_error_kind, is_tungstenite_transport_error, RealtimeError, RealtimeErrorKind,
};
pub use retry::RealtimeRetryPolicy;
pub use sessions::{
    RealtimeCommand, RealtimeSessionDescriptor, RealtimeSessionKind, RealtimeSnapshotJob,
};
pub use transport::{
    build_realtime_websocket_request, openai_realtime_ws_url, OpenAiRealtimeWebSocketRequest,
    REALTIME_BETA_HEADER_VALUE,
};
