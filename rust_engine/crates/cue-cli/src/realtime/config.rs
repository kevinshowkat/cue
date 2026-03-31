use std::collections::BTreeMap;

use super::sessions::RealtimeSessionKind;

pub const REALTIME_INTENT_REFERENCE_IMAGE_LIMIT_DEFAULT: usize = 4;
pub const REALTIME_INTENT_REFERENCE_IMAGE_LIMIT_MAX: usize = 8;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RealtimeProvider {
    OpenAiRealtime,
    GeminiFlash,
}

impl RealtimeProvider {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::OpenAiRealtime => "openai_realtime",
            Self::GeminiFlash => "gemini_flash",
        }
    }

    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "openai" | "openai_realtime" => Some(Self::OpenAiRealtime),
            "gemini" | "gemini_flash" => Some(Self::GeminiFlash),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct CredentialAvailability {
    pub openai_api_key: bool,
    pub openrouter_api_key: bool,
    pub gemini_api_key: bool,
}

impl CredentialAvailability {
    pub fn from_env(env: &RealtimeEnv) -> Self {
        Self {
            openai_api_key: env.has_any_non_empty(&["OPENAI_API_KEY", "OPENAI_API_KEY_BACKUP"]),
            openrouter_api_key: env.has_any_non_empty(&["OPENROUTER_API_KEY"]),
            gemini_api_key: env.has_any_non_empty(&["GEMINI_API_KEY", "GOOGLE_API_KEY"]),
        }
    }

    pub fn infer_default_provider(self) -> RealtimeProvider {
        if self.openai_api_key {
            return RealtimeProvider::OpenAiRealtime;
        }
        if self.openrouter_api_key || self.gemini_api_key {
            return RealtimeProvider::GeminiFlash;
        }
        RealtimeProvider::OpenAiRealtime
    }
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct RealtimeEnv {
    vars: BTreeMap<String, String>,
}

impl RealtimeEnv {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn from_current() -> Self {
        Self::from_pairs(std::env::vars())
    }

    pub fn from_pairs<I, K, V>(pairs: I) -> Self
    where
        I: IntoIterator<Item = (K, V)>,
        K: Into<String>,
        V: Into<String>,
    {
        let vars = pairs
            .into_iter()
            .map(|(key, value)| (key.into(), value.into()))
            .collect::<BTreeMap<_, _>>();
        Self { vars }
    }

    pub fn get(&self, key: &str) -> Option<&str> {
        self.vars.get(key).map(String::as_str)
    }

    pub fn get_compat(&self, key: &str) -> Option<&str> {
        self.get(key).or_else(|| {
            key.strip_prefix("CUE_")
                .and_then(|rest| self.get(&format!("BROOD_{rest}")))
        })
    }

    pub fn has_any_non_empty(&self, keys: &[&str]) -> bool {
        keys.iter().any(|key| {
            self.get_compat(key)
                .map(str::trim)
                .is_some_and(|value| !value.is_empty())
        })
    }

    pub fn is_enabled(&self, key: &str) -> bool {
        self.get_compat(key)
            .map(str::trim)
            .is_some_and(|value| value == "1")
    }

    pub fn parse_usize(&self, key: &str) -> Option<usize> {
        self.get_compat(key)
            .map(str::trim)
            .and_then(|value| value.parse::<usize>().ok())
    }

    pub fn parse_u64(&self, key: &str) -> Option<u64> {
        self.get_compat(key)
            .map(str::trim)
            .and_then(|value| value.parse::<u64>().ok())
    }

    pub fn first_non_empty(&self, keys: &[&str]) -> Option<String> {
        keys.iter().find_map(|key| {
            self.get_compat(key)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
        })
    }

    pub fn first_provider(&self, keys: &[&str]) -> Option<RealtimeProvider> {
        keys.iter()
            .find_map(|key| self.get_compat(key).and_then(RealtimeProvider::parse))
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RealtimeSessionConfig {
    pub kind: RealtimeSessionKind,
    pub provider: RealtimeProvider,
    pub model: String,
    pub disabled: bool,
    pub reference_image_limit: usize,
}

impl RealtimeSessionConfig {
    pub fn resolve(
        kind: RealtimeSessionKind,
        env: &RealtimeEnv,
        credentials: CredentialAvailability,
    ) -> Self {
        let provider = env
            .first_provider(kind.provider_env_keys())
            .unwrap_or_else(|| credentials.infer_default_provider());
        let default_model = default_realtime_model(provider, kind.is_mother_intent());
        let model = env
            .first_non_empty(kind.model_env_keys(provider))
            .map(|value| normalize_realtime_model_name(&value, default_model))
            .unwrap_or_else(|| default_model.to_string());
        let disabled = env.is_enabled(kind.disabled_env_key());
        let reference_image_limit = match kind {
            RealtimeSessionKind::CanvasContext => 2,
            RealtimeSessionKind::IntentIcons { .. } => env
                .parse_usize("CUE_INTENT_REALTIME_REFERENCE_LIMIT")
                .map(|value| value.clamp(1, REALTIME_INTENT_REFERENCE_IMAGE_LIMIT_MAX))
                .unwrap_or(REALTIME_INTENT_REFERENCE_IMAGE_LIMIT_DEFAULT),
        };

        Self {
            kind,
            provider,
            model,
            disabled,
            reference_image_limit,
        }
    }

    pub fn from_current_env(kind: RealtimeSessionKind) -> Self {
        let env = RealtimeEnv::from_current();
        let credentials = CredentialAvailability::from_env(&env);
        Self::resolve(kind, &env, credentials)
    }
}

pub fn normalize_realtime_model_name(raw: &str, default: &str) -> String {
    let model = raw.trim();
    if model.is_empty() {
        return default.to_string();
    }
    if model == "realtime-gpt" {
        "gpt-realtime".to_string()
    } else {
        model.to_string()
    }
}

pub fn default_realtime_model(provider: RealtimeProvider, _mother: bool) -> &'static str {
    match provider {
        RealtimeProvider::OpenAiRealtime => "gpt-realtime-mini",
        RealtimeProvider::GeminiFlash => "gemini-3-flash-preview",
    }
}

pub fn resolve_realtime_gemini_model_for_transport(
    raw: &str,
    via_openrouter: bool,
) -> Result<String, String> {
    let resolved = if via_openrouter {
        sanitize_openrouter_gemini_model(raw, "google/gemini-3-flash-preview")
    } else {
        sanitize_gemini_generate_content_model(raw, "gemini-3-flash-preview")
    };
    let normalized = resolved
        .strip_prefix("google/")
        .unwrap_or(&resolved)
        .trim()
        .to_ascii_lowercase();
    if normalized.starts_with("gemini-") {
        return Ok(resolved);
    }
    Err(format!(
        "Realtime provider gemini_flash requires a Gemini model. Got '{}'. Set CUE_CANVAS_CONTEXT_REALTIME_MODEL / CUE_INTENT_REALTIME_MODEL / CUE_MOTHER_INTENT_REALTIME_MODEL to a Gemini Flash model.",
        raw.trim()
    ))
}

fn sanitize_gemini_generate_content_model(raw: &str, default_model: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return default_model.to_string();
    }

    let mut cleaned = trimmed
        .strip_prefix("models/")
        .unwrap_or(trimmed)
        .trim()
        .to_string();
    if let Some(stripped) = cleaned.strip_prefix("google/") {
        cleaned = stripped.trim().to_string();
    }
    if cleaned.is_empty() {
        return default_model.to_string();
    }

    match cleaned.to_ascii_lowercase().as_str() {
        "gemini-3.0-flash" | "gemini-3-flash" => "gemini-3-flash-preview".to_string(),
        "gemini-3.0-pro" | "gemini-3-pro" => "gemini-3-pro-preview".to_string(),
        "gemini-2.0-flash" => "gemini-2.0-flash-001".to_string(),
        "gemini-2.0-flash-lite" => "gemini-2.0-flash-lite-001".to_string(),
        _ => cleaned,
    }
}

fn sanitize_openrouter_gemini_model(raw: &str, default_model: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return default_model.to_string();
    }
    let source = trimmed
        .strip_prefix("google/")
        .map(str::trim)
        .unwrap_or(trimmed);
    let cleaned = sanitize_gemini_generate_content_model(source, "gemini-3-flash-preview");
    let lowered = cleaned.to_ascii_lowercase();
    if cleaned.starts_with("google/") {
        cleaned
    } else if lowered.starts_with("gemini-") {
        format!("google/{cleaned}")
    } else {
        trimmed.to_string()
    }
}
