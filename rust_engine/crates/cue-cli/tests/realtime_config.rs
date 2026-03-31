#![allow(dead_code, unused_imports)]

#[path = "../src/realtime/mod.rs"]
mod realtime;

use realtime::{
    resolve_realtime_gemini_model_for_transport, CredentialAvailability, RealtimeEnv,
    RealtimeProvider, RealtimeSessionConfig, RealtimeSessionKind,
};

#[test]
fn realtime_provider_parse_accepts_openai_and_gemini_aliases() {
    assert_eq!(
        RealtimeProvider::parse("openai_realtime"),
        Some(RealtimeProvider::OpenAiRealtime)
    );
    assert_eq!(
        RealtimeProvider::parse("OPENAI"),
        Some(RealtimeProvider::OpenAiRealtime)
    );
    assert_eq!(
        RealtimeProvider::parse("gemini_flash"),
        Some(RealtimeProvider::GeminiFlash)
    );
    assert_eq!(
        RealtimeProvider::parse("GEMINI"),
        Some(RealtimeProvider::GeminiFlash)
    );
    assert_eq!(RealtimeProvider::parse("unknown"), None);
}

#[test]
fn realtime_canvas_config_prefers_explicit_provider_and_normalizes_model() {
    let env = RealtimeEnv::from_pairs([
        ("CUE_REALTIME_PROVIDER", "gemini_flash"),
        ("CUE_CANVAS_CONTEXT_REALTIME_PROVIDER", "openai"),
        ("CUE_CANVAS_CONTEXT_REALTIME_MODEL", "realtime-gpt"),
        ("CUE_CANVAS_CONTEXT_REALTIME_DISABLED", "1"),
    ]);
    let credentials = CredentialAvailability {
        openai_api_key: false,
        openrouter_api_key: true,
        gemini_api_key: true,
    };

    let config =
        RealtimeSessionConfig::resolve(RealtimeSessionKind::CanvasContext, &env, credentials);

    assert_eq!(config.provider, RealtimeProvider::OpenAiRealtime);
    assert_eq!(config.model, "gpt-realtime");
    assert!(config.disabled);
    assert_eq!(config.reference_image_limit, 2);
}

#[test]
fn realtime_config_reads_legacy_brood_keys_during_compat_window() {
    let env = RealtimeEnv::from_pairs([
        ("BROOD_INTENT_REALTIME_PROVIDER", "gemini_flash"),
        ("BROOD_INTENT_REALTIME_MODEL", "models/gemini-2.0-flash"),
        ("BROOD_INTENT_REALTIME_REFERENCE_LIMIT", "99"),
    ]);
    let credentials = CredentialAvailability::default();

    let config = RealtimeSessionConfig::resolve(
        RealtimeSessionKind::IntentIcons { mother: false },
        &env,
        credentials,
    );

    assert_eq!(config.provider, RealtimeProvider::GeminiFlash);
    assert_eq!(config.model, "models/gemini-2.0-flash");
    assert_eq!(config.reference_image_limit, 8);
}

#[test]
fn realtime_default_provider_uses_available_credentials() {
    let env = RealtimeEnv::new();
    let credentials = CredentialAvailability {
        openai_api_key: false,
        openrouter_api_key: true,
        gemini_api_key: false,
    };

    let config = RealtimeSessionConfig::resolve(
        RealtimeSessionKind::IntentIcons { mother: false },
        &env,
        credentials,
    );

    assert_eq!(config.provider, RealtimeProvider::GeminiFlash);
    assert_eq!(config.model, "gemini-3-flash-preview");
}

#[test]
fn realtime_gemini_transport_model_resolution_accepts_gemini_and_rejects_non_gemini() {
    let via_openrouter = resolve_realtime_gemini_model_for_transport("gemini-3.0-flash", true)
        .expect("gemini alias should normalize");
    assert_eq!(via_openrouter, "google/gemini-3-flash-preview");

    let direct = resolve_realtime_gemini_model_for_transport("models/gemini-2.0-flash", false)
        .expect("gemini direct alias should normalize");
    assert_eq!(direct, "gemini-2.0-flash-001");

    let err = resolve_realtime_gemini_model_for_transport("openai/gpt-5.2", true)
        .expect_err("non-gemini model should be rejected");
    assert!(err.contains("requires a Gemini model"));
}
