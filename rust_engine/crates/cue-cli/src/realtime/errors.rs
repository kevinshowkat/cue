use std::io;

use anyhow::Error;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RealtimeErrorKind {
    Transport,
    Terminal,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RealtimeError {
    pub kind: RealtimeErrorKind,
    pub message: String,
}

impl RealtimeError {
    pub fn transport(message: impl Into<String>) -> Self {
        Self {
            kind: RealtimeErrorKind::Transport,
            message: message.into(),
        }
    }

    pub fn terminal(message: impl Into<String>) -> Self {
        Self {
            kind: RealtimeErrorKind::Terminal,
            message: message.into(),
        }
    }

    pub fn from_anyhow(err: Error) -> Self {
        let message = error_chain_message(&err);
        if is_anyhow_realtime_transport_error(&err) {
            Self::transport(message)
        } else {
            Self::terminal(message)
        }
    }

    pub fn from_tungstenite(prefix: &str, err: tungstenite::Error) -> Self {
        let message = format!("{prefix}: {err}");
        if is_tungstenite_transport_error(&err) {
            Self::transport(message)
        } else {
            Self::terminal(message)
        }
    }

    pub fn is_transport(&self) -> bool {
        self.kind == RealtimeErrorKind::Transport
    }
}

impl std::fmt::Display for RealtimeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for RealtimeError {}

pub fn is_anyhow_realtime_transport_error(err: &Error) -> bool {
    err.chain().any(|cause| {
        cause
            .downcast_ref::<tungstenite::Error>()
            .map(is_tungstenite_transport_error)
            .unwrap_or(false)
            || cause
                .downcast_ref::<io::Error>()
                .map(|io_err| is_transport_io_error_kind(io_err.kind()))
                .unwrap_or(false)
            || cause
                .downcast_ref::<reqwest::Error>()
                .map(is_reqwest_realtime_transport_error)
                .unwrap_or(false)
    })
}

pub fn is_reqwest_realtime_transport_error(err: &reqwest::Error) -> bool {
    err.is_timeout() || err.is_connect() || err.is_request() || err.is_body()
}

pub fn is_tungstenite_transport_error(err: &tungstenite::Error) -> bool {
    match err {
        tungstenite::Error::ConnectionClosed | tungstenite::Error::AlreadyClosed => true,
        tungstenite::Error::Io(io_err) => is_transport_io_error_kind(io_err.kind()),
        tungstenite::Error::Tls(_) => true,
        _ => false,
    }
}

pub fn is_transport_io_error_kind(kind: io::ErrorKind) -> bool {
    matches!(
        kind,
        io::ErrorKind::WouldBlock
            | io::ErrorKind::TimedOut
            | io::ErrorKind::ConnectionReset
            | io::ErrorKind::ConnectionAborted
            | io::ErrorKind::BrokenPipe
            | io::ErrorKind::UnexpectedEof
            | io::ErrorKind::NotConnected
    )
}

pub fn error_chain_message(err: &Error) -> String {
    err.chain()
        .map(|entry| entry.to_string())
        .filter(|entry| !entry.trim().is_empty())
        .collect::<Vec<String>>()
        .join(": ")
}
