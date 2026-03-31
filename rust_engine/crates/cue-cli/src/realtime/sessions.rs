use std::path::{Path, PathBuf};

use super::config::{CredentialAvailability, RealtimeEnv, RealtimeProvider, RealtimeSessionConfig};

const CANVAS_PROVIDER_ENV_KEYS: [&str; 2] = [
    "CUE_CANVAS_CONTEXT_REALTIME_PROVIDER",
    "CUE_REALTIME_PROVIDER",
];
const INTENT_PROVIDER_ENV_KEYS: [&str; 2] =
    ["CUE_INTENT_REALTIME_PROVIDER", "CUE_REALTIME_PROVIDER"];
const MOTHER_INTENT_PROVIDER_ENV_KEYS: [&str; 3] = [
    "CUE_MOTHER_INTENT_REALTIME_PROVIDER",
    "CUE_INTENT_REALTIME_PROVIDER",
    "CUE_REALTIME_PROVIDER",
];

const CANVAS_MODEL_ENV_KEYS: [&str; 2] = [
    "CUE_CANVAS_CONTEXT_REALTIME_MODEL",
    "OPENAI_CANVAS_CONTEXT_REALTIME_MODEL",
];
const CANVAS_MODEL_ENV_KEYS_NON_OPENAI: [&str; 1] = ["CUE_CANVAS_CONTEXT_REALTIME_MODEL"];
const INTENT_MODEL_ENV_KEYS_OPENAI: [&str; 2] =
    ["CUE_INTENT_REALTIME_MODEL", "OPENAI_INTENT_REALTIME_MODEL"];
const INTENT_MODEL_ENV_KEYS_NON_OPENAI: [&str; 1] = ["CUE_INTENT_REALTIME_MODEL"];
const MOTHER_INTENT_MODEL_ENV_KEYS_OPENAI: [&str; 3] = [
    "CUE_MOTHER_INTENT_REALTIME_MODEL",
    "CUE_INTENT_REALTIME_MODEL",
    "OPENAI_INTENT_REALTIME_MODEL",
];
const MOTHER_INTENT_MODEL_ENV_KEYS_NON_OPENAI: [&str; 2] = [
    "CUE_MOTHER_INTENT_REALTIME_MODEL",
    "CUE_INTENT_REALTIME_MODEL",
];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RealtimeSessionKind {
    CanvasContext,
    IntentIcons { mother: bool },
}

impl RealtimeSessionKind {
    pub fn descriptor(self) -> RealtimeSessionDescriptor {
        match self {
            Self::CanvasContext => RealtimeSessionDescriptor {
                kind: self,
                event_type: "canvas_context",
                failed_event_type: "canvas_context_failed",
                provider_env_key: "CUE_CANVAS_CONTEXT_REALTIME_PROVIDER",
                disabled_env_key: "CUE_CANVAS_CONTEXT_REALTIME_DISABLED",
                disabled_message:
                    "Realtime canvas context is disabled (CUE_CANVAS_CONTEXT_REALTIME_DISABLED=1).",
                thread_name: "cue-aov-realtime",
                timeout_message: "Realtime canvas context timed out.",
                temperature: 0.6,
                max_output_tokens: 520,
            },
            Self::IntentIcons { mother: false } => RealtimeSessionDescriptor {
                kind: self,
                event_type: "intent_icons",
                failed_event_type: "intent_icons_failed",
                provider_env_key: "CUE_INTENT_REALTIME_PROVIDER",
                disabled_env_key: "CUE_INTENT_REALTIME_DISABLED",
                disabled_message:
                    "Realtime intent inference is disabled (CUE_INTENT_REALTIME_DISABLED=1).",
                thread_name: "cue-intent-realtime",
                timeout_message: "Realtime intent inference timed out.",
                temperature: 0.6,
                max_output_tokens: 2200,
            },
            Self::IntentIcons { mother: true } => RealtimeSessionDescriptor {
                kind: self,
                event_type: "intent_icons",
                failed_event_type: "intent_icons_failed",
                provider_env_key: "CUE_MOTHER_INTENT_REALTIME_PROVIDER",
                disabled_env_key: "CUE_INTENT_REALTIME_DISABLED",
                disabled_message:
                    "Realtime intent inference is disabled (CUE_INTENT_REALTIME_DISABLED=1).",
                thread_name: "cue-intent-realtime-mother",
                timeout_message: "Realtime intent inference timed out.",
                temperature: 0.6,
                max_output_tokens: 2200,
            },
        }
    }

    pub fn provider_env_keys(self) -> &'static [&'static str] {
        match self {
            Self::CanvasContext => &CANVAS_PROVIDER_ENV_KEYS,
            Self::IntentIcons { mother: false } => &INTENT_PROVIDER_ENV_KEYS,
            Self::IntentIcons { mother: true } => &MOTHER_INTENT_PROVIDER_ENV_KEYS,
        }
    }

    pub fn model_env_keys(self, provider: RealtimeProvider) -> &'static [&'static str] {
        match (self, provider) {
            (Self::CanvasContext, RealtimeProvider::OpenAiRealtime) => &CANVAS_MODEL_ENV_KEYS,
            (Self::CanvasContext, _) => &CANVAS_MODEL_ENV_KEYS_NON_OPENAI,
            (Self::IntentIcons { mother: false }, RealtimeProvider::OpenAiRealtime) => {
                &INTENT_MODEL_ENV_KEYS_OPENAI
            }
            (Self::IntentIcons { mother: false }, _) => &INTENT_MODEL_ENV_KEYS_NON_OPENAI,
            (Self::IntentIcons { mother: true }, RealtimeProvider::OpenAiRealtime) => {
                &MOTHER_INTENT_MODEL_ENV_KEYS_OPENAI
            }
            (Self::IntentIcons { mother: true }, _) => &MOTHER_INTENT_MODEL_ENV_KEYS_NON_OPENAI,
        }
    }

    pub fn disabled_env_key(self) -> &'static str {
        self.descriptor().disabled_env_key
    }

    pub fn provider_env_key(self) -> &'static str {
        self.descriptor().provider_env_key
    }

    pub fn event_type(self) -> &'static str {
        self.descriptor().event_type
    }

    pub fn failed_event_type(self) -> &'static str {
        self.descriptor().failed_event_type
    }

    pub fn disabled_message(self) -> &'static str {
        self.descriptor().disabled_message
    }

    pub fn thread_name(self) -> &'static str {
        self.descriptor().thread_name
    }

    pub fn timeout_message(self) -> &'static str {
        self.descriptor().timeout_message
    }

    pub fn temperature(self) -> f64 {
        self.descriptor().temperature
    }

    pub fn max_output_tokens(self) -> u64 {
        self.descriptor().max_output_tokens
    }

    pub fn provider(self) -> RealtimeProvider {
        let env = RealtimeEnv::from_current();
        let credentials = CredentialAvailability::from_env(&env);
        RealtimeSessionConfig::resolve(self, &env, credentials).provider
    }

    pub fn is_mother_intent(self) -> bool {
        matches!(self, Self::IntentIcons { mother: true })
    }

    pub fn select_job(self, jobs: &[RealtimeSnapshotJob]) -> Option<RealtimeSnapshotJob> {
        if jobs.is_empty() {
            return None;
        }
        match self {
            Self::IntentIcons { .. } => jobs
                .iter()
                .rfind(|job| is_mother_intent_snapshot_path(&job.image_path))
                .cloned()
                .or_else(|| jobs.last().cloned()),
            Self::CanvasContext => jobs.last().cloned(),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct RealtimeSessionDescriptor {
    pub kind: RealtimeSessionKind,
    pub event_type: &'static str,
    pub failed_event_type: &'static str,
    pub provider_env_key: &'static str,
    pub disabled_env_key: &'static str,
    pub disabled_message: &'static str,
    pub thread_name: &'static str,
    pub timeout_message: &'static str,
    pub temperature: f64,
    pub max_output_tokens: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RealtimeSnapshotJob {
    pub image_path: PathBuf,
    pub submitted_at_ms: i64,
}

impl RealtimeSnapshotJob {
    pub fn new(path: impl Into<PathBuf>, submitted_at_ms: i64) -> Self {
        Self {
            image_path: path.into(),
            submitted_at_ms,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RealtimeCommand {
    Snapshot(RealtimeSnapshotJob),
    Stop,
}

fn is_mother_intent_snapshot_path(image_path: &Path) -> bool {
    image_path
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase().starts_with("mother-intent-"))
        .unwrap_or(false)
}
