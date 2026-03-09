#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#![allow(unexpected_cfgs)]

use base64::engine::general_purpose::{STANDARD as BASE64_STANDARD, URL_SAFE_NO_PAD};
use base64::Engine as _;
#[cfg(target_os = "macos")]
use cocoa::appkit::{
    NSView, NSViewHeightSizable, NSViewWidthSizable, NSWindow, NSWindowOrderingMode,
    NSWindowTitleVisibility, NSWindowToolbarStyle,
};
#[cfg(target_os = "macos")]
use cocoa::base::{id, nil, BOOL, NO, YES};
#[cfg(target_os = "macos")]
use cocoa::foundation::NSString;
#[cfg(target_os = "macos")]
use objc::{class, msg_send, sel, sel_impl};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use rand::rngs::OsRng;
use rand::RngCore;
use reqwest::blocking::Client;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
#[cfg(target_family = "unix")]
use std::io::{BufRead, BufReader};
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::TcpListener;
use std::net::TcpStream;
#[cfg(target_family = "unix")]
use std::os::unix::fs::PermissionsExt;
#[cfg(target_family = "unix")]
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::{Path, PathBuf};
use std::process;
use std::sync::mpsc;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{CustomMenuItem, Manager, Menu, MenuItem, State, Submenu};
use tungstenite::client::IntoClientRequest;
use tungstenite::stream::MaybeTlsStream;
use tungstenite::{connect, Message, WebSocket};
use url::Url;

const MENU_CANVAS_IMPORT: &str = "canvas_import_photos";
const MENU_CANVAS_EXPORT_PSD: &str = "canvas_export_psd";
const MENU_CANVAS_SETTINGS: &str = "canvas_settings";
const NATIVE_MENU_ACTION_EVENT: &str = "native-menu-action";
const DESIGN_REVIEW_PLANNER_MODEL: &str = "gpt-5.4";
const DESIGN_REVIEW_OPENROUTER_PLANNER_MODEL: &str = "openai/gpt-5.4";

fn build_app_menu(app_name: &str) -> Menu {
    let import = CustomMenuItem::new(MENU_CANVAS_IMPORT.to_string(), "Import Photos")
        .accelerator("CmdOrCtrl+O");
    let export_psd = CustomMenuItem::new(MENU_CANVAS_EXPORT_PSD.to_string(), "Export PSD")
        .accelerator("CmdOrCtrl+Shift+E");
    let settings = CustomMenuItem::new(MENU_CANVAS_SETTINGS.to_string(), "Settings…")
        .accelerator("CmdOrCtrl+,");

    let canvas_menu = Menu::new()
        .add_item(import)
        .add_item(export_psd)
        .add_native_item(MenuItem::Separator)
        .add_item(settings);

    Menu::os_default(app_name).add_submenu(Submenu::new("Canvas", canvas_menu))
}

fn emit_native_menu_action(window: &tauri::Window, action: &str) {
    let payload = serde_json::json!({ "action": action });
    let _ = window.emit(NATIVE_MENU_ACTION_EVENT, payload);
}

fn find_repo_root(start: &Path) -> Option<PathBuf> {
    let mut current = Some(start);
    while let Some(dir) = current {
        if dir.join("rust_engine").is_dir() && dir.join("desktop").is_dir() {
            return Some(dir.to_path_buf());
        }
        current = dir.parent();
    }
    None
}

fn find_repo_root_best_effort() -> Option<PathBuf> {
    // Explicit override wins (useful for packaged apps).
    if let Ok(root) = std::env::var("BROOD_REPO_ROOT") {
        let path = PathBuf::from(root);
        if let Some(repo_root) = find_repo_root(&path) {
            return Some(repo_root);
        }
    }

    // Usual dev path: run from somewhere under the repo.
    if let Ok(current_dir) = std::env::current_dir() {
        if let Some(repo_root) = find_repo_root(&current_dir) {
            return Some(repo_root);
        }
    }

    // When launched from Finder, current_dir may be `/`; fall back to the executable's location.
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            if let Some(repo_root) = find_repo_root(parent) {
                return Some(repo_root);
            }
        }
    }

    // Some shells provide PWD even when current_dir is surprising.
    if let Ok(pwd) = std::env::var("PWD") {
        let path = PathBuf::from(pwd);
        if let Some(repo_root) = find_repo_root(&path) {
            return Some(repo_root);
        }
    }

    // Cargo sets this in dev; harmless elsewhere.
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let path = PathBuf::from(manifest_dir);
        if let Some(repo_root) = find_repo_root(&path) {
            return Some(repo_root);
        }
    }

    None
}

fn parse_dotenv(path: &Path) -> HashMap<String, String> {
    let content = std::fs::read_to_string(path).unwrap_or_default();
    let mut vars = HashMap::new();
    for raw_line in content.lines() {
        let mut line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(stripped) = line.strip_prefix("export ") {
            line = stripped.trim();
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let key = key.trim();
        if key.is_empty() {
            continue;
        }
        let mut value = value.trim().to_string();
        if value.len() >= 2 {
            let bytes = value.as_bytes();
            if (bytes[0] == b'"' && bytes[bytes.len() - 1] == b'"')
                || (bytes[0] == b'\'' && bytes[bytes.len() - 1] == b'\'')
            {
                value = value[1..value.len() - 1].to_string();
            }
        }
        vars.insert(key.to_string(), value);
    }
    vars
}

fn merge_dotenv_vars(target: &mut HashMap<String, String>, path: &Path) {
    if !path.exists() {
        return;
    }
    let vars = parse_dotenv(path);
    for (key, value) in vars {
        // Preserve existing explicit env vars, but do not let empty placeholders
        // (e.g. `OPENAI_API_KEY=`) block a non-empty value from a later `.env`.
        match target.get(&key) {
            None => {
                target.insert(key, value);
            }
            Some(existing) => {
                if existing.trim().is_empty() && !value.trim().is_empty() {
                    target.insert(key, value);
                }
            }
        }
    }
}

fn format_dotenv_value(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let needs_quotes = trimmed
        .chars()
        .any(|ch| ch.is_whitespace() || matches!(ch, '#' | '"' | '\'' | '`' | '$'));
    if !needs_quotes {
        return trimmed.to_string();
    }
    let escaped = trimmed.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{escaped}\"")
}

fn upsert_dotenv_key(path: &Path, key: &str, value: &str) -> Result<(), String> {
    let formatted = format_dotenv_value(value);
    let mut lines: Vec<String> = if path.exists() {
        std::fs::read_to_string(path)
            .map_err(|e| e.to_string())?
            .lines()
            .map(str::to_string)
            .collect()
    } else {
        Vec::new()
    };

    let mut replaced = false;
    for line in lines.iter_mut() {
        let trimmed = line.trim_start();
        let without_export = trimmed
            .strip_prefix("export ")
            .map(str::trim_start)
            .unwrap_or(trimmed);
        let Some((line_key, _)) = without_export.split_once('=') else {
            continue;
        };
        if line_key.trim() == key {
            *line = format!("{key}={formatted}");
            replaced = true;
        }
    }

    if !replaced {
        if !lines.is_empty()
            && lines
                .last()
                .map(|line| !line.trim().is_empty())
                .unwrap_or(false)
        {
            lines.push(String::new());
        }
        lines.push(format!("{key}={formatted}"));
    }

    let mut rendered = lines.join("\n");
    rendered.push('\n');
    std::fs::write(path, rendered).map_err(|e| e.to_string())
}

fn collect_brood_env_snapshot() -> HashMap<String, String> {
    let mut vars: HashMap<String, String> = std::env::vars().collect();

    // Preferred location for persisted desktop keys/config.
    if let Some(home) = tauri::api::path::home_dir() {
        merge_dotenv_vars(&mut vars, &home.join(".brood").join(".env"));
    }

    // Repo-local .env is useful in development.
    if let Some(repo_root) = find_repo_root_best_effort() {
        merge_dotenv_vars(&mut vars, &repo_root.join(".env"));
    }

    vars
}

#[tauri::command]
fn save_openrouter_api_key(api_key: String) -> Result<serde_json::Value, String> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return Err("OPENROUTER_API_KEY cannot be empty.".to_string());
    }

    let home = tauri::api::path::home_dir().ok_or("No home dir")?;
    let brood_dir = home.join(".brood");
    std::fs::create_dir_all(&brood_dir).map_err(|e| e.to_string())?;
    let env_path = brood_dir.join(".env");
    upsert_dotenv_key(&env_path, "OPENROUTER_API_KEY", trimmed)?;
    #[cfg(target_family = "unix")]
    {
        let _ = std::fs::set_permissions(&env_path, std::fs::Permissions::from_mode(0o600));
    }
    std::env::set_var("OPENROUTER_API_KEY", trimmed);

    let head = trimmed.chars().take(6).collect::<String>();
    let tail = trimmed
        .chars()
        .rev()
        .take(4)
        .collect::<String>()
        .chars()
        .rev()
        .collect::<String>();
    let masked = if trimmed.chars().count() <= 12 {
        format!("{head}***")
    } else {
        format!("{head}…{tail}")
    };

    Ok(serde_json::json!({
        "ok": true,
        "key_masked": masked,
        "env_path": env_path.to_string_lossy().to_string(),
    }))
}

const OPENROUTER_OAUTH_AUTHORIZE_URL: &str = "https://openrouter.ai/auth";
const OPENROUTER_OAUTH_EXCHANGE_URL: &str = "https://openrouter.ai/api/v1/auth/keys";
const OPENROUTER_OAUTH_LOCALHOST_BIND_HOST: &str = "127.0.0.1";
const OPENROUTER_OAUTH_LOCALHOST_CALLBACK_URL: &str = "http://localhost:3000";
const OPENROUTER_OAUTH_LOCALHOST_CALLBACK_PORT: u16 = 3000;

fn oauth_random_urlsafe(len_bytes: usize) -> String {
    let mut bytes = vec![0_u8; len_bytes.max(16)];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn oauth_pkce_challenge(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

fn oauth_write_browser_result_page(stream: &mut impl Write, status: &str, title: &str, body: &str) {
    let page = format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>{title}</title>\
         <style>body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;\
         background:#090d13;color:#ecf2f8;padding:32px}}.card{{max-width:560px;margin:0 auto;\
         border:1px solid #314357;border-radius:12px;padding:20px;background:#111924}}\
         h1{{font-size:22px;margin:0 0 10px}}p{{line-height:1.45;color:#c4cfdb}}</style></head>\
         <body><div class=\"card\"><h1>{title}</h1><p>{body}</p><p>You can close this window and return to Brood.</p></div></body></html>"
    );
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        page.as_bytes().len(),
        page
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn oauth_extract_callback_query(
    request: &str,
    port: u16,
) -> Result<HashMap<String, String>, String> {
    let first_line = request
        .lines()
        .next()
        .ok_or("OAuth callback request was empty.")?;
    let path = first_line
        .split_whitespace()
        .nth(1)
        .ok_or("OAuth callback request line missing path.")?;
    let callback = Url::parse(&format!("http://127.0.0.1:{port}{path}"))
        .map_err(|e| format!("Could not parse OAuth callback path: {e}"))?;
    Ok(callback
        .query_pairs()
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect())
}

fn oauth_error_message(payload: &serde_json::Value) -> Option<String> {
    if let Some(message) = payload
        .get("error")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Some(message.to_string());
    }
    if let Some(message) = payload
        .get("error")
        .and_then(|value| value.get("message"))
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Some(message.to_string());
    }
    if let Some(message) = payload
        .get("message")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Some(message.to_string());
    }
    None
}

fn oauth_error_detail(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if let Ok(payload) = serde_json::from_str::<serde_json::Value>(trimmed) {
        let mut detail = oauth_error_message(&payload).unwrap_or_else(|| trimmed.to_string());
        let code = payload
            .get("code")
            .and_then(|value| value.as_i64())
            .or_else(|| {
                payload
                    .get("error")
                    .and_then(|value| value.get("code"))
                    .and_then(|value| value.as_i64())
            });
        if let Some(code) = code {
            detail = format!("{detail} (code {code})");
        }
        return detail;
    }
    trimmed.to_string()
}

fn run_openrouter_oauth_pkce_sign_in(
    app: &tauri::AppHandle,
    timeout_seconds: u64,
) -> Result<serde_json::Value, String> {
    let timeout_seconds = timeout_seconds.clamp(30, 600);
    let port = OPENROUTER_OAUTH_LOCALHOST_CALLBACK_PORT;
    let listener = TcpListener::bind((OPENROUTER_OAUTH_LOCALHOST_BIND_HOST, port)).map_err(|e| {
        format!(
            "Could not start localhost callback listener on {OPENROUTER_OAUTH_LOCALHOST_CALLBACK_URL}: {e}. If another app is using port {port}, close it and retry OpenRouter sign-in, or paste your API key manually."
        )
    })?;
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("Could not configure callback listener: {e}"))?;
    let callback_url = OPENROUTER_OAUTH_LOCALHOST_CALLBACK_URL.to_string();

    let state = oauth_random_urlsafe(24);
    let code_verifier = oauth_random_urlsafe(64);
    let code_challenge = oauth_pkce_challenge(&code_verifier);

    let mut auth_url = Url::parse(OPENROUTER_OAUTH_AUTHORIZE_URL)
        .map_err(|e| format!("Could not build OpenRouter authorize URL: {e}"))?;
    {
        let mut query = auth_url.query_pairs_mut();
        query.append_pair("callback_url", &callback_url);
        query.append_pair("code_challenge", &code_challenge);
        query.append_pair("code_challenge_method", "S256");
        query.append_pair("state", &state);
    }
    tauri::api::shell::open(&app.shell_scope(), auth_url.as_str(), None)
        .map_err(|e| format!("Could not open browser for OpenRouter sign-in: {e}"))?;

    let deadline = Instant::now() + Duration::from_secs(timeout_seconds);
    let auth_code = loop {
        if Instant::now() > deadline {
            return Err("OpenRouter sign-in timed out. Please retry.".to_string());
        }
        match listener.accept() {
            Ok((mut stream, _addr)) => {
                let mut buf = [0_u8; 8192];
                let bytes_read = stream.read(&mut buf).unwrap_or(0);
                let request = String::from_utf8_lossy(&buf[..bytes_read]).to_string();
                let query = oauth_extract_callback_query(&request, port).unwrap_or_default();
                let returned_state = query
                    .get("state")
                    .map(|value| value.trim().to_string())
                    .unwrap_or_default();
                let returned_code = query
                    .get("code")
                    .map(|value| value.trim().to_string())
                    .unwrap_or_default();
                let oauth_error = query
                    .get("error")
                    .map(|value| value.trim().to_string())
                    .unwrap_or_default();
                let oauth_error_description = query
                    .get("error_description")
                    .map(|value| value.trim().to_string())
                    .unwrap_or_default();

                if !oauth_error.is_empty() {
                    let oauth_detail = oauth_error_detail(if oauth_error_description.is_empty() {
                        &oauth_error
                    } else {
                        &oauth_error_description
                    });
                    oauth_write_browser_result_page(
                        &mut stream,
                        "400 Bad Request",
                        "OpenRouter Sign-in Failed",
                        &oauth_detail
                            .chars()
                            .take(350)
                            .collect::<String>()
                            .replace('<', "")
                            .replace('>', ""),
                    );
                    return Err(format!("OpenRouter sign-in failed: {oauth_detail}"));
                }

                if returned_state != state {
                    oauth_write_browser_result_page(
                        &mut stream,
                        "400 Bad Request",
                        "OpenRouter Sign-in Failed",
                        "State validation failed. Please retry from Brood.",
                    );
                    return Err(
                        "OpenRouter sign-in failed state validation. Please retry.".to_string()
                    );
                }

                if returned_code.is_empty() {
                    oauth_write_browser_result_page(
                        &mut stream,
                        "400 Bad Request",
                        "OpenRouter Sign-in Failed",
                        "Authorization code was missing. Please retry from Brood.",
                    );
                    return Err("OpenRouter sign-in returned no authorization code.".to_string());
                }

                oauth_write_browser_result_page(
                    &mut stream,
                    "200 OK",
                    "OpenRouter Connected",
                    "Authorization completed successfully.",
                );
                break returned_code;
            }
            Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(80));
            }
            Err(err) => {
                return Err(format!("OpenRouter callback listener error: {err}"));
            }
        }
    };
    let client = Client::builder()
        .timeout(Duration::from_secs(35))
        .build()
        .map_err(|e| format!("Could not initialize OpenRouter OAuth client: {e}"))?;
    let payload = serde_json::json!({
        "code": auth_code,
        "code_verifier": code_verifier,
        "code_challenge_method": "S256",
    });
    let response = client
        .post(OPENROUTER_OAUTH_EXCHANGE_URL)
        .json(&payload)
        .send()
        .map_err(|e| format!("OpenRouter OAuth exchange request failed: {e}"))?;
    let status = response.status();
    let raw = response
        .text()
        .unwrap_or_else(|_| "{\"error\":\"Could not read exchange response\"}".to_string());
    let parsed: serde_json::Value =
        serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({ "raw": raw }));
    if !status.is_success() {
        let detail = oauth_error_message(&parsed).unwrap_or_else(|| "Unknown error".to_string());
        if status.as_u16() == 409 {
            return Err(format!(
                "OpenRouter OAuth exchange failed (409): {detail}. Retry sign-in once; if this persists, use manual API key paste and report the error to OpenRouter support."
            ));
        }
        return Err(format!(
            "OpenRouter OAuth exchange failed ({}): {detail}",
            status.as_u16()
        ));
    }
    let api_key = parsed
        .get("key")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or("OpenRouter OAuth exchange succeeded but returned no key.")?;

    let mut saved = save_openrouter_api_key(api_key.to_string())?;
    if let Some(obj) = saved.as_object_mut() {
        obj.insert(
            "auth_method".to_string(),
            serde_json::Value::String("oauth_pkce".to_string()),
        );
    }
    Ok(saved)
}

#[tauri::command]
async fn openrouter_oauth_pkce_sign_in(
    app: tauri::AppHandle,
    timeout_seconds: Option<u64>,
) -> Result<serde_json::Value, String> {
    let timeout_seconds = timeout_seconds.unwrap_or(180).clamp(30, 600);
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        run_openrouter_oauth_pkce_sign_in(&app_handle, timeout_seconds)
    })
    .await
    .map_err(|err| format!("OpenRouter OAuth task failed: {err}"))?
}

#[derive(Debug, Clone)]
struct EngineProgramCandidate {
    program: String,
    label: String,
}

fn command_exit_detail(status: portable_pty::ExitStatus) -> String {
    if status.success() {
        "success".to_string()
    } else {
        status.to_string()
    }
}

fn native_engine_bin_name() -> &'static str {
    if cfg!(windows) {
        "brood-rs.exe"
    } else {
        "brood-rs"
    }
}

fn native_engine_host_triple() -> String {
    let arch = std::env::consts::ARCH;
    let os = std::env::consts::OS;
    let os_suffix = match os {
        "macos" => "apple-darwin",
        "linux" => "unknown-linux-gnu",
        "windows" => "pc-windows-msvc",
        _ => os,
    };
    format!("{arch}-{os_suffix}")
}

fn push_engine_candidate(
    into: &mut Vec<EngineProgramCandidate>,
    program: impl Into<String>,
    label: impl Into<String>,
) {
    let program = program.into();
    if program.trim().is_empty() {
        return;
    }
    if into.iter().any(|existing| existing.program == program) {
        return;
    }
    into.push(EngineProgramCandidate {
        program,
        label: label.into(),
    });
}

fn push_native_path_candidate(
    into: &mut Vec<EngineProgramCandidate>,
    path: PathBuf,
    label: impl Into<String>,
) {
    if !path.exists() || !path.is_file() {
        return;
    }
    if is_native_engine_placeholder(&path) {
        eprintln!(
            "brood desktop skipping placeholder native engine candidate '{}'",
            path.display()
        );
        return;
    }
    push_engine_candidate(into, path.to_string_lossy().to_string(), label.into());
}

fn is_native_engine_placeholder(path: &Path) -> bool {
    let Ok(metadata) = std::fs::metadata(path) else {
        return false;
    };
    if metadata.len() > 8 * 1024 {
        return false;
    }
    let Ok(raw) = std::fs::read(path) else {
        return false;
    };
    let text = String::from_utf8_lossy(&raw).to_ascii_lowercase();
    text.contains("brood-rs resource not staged") || text.contains("brood_rs_placeholder_stub")
}

fn resolve_existing_env_binary_path(value: &str) -> Option<PathBuf> {
    let raw = PathBuf::from(value);
    let candidate = if raw.is_absolute() {
        raw
    } else {
        std::env::current_dir().ok()?.join(raw)
    };
    if !candidate.exists() || !candidate.is_file() {
        return None;
    }
    Some(std::fs::canonicalize(&candidate).unwrap_or(candidate))
}

fn native_engine_program_candidates(app: Option<&tauri::AppHandle>) -> Vec<EngineProgramCandidate> {
    let mut out: Vec<EngineProgramCandidate> = Vec::new();
    let bin_name = native_engine_bin_name();
    let bin_with_triple = format!("{bin_name}-{}", native_engine_host_triple());

    for env_key in ["BROOD_RS_BIN", "BROOD_ENGINE_BINARY"] {
        if let Ok(raw) = std::env::var(env_key) {
            let value = raw.trim();
            if value.is_empty() {
                continue;
            }
            if let Some(path) = resolve_existing_env_binary_path(value) {
                push_native_path_candidate(&mut out, path, format!("{env_key} ({})", value));
            } else {
                // Allow executable names (e.g. "brood-rs") via env override.
                push_engine_candidate(&mut out, value.to_string(), format!("{env_key} ({value})"));
            }
        }
    }

    if let Some(app) = app {
        for resource in [
            format!("resources/{bin_name}"),
            format!("resources/{bin_with_triple}"),
            bin_name.to_string(),
            bin_with_triple.clone(),
        ] {
            if let Some(path) = app.path_resolver().resolve_resource(&resource) {
                push_native_path_candidate(
                    &mut out,
                    path,
                    format!("bundled resource ({resource})"),
                );
            }
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            push_native_path_candidate(
                &mut out,
                exe_dir.join(bin_name),
                "current_exe sibling".to_string(),
            );
            push_native_path_candidate(
                &mut out,
                exe_dir.join("../Resources").join(bin_name),
                "macOS app Resources".to_string(),
            );
            push_native_path_candidate(
                &mut out,
                exe_dir.join("../Resources").join(&bin_with_triple),
                "macOS app Resources (triple)".to_string(),
            );
        }
    }

    // Final fallback is PATH resolution.
    push_engine_candidate(&mut out, bin_name.to_string(), "PATH lookup".to_string());
    out
}

fn native_engine_command_requested(command: &str) -> bool {
    let trimmed = command.trim();
    trimmed == "brood-rs" || trimmed == native_engine_bin_name()
}

fn resolve_spawn_candidates(app: &tauri::AppHandle, command: &str) -> Vec<EngineProgramCandidate> {
    if !native_engine_command_requested(command) {
        return vec![EngineProgramCandidate {
            program: command.to_string(),
            label: "requested command".to_string(),
        }];
    }

    let candidates = native_engine_program_candidates(Some(app));
    if candidates.is_empty() {
        vec![EngineProgramCandidate {
            program: command.to_string(),
            label: "requested command".to_string(),
        }]
    } else {
        candidates
    }
}

struct PtyState {
    writer: Option<Box<dyn Write + Send>>,
    child: Option<Box<dyn portable_pty::Child + Send>>,
    master: Option<Box<dyn portable_pty::MasterPty + Send>>,
    run_dir: Option<String>,
    events_path: Option<String>,
    automation_frontend_ready: bool,
    automation_request_seq: u64,
    automation_waiters: HashMap<String, mpsc::Sender<serde_json::Value>>,
}

impl PtyState {
    fn new() -> Self {
        Self {
            writer: None,
            child: None,
            master: None,
            run_dir: None,
            events_path: None,
            automation_frontend_ready: false,
            automation_request_seq: 0,
            automation_waiters: HashMap::new(),
        }
    }
}

type SharedPtyState = Arc<Mutex<PtyState>>;

fn extract_arg_value(args: &[String], key: &str) -> Option<String> {
    let mut idx = 0usize;
    while idx < args.len() {
        if args[idx] == key {
            if idx + 1 < args.len() {
                return Some(args[idx + 1].clone());
            }
            return None;
        }
        idx += 1;
    }
    None
}

fn write_to_pty(state: &mut PtyState, data: &str) -> Result<(), String> {
    let Some(writer) = state.writer.as_mut() else {
        return Err("PTY not running".to_string());
    };
    writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

fn pty_status_value(state: &mut PtyState) -> serde_json::Value {
    let has_writer = state.writer.is_some();
    let mut has_child = state.child.is_some();
    let mut pid: Option<u32> = None;
    let mut child_running = false;

    if let Some(child) = state.child.as_mut() {
        pid = child.process_id();
        match child.try_wait() {
            Ok(Some(_)) => {
                has_child = false;
                state.child = None;
                state.writer = None;
                state.master = None;
                state.run_dir = None;
                state.events_path = None;
            }
            Ok(None) => {
                child_running = true;
            }
            Err(_) => {
                child_running = true;
            }
        }
    }

    serde_json::json!({
        "running": child_running && has_writer,
        "has_child": has_child,
        "has_writer": has_writer,
        "pid": pid,
        "automation_frontend_ready": state.automation_frontend_ready,
        "run_dir": state.run_dir.clone(),
        "events_path": state.events_path.clone(),
    })
}

#[tauri::command]
fn spawn_pty(
    state: State<'_, SharedPtyState>,
    app: tauri::AppHandle,
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
    env: Option<std::collections::HashMap<String, String>>,
) -> Result<(), String> {
    let mut state = state.inner().lock().map_err(|_| "Lock poisoned")?;
    if let Some(mut child) = state.child.take() {
        let _ = child.kill();
    }
    state.writer = None;
    state.master = None;
    state.run_dir = None;
    state.events_path = None;

    let mut merged_env = env.unwrap_or_default();
    if let Some(home) = tauri::api::path::home_dir() {
        merge_dotenv_vars(&mut merged_env, &home.join(".brood").join(".env"));
    }
    if let Some(repo_root) = find_repo_root_best_effort() {
        let env_path = repo_root.join(".env");
        if env_path.exists() {
            merge_dotenv_vars(&mut merged_env, &env_path);
        }
    }

    let pty_system = NativePtySystem::default();
    let mut launch_errors: Vec<String> = Vec::new();
    let mut launched: Option<(
        EngineProgramCandidate,
        Box<dyn portable_pty::Child + Send>,
        Box<dyn portable_pty::MasterPty + Send>,
    )> = None;
    let candidates = resolve_spawn_candidates(&app, &command);

    for candidate in candidates {
        let pair = pty_system
            .openpty(PtySize {
                rows: 40,
                cols: 120,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
        let mut cmd = CommandBuilder::new(candidate.program.clone());
        for arg in &args {
            cmd.arg(arg);
        }
        if let Some(dir) = cwd.as_ref() {
            cmd.cwd(PathBuf::from(dir));
        }
        for (key, value) in &merged_env {
            cmd.env(key, value);
        }

        eprintln!(
            "brood desktop spawn attempting '{}' ({})",
            candidate.program, candidate.label
        );
        let mut child = match pair.slave.spawn_command(cmd) {
            Ok(child) => child,
            Err(err) => {
                launch_errors.push(format!("{}: {}", candidate.label, err));
                continue;
            }
        };

        let mut immediate_exit = child
            .try_wait()
            .ok()
            .and_then(|status| status.map(command_exit_detail));
        if immediate_exit.is_none() {
            std::thread::sleep(Duration::from_millis(220));
            immediate_exit = child
                .try_wait()
                .ok()
                .and_then(|status| status.map(command_exit_detail));
        }
        if let Some(detail) = immediate_exit {
            launch_errors.push(format!(
                "{}: exited immediately ({detail})",
                candidate.label
            ));
            continue;
        }

        launched = Some((candidate, child, pair.master));
        break;
    }

    let Some((resolved_candidate, child, master)) = launched else {
        if launch_errors.is_empty() {
            return Err(format!(
                "failed to spawn engine command '{}'",
                command.trim()
            ));
        }
        return Err(format!(
            "failed to spawn engine command '{}': {}",
            command.trim(),
            launch_errors.join(" | ")
        ));
    };

    eprintln!(
        "brood desktop spawn command resolved '{}' -> '{}' ({})",
        command, resolved_candidate.program, resolved_candidate.label
    );
    let run_dir = extract_arg_value(&args, "--out");
    let events_path = extract_arg_value(&args, "--events");

    let mut reader = master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = master.take_writer().map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut buffer = [0u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buffer[..n]).to_string();
                    let _ = app_handle.emit_all("pty-data", data);
                }
                Err(_) => break,
            }
        }
        let _ = app_handle.emit_all("pty-exit", true);
    });

    state.writer = Some(writer);
    state.child = Some(child);
    state.master = Some(master);
    state.run_dir = run_dir;
    state.events_path = events_path;
    Ok(())
}

#[tauri::command]
fn write_pty(state: State<'_, SharedPtyState>, data: String) -> Result<(), String> {
    let mut state = state.inner().lock().map_err(|_| "Lock poisoned")?;
    write_to_pty(&mut state, &data)
}

#[tauri::command]
fn resize_pty(state: State<'_, SharedPtyState>, cols: u16, rows: u16) -> Result<(), String> {
    let mut state = state.inner().lock().map_err(|_| "Lock poisoned")?;
    if let Some(master) = state.master.as_mut() {
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn create_run_dir() -> Result<serde_json::Value, String> {
    let home = tauri::api::path::home_dir().ok_or("No home dir")?;
    let run_root = home.join("brood_runs");
    std::fs::create_dir_all(&run_root).map_err(|e| e.to_string())?;
    let stamp = chrono::Utc::now().format("%Y%m%dT%H%M%S");
    let run_dir = run_root.join(format!("run-{}", stamp));
    std::fs::create_dir_all(&run_dir).map_err(|e| e.to_string())?;
    let events_path = run_dir.join("events.jsonl");
    Ok(serde_json::json!({
        "run_dir": run_dir.to_string_lossy(),
        "events_path": events_path.to_string_lossy(),
    }))
}

#[tauri::command]
fn get_repo_root() -> Result<String, String> {
    if let Some(repo_root) = find_repo_root_best_effort() {
        Ok(repo_root.to_string_lossy().to_string())
    } else {
        Err("repo root not found".to_string())
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportRectPayload {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportSizePayload {
    width: u32,
    height: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportTransformPayload {
    rotate_deg: f64,
    skew_x_deg: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportSourceImagePayload {
    id: String,
    path: String,
    #[serde(default)]
    receipt_path: Option<String>,
    #[serde(default)]
    label: Option<String>,
    #[serde(default)]
    kind: Option<String>,
    #[serde(default)]
    timeline_node_id: Option<String>,
    width: u32,
    height: u32,
    z_index: i64,
    rect_css: ExportRectPayload,
    transform: ExportTransformPayload,
    #[serde(default)]
    source_receipt_meta: Option<serde_json::Value>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportTimelineNodePayload {
    #[serde(default)]
    node_id: Option<String>,
    #[serde(default)]
    image_id: Option<String>,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    receipt_path: Option<String>,
    #[serde(default)]
    label: Option<String>,
    #[serde(default)]
    action: Option<String>,
    #[serde(default)]
    parents: Vec<String>,
    #[serde(default)]
    created_at: Option<i64>,
    #[serde(default)]
    created_at_iso: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportPsdRequest {
    #[serde(default)]
    schema_version: Option<u32>,
    #[serde(default)]
    document_name: Option<String>,
    format: String,
    run_dir: String,
    out_path: String,
    flattened_source_path: String,
    #[serde(default)]
    canvas_mode: Option<String>,
    #[serde(default)]
    active_image_id: Option<String>,
    #[serde(default)]
    export_bounds_css: Option<ExportRectPayload>,
    #[serde(default)]
    flattened_size_px: Option<ExportSizePayload>,
    #[serde(default)]
    source_images: Vec<ExportSourceImagePayload>,
    #[serde(default)]
    timeline_nodes: Vec<ExportTimelineNodePayload>,
    #[serde(default)]
    action_sequence: Vec<String>,
    #[serde(default)]
    edit_receipts: Vec<ExportEditReceiptPayload>,
    #[serde(default)]
    limitations: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportEditReceiptPayload {
    receipt_path: String,
    #[serde(default)]
    provider: Option<String>,
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    operation: Option<String>,
    #[serde(default)]
    created_at: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
struct VisualPromptPayload {
    #[serde(default)]
    canvas: Option<VisualPromptCanvasPayload>,
    #[serde(default)]
    images: Vec<VisualPromptImagePayload>,
}

#[derive(Debug, Clone, Default, serde::Deserialize)]
struct VisualPromptCanvasPayload {
    #[serde(default)]
    mode: Option<String>,
    #[serde(default)]
    active_image_id: Option<String>,
    #[serde(default)]
    size_px: Option<ExportSizePayload>,
    #[serde(default)]
    multi_rects_px: Vec<VisualPromptMultiRectPayload>,
}

#[derive(Debug, Clone, serde::Deserialize)]
struct VisualPromptImagePayload {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    kind: Option<String>,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    label: Option<String>,
    #[serde(default)]
    width: Option<u32>,
    #[serde(default)]
    height: Option<u32>,
}

#[derive(Debug, Clone, serde::Deserialize)]
struct VisualPromptMultiRectPayload {
    image_id: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

#[derive(Debug, Clone)]
struct RunReceiptRecord {
    path: PathBuf,
    image_path: Option<String>,
    summary: Option<ExportEditReceiptPayload>,
}

#[derive(Debug, Clone)]
struct ResolvedExportPsdRequest {
    schema_version: u32,
    document_name: String,
    format: String,
    run_dir: String,
    requested_out_path: String,
    out_path: String,
    flattened_source_path: String,
    canvas_mode: Option<String>,
    active_image_id: Option<String>,
    export_bounds_css: Option<ExportRectPayload>,
    flattened_size_px: Option<ExportSizePayload>,
    source_images: Vec<ExportSourceImagePayload>,
    timeline_nodes: Vec<ExportTimelineNodePayload>,
    action_sequence: Vec<String>,
    edit_receipts: Vec<ExportEditReceiptPayload>,
    limitations: Vec<String>,
}

fn default_export_document_name(run_dir: &Path) -> String {
    run_dir
        .file_name()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("juggernaut-export")
        .to_string()
}

fn default_export_limitations() -> Vec<String> {
    vec![
        "PSD export is flattened to a single bitmap composition with alpha; editable per-source PSD layers are not included in this March 8 slice."
            .to_string(),
        "Export reconstructs canvas placement from Juggernaut run artifacts and does not preserve live tool semantics, masks, or effect-token re-editability."
            .to_string(),
        "If the shell still requests export.html, the native exporter normalizes the output artifact to .psd and leaves a pointer note at the requested legacy path."
            .to_string(),
    ]
}

fn merge_limitations(base: &[String], extras: &[String]) -> Vec<String> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for entry in base.iter().chain(extras.iter()) {
        let normalized = entry.trim();
        if normalized.is_empty() {
            continue;
        }
        if seen.insert(normalized.to_string()) {
            out.push(normalized.to_string());
        }
    }
    out
}

fn normalize_psd_out_path(requested: &Path, run_dir: &Path) -> PathBuf {
    let base = if requested.as_os_str().is_empty() {
        run_dir.join("export.psd")
    } else {
        requested.to_path_buf()
    };
    match base.extension().and_then(|value| value.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("psd") => base,
        _ => base.with_extension("psd"),
    }
}

fn infer_image_id_from_receipt_path(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.trim_end_matches(".json"))
        .and_then(|value| value.strip_prefix("receipt-"))
        .unwrap_or("image")
        .to_string()
}

fn summarize_receipt_value(path: &Path, parsed: &serde_json::Value) -> ExportEditReceiptPayload {
    let request = parsed
        .get("request")
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    let resolved = parsed
        .get("resolved")
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    let result = parsed
        .get("result_metadata")
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    let provider = resolved
        .get("provider")
        .and_then(|value| value.as_str())
        .or_else(|| request.get("provider").and_then(|value| value.as_str()))
        .map(str::to_string);
    let model = resolved
        .get("model")
        .and_then(|value| value.as_str())
        .or_else(|| request.get("model").and_then(|value| value.as_str()))
        .map(str::to_string);
    let operation = request
        .get("metadata")
        .and_then(|value| value.get("operation"))
        .and_then(|value| value.as_str())
        .or_else(|| result.get("operation").and_then(|value| value.as_str()))
        .or_else(|| request.get("mode").and_then(|value| value.as_str()))
        .map(str::to_string);
    let created_at = result
        .get("created_at")
        .and_then(|value| value.as_str())
        .map(str::to_string);

    ExportEditReceiptPayload {
        receipt_path: path.to_string_lossy().to_string(),
        provider,
        model,
        operation,
        created_at,
    }
}

fn collect_run_receipt_records(run_dir: &Path) -> Result<Vec<RunReceiptRecord>, String> {
    let mut records = Vec::new();
    let entries =
        std::fs::read_dir(run_dir).map_err(|e| format!("{}: {e}", run_dir.to_string_lossy()))?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !name.starts_with("receipt-")
            || !name.ends_with(".json")
            || name.starts_with("receipt-export-")
        {
            continue;
        }
        let raw = std::fs::read_to_string(&path)
            .map_err(|e| format!("{}: {e}", path.to_string_lossy()))?;
        let parsed = serde_json::from_str::<serde_json::Value>(&raw)
            .map_err(|e| format!("{}: {e}", path.to_string_lossy()))?;
        let image_path = parsed
            .get("artifacts")
            .and_then(|value| value.get("image_path"))
            .and_then(|value| value.as_str())
            .map(str::to_string);
        let summary = Some(summarize_receipt_value(&path, &parsed));
        records.push(RunReceiptRecord {
            path,
            image_path,
            summary,
        });
    }
    records.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(records)
}

fn read_visual_prompt(run_dir: &Path) -> Result<VisualPromptPayload, String> {
    let path = run_dir.join("visual_prompt.json");
    let raw =
        std::fs::read_to_string(&path).map_err(|e| format!("{}: {e}", path.to_string_lossy()))?;
    serde_json::from_str::<VisualPromptPayload>(&raw)
        .map_err(|e| format!("{}: {e}", path.to_string_lossy()))
}

fn read_image_rgba(path: &Path) -> Result<image::RgbaImage, String> {
    let reader =
        image::ImageReader::open(path).map_err(|e| format!("{}: {e}", path.to_string_lossy()))?;
    let decoded = reader
        .decode()
        .map_err(|e| format!("{}: {e}", path.to_string_lossy()))?;
    Ok(decoded.to_rgba8())
}

fn export_source_receipt_for_image<'a>(
    image_id: &str,
    image_path: &str,
    records: &'a [RunReceiptRecord],
) -> Option<&'a RunReceiptRecord> {
    records
        .iter()
        .find(|record| infer_image_id_from_receipt_path(&record.path) == image_id)
        .or_else(|| {
            records
                .iter()
                .find(|record| record.image_path.as_deref() == Some(image_path))
        })
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest = hasher.finalize();
    let mut out = String::with_capacity(digest.len() * 2);
    for byte in digest {
        use std::fmt::Write as _;
        let _ = write!(&mut out, "{byte:02x}");
    }
    out
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("{}: {e}", path.to_string_lossy()))?;
    Ok(sha256_hex(&bytes))
}

fn encode_flattened_psd_rgba(width: u32, height: u32, rgba: &[u8]) -> Result<Vec<u8>, String> {
    let expected_len = usize::try_from(width)
        .ok()
        .and_then(|w| usize::try_from(height).ok().map(|h| w.saturating_mul(h)))
        .and_then(|px| px.checked_mul(4))
        .ok_or_else(|| "psd encode dimensions overflow".to_string())?;
    if rgba.len() != expected_len {
        return Err(format!(
            "psd encode expected {expected_len} rgba bytes, got {}",
            rgba.len()
        ));
    }

    let mut out = Vec::with_capacity(40 + rgba.len());
    out.extend_from_slice(b"8BPS");
    out.extend_from_slice(&1u16.to_be_bytes());
    out.extend_from_slice(&[0u8; 6]);
    out.extend_from_slice(&4u16.to_be_bytes());
    out.extend_from_slice(&height.to_be_bytes());
    out.extend_from_slice(&width.to_be_bytes());
    out.extend_from_slice(&8u16.to_be_bytes());
    out.extend_from_slice(&3u16.to_be_bytes());
    out.extend_from_slice(&0u32.to_be_bytes());
    out.extend_from_slice(&0u32.to_be_bytes());
    out.extend_from_slice(&0u32.to_be_bytes());
    out.extend_from_slice(&0u16.to_be_bytes());

    for channel in 0..4usize {
        let mut index = channel;
        while index < rgba.len() {
            out.push(rgba[index]);
            index += 4;
        }
    }

    Ok(out)
}

fn collect_edit_receipts_from_records(
    records: &[RunReceiptRecord],
) -> Vec<ExportEditReceiptPayload> {
    records
        .iter()
        .filter_map(|record| record.summary.clone())
        .collect()
}

fn derive_action_sequence(edit_receipts: &[ExportEditReceiptPayload]) -> Vec<String> {
    edit_receipts
        .iter()
        .filter_map(|receipt| receipt.operation.clone())
        .collect()
}

fn write_generated_flattened_source(
    run_dir: &Path,
    rgba: &image::RgbaImage,
) -> Result<String, String> {
    let out_path = run_dir.join(format!(
        "export-{}.flattened.png",
        chrono::Utc::now().format("%Y%m%dT%H%M%S")
    ));
    rgba.save_with_format(&out_path, image::ImageFormat::Png)
        .map_err(|e| format!("{}: {e}", out_path.to_string_lossy()))?;
    Ok(out_path.to_string_lossy().to_string())
}

fn build_source_images_from_visual_prompt(
    visual_prompt: VisualPromptPayload,
    records: &[RunReceiptRecord],
) -> Result<
    (
        Vec<ExportSourceImagePayload>,
        Option<String>,
        Option<String>,
        Option<ExportRectPayload>,
        Option<ExportSizePayload>,
        image::RgbaImage,
        Vec<String>,
    ),
    String,
> {
    let canvas = visual_prompt.canvas.unwrap_or_default();
    let multi_mode = matches!(canvas.mode.as_deref(), Some("multi"));
    let active_image_id = canvas.active_image_id.clone();
    let single_target = if multi_mode {
        None
    } else {
        active_image_id.clone().or_else(|| {
            visual_prompt
                .images
                .iter()
                .find_map(|image| image.id.clone())
        })
    };

    let mut rects_by_id: HashMap<String, ExportRectPayload> = HashMap::new();
    for rect in canvas.multi_rects_px {
        rects_by_id.insert(
            rect.image_id,
            ExportRectPayload {
                x: rect.x,
                y: rect.y,
                w: rect.w.max(1.0),
                h: rect.h.max(1.0),
            },
        );
    }

    let mut loaded_layers: Vec<(ExportSourceImagePayload, image::RgbaImage)> = Vec::new();
    let mut missing_rects = false;

    for (index, image) in visual_prompt.images.iter().enumerate() {
        let Some(image_id) = image
            .id
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        else {
            continue;
        };
        if let Some(target) = single_target.as_deref() {
            if image_id != target {
                continue;
            }
        }
        let Some(image_path) = image
            .path
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        else {
            continue;
        };
        let path = PathBuf::from(image_path);
        if !path.exists() {
            continue;
        }
        let rgba = read_image_rgba(&path)?;
        let (source_width, source_height) = rgba.dimensions();
        let rect_css = if multi_mode {
            match rects_by_id.get(image_id) {
                Some(rect) => rect.clone(),
                None => {
                    missing_rects = true;
                    ExportRectPayload {
                        x: 0.0,
                        y: 0.0,
                        w: source_width as f64,
                        h: source_height as f64,
                    }
                }
            }
        } else {
            ExportRectPayload {
                x: 0.0,
                y: 0.0,
                w: source_width as f64,
                h: source_height as f64,
            }
        };
        let receipt_record = export_source_receipt_for_image(image_id, image_path, records);
        let receipt_path = receipt_record
            .as_ref()
            .map(|record| record.path.to_string_lossy().to_string());
        let source_receipt_meta = receipt_record
            .and_then(|record| record.summary.clone())
            .and_then(|summary| serde_json::to_value(summary).ok());

        loaded_layers.push((
            ExportSourceImagePayload {
                id: image_id.to_string(),
                path: image_path.to_string(),
                receipt_path,
                label: image.label.clone(),
                kind: image.kind.clone(),
                timeline_node_id: None,
                width: image.width.unwrap_or(source_width),
                height: image.height.unwrap_or(source_height),
                z_index: index as i64,
                rect_css,
                transform: ExportTransformPayload {
                    rotate_deg: 0.0,
                    skew_x_deg: 0.0,
                },
                source_receipt_meta,
            },
            rgba,
        ));
    }

    if loaded_layers.is_empty() {
        return Err("visual_prompt.json did not contain any exportable images".to_string());
    }

    let mut min_x = f64::INFINITY;
    let mut min_y = f64::INFINITY;
    let mut max_x = f64::NEG_INFINITY;
    let mut max_y = f64::NEG_INFINITY;
    for (payload, _) in &loaded_layers {
        min_x = min_x.min(payload.rect_css.x);
        min_y = min_y.min(payload.rect_css.y);
        max_x = max_x.max(payload.rect_css.x + payload.rect_css.w.max(1.0));
        max_y = max_y.max(payload.rect_css.y + payload.rect_css.h.max(1.0));
    }

    let floor_min_x = min_x.floor() as i64;
    let floor_min_y = min_y.floor() as i64;
    let width = ((max_x.ceil() as i64) - floor_min_x).max(1) as u32;
    let height = ((max_y.ceil() as i64) - floor_min_y).max(1) as u32;
    let mut composite = image::RgbaImage::new(width, height);

    for (payload, rgba) in &loaded_layers {
        let draw_w = payload.rect_css.w.max(1.0).round() as u32;
        let draw_h = payload.rect_css.h.max(1.0).round() as u32;
        let scaled = if rgba.width() == draw_w && rgba.height() == draw_h {
            rgba.clone()
        } else {
            image::imageops::resize(rgba, draw_w, draw_h, image::imageops::FilterType::Triangle)
        };
        let draw_x = payload.rect_css.x.round() as i64 - floor_min_x;
        let draw_y = payload.rect_css.y.round() as i64 - floor_min_y;
        image::imageops::overlay(&mut composite, &scaled, draw_x, draw_y);
    }

    let mut limitations = Vec::new();
    if missing_rects {
        limitations.push(
            "Some canvas placements were missing from visual_prompt.json, so those images exported at source size from the origin."
                .to_string(),
        );
    }

    Ok((
        loaded_layers
            .into_iter()
            .map(|(payload, _)| payload)
            .collect(),
        canvas.mode,
        active_image_id,
        Some(ExportRectPayload {
            x: floor_min_x as f64,
            y: floor_min_y as f64,
            w: width as f64,
            h: height as f64,
        }),
        Some(
            canvas
                .size_px
                .unwrap_or(ExportSizePayload { width, height }),
        ),
        composite,
        limitations,
    ))
}

fn build_source_images_from_receipts(
    records: &[RunReceiptRecord],
) -> Result<
    (
        Vec<ExportSourceImagePayload>,
        Option<String>,
        Option<String>,
        Option<ExportRectPayload>,
        Option<ExportSizePayload>,
        image::RgbaImage,
        Vec<String>,
    ),
    String,
> {
    let Some(record) = records.iter().rev().find(|record| {
        record
            .image_path
            .as_ref()
            .map(|value| PathBuf::from(value).exists())
            .unwrap_or(false)
    }) else {
        return Err("run dir does not contain any exportable receipt artifacts".to_string());
    };

    let image_path = record
        .image_path
        .as_ref()
        .ok_or_else(|| "latest receipt is missing image_path".to_string())?;
    let rgba = read_image_rgba(Path::new(image_path))?;
    let (width, height) = rgba.dimensions();
    let image_id = infer_image_id_from_receipt_path(&record.path);
    let source_receipt_meta = record
        .summary
        .clone()
        .and_then(|summary| serde_json::to_value(summary).ok());

    Ok((
        vec![ExportSourceImagePayload {
            id: image_id.clone(),
            path: image_path.clone(),
            receipt_path: Some(record.path.to_string_lossy().to_string()),
            label: Path::new(image_path)
                .file_name()
                .and_then(|value| value.to_str())
                .map(str::to_string),
            kind: Some("receipt".to_string()),
            timeline_node_id: None,
            width,
            height,
            z_index: 0,
            rect_css: ExportRectPayload {
                x: 0.0,
                y: 0.0,
                w: width as f64,
                h: height as f64,
            },
            transform: ExportTransformPayload {
                rotate_deg: 0.0,
                skew_x_deg: 0.0,
            },
            source_receipt_meta,
        }],
        Some("single".to_string()),
        Some(image_id),
        Some(ExportRectPayload {
            x: 0.0,
            y: 0.0,
            w: width as f64,
            h: height as f64,
        }),
        Some(ExportSizePayload { width, height }),
        rgba,
        vec![
            "visual_prompt.json was unavailable or incomplete, so PSD export fell back to the latest receipt artifact rather than the full canvas arrangement."
                .to_string(),
        ],
    ))
}

fn resolve_provided_export_request(
    request: ExportPsdRequest,
) -> Result<ResolvedExportPsdRequest, String> {
    let run_dir_path = PathBuf::from(&request.run_dir);
    if !run_dir_path.exists() {
        return Err(format!("run dir not found: {}", request.run_dir));
    }
    if request.format.trim().to_lowercase() != "psd" {
        return Err(format!(
            "unsupported export format '{}'; expected psd",
            request.format
        ));
    }

    let flattened_source_path = PathBuf::from(&request.flattened_source_path);
    if !flattened_source_path.exists() {
        return Err(format!(
            "flattened export source not found: {}",
            request.flattened_source_path
        ));
    }

    let requested_out_path = PathBuf::from(&request.out_path);
    let normalized_out_path = normalize_psd_out_path(&requested_out_path, &run_dir_path);
    let records = collect_run_receipt_records(&run_dir_path)?;
    let edit_receipts = if request.edit_receipts.is_empty() {
        collect_edit_receipts_from_records(&records)
    } else {
        request.edit_receipts.clone()
    };

    Ok(ResolvedExportPsdRequest {
        schema_version: request.schema_version.unwrap_or(1),
        document_name: request
            .document_name
            .unwrap_or_else(|| default_export_document_name(&run_dir_path)),
        format: request.format,
        run_dir: request.run_dir,
        requested_out_path: requested_out_path.to_string_lossy().to_string(),
        out_path: normalized_out_path.to_string_lossy().to_string(),
        flattened_source_path: request.flattened_source_path,
        canvas_mode: request.canvas_mode,
        active_image_id: request.active_image_id,
        export_bounds_css: request.export_bounds_css,
        flattened_size_px: request.flattened_size_px,
        source_images: request.source_images,
        timeline_nodes: request.timeline_nodes,
        action_sequence: if request.action_sequence.is_empty() {
            derive_action_sequence(&edit_receipts)
        } else {
            request.action_sequence
        },
        edit_receipts,
        limitations: merge_limitations(&default_export_limitations(), &request.limitations),
    })
}

fn resolve_legacy_export_request(
    run_dir: String,
    out_path: String,
) -> Result<ResolvedExportPsdRequest, String> {
    let run_dir_path = PathBuf::from(&run_dir);
    if !run_dir_path.exists() {
        return Err(format!("run dir not found: {run_dir}"));
    }

    let requested_out_path = PathBuf::from(&out_path);
    let normalized_out_path = normalize_psd_out_path(&requested_out_path, &run_dir_path);
    let records = collect_run_receipt_records(&run_dir_path)?;
    let edit_receipts = collect_edit_receipts_from_records(&records);

    let (
        source_images,
        canvas_mode,
        active_image_id,
        export_bounds_css,
        flattened_size_px,
        composite,
        extra_limits,
    ) = match read_visual_prompt(&run_dir_path)
        .and_then(|visual_prompt| build_source_images_from_visual_prompt(visual_prompt, &records))
    {
        Ok(snapshot) => snapshot,
        Err(_) => build_source_images_from_receipts(&records)?,
    };

    let flattened_source_path = write_generated_flattened_source(&run_dir_path, &composite)?;
    Ok(ResolvedExportPsdRequest {
        schema_version: 1,
        document_name: default_export_document_name(&run_dir_path),
        format: "psd".to_string(),
        run_dir,
        requested_out_path: requested_out_path.to_string_lossy().to_string(),
        out_path: normalized_out_path.to_string_lossy().to_string(),
        flattened_source_path,
        canvas_mode,
        active_image_id,
        export_bounds_css,
        flattened_size_px,
        source_images,
        timeline_nodes: Vec::new(),
        action_sequence: derive_action_sequence(&edit_receipts),
        edit_receipts,
        limitations: merge_limitations(&default_export_limitations(), &extra_limits),
    })
}

fn resolve_export_request(
    request: Option<ExportPsdRequest>,
    run_dir: Option<String>,
    out_path: Option<String>,
) -> Result<ResolvedExportPsdRequest, String> {
    if let Some(request) = request {
        return resolve_provided_export_request(request);
    }
    let run_dir = run_dir
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "missing export request.runDir".to_string())?;
    let out_path = out_path
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            PathBuf::from(&run_dir)
                .join("export.html")
                .to_string_lossy()
                .to_string()
        });
    resolve_legacy_export_request(run_dir, out_path)
}

fn write_legacy_export_pointer(
    requested_path: &Path,
    psd_path: &Path,
    receipt_path: &Path,
    limitations: &[String],
) -> Result<(), String> {
    if let Some(parent) = requested_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let body = format!(
        "<!doctype html><html><body><h1>Juggernaut PSD Export</h1><p>PSD: {}</p><p>Receipt: {}</p><ul>{}</ul></body></html>",
        psd_path.to_string_lossy(),
        receipt_path.to_string_lossy(),
        limitations
            .iter()
            .map(|item| format!("<li>{item}</li>"))
            .collect::<Vec<_>>()
            .join("")
    );
    std::fs::write(requested_path, body)
        .map_err(|e| format!("{}: {e}", requested_path.to_string_lossy()))
}

fn build_export_receipt_payload(
    request: &ResolvedExportPsdRequest,
    receipt_path: &Path,
    out_path: &Path,
    width: u32,
    height: u32,
    flattened_source_sha256: &str,
    output_sha256: &str,
) -> serde_json::Value {
    let source_images: Vec<serde_json::Value> = request
        .source_images
        .iter()
        .map(|image| {
            let source_path = PathBuf::from(&image.path);
            let source_sha256 = sha256_file(&source_path).ok();
            let receipt_path_buf = image.receipt_path.as_ref().map(PathBuf::from);
            let receipt_sha256 = receipt_path_buf
                .as_ref()
                .and_then(|path| sha256_file(path).ok());
            let receipt_summary = receipt_path_buf.as_ref().and_then(|path| {
                std::fs::read_to_string(path)
                    .ok()
                    .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
                    .map(|parsed| summarize_receipt_value(path, &parsed))
            });
            serde_json::json!({
                "id": image.id,
                "path": image.path,
                "label": image.label,
                "kind": image.kind,
                "timeline_node_id": image.timeline_node_id,
                "receipt_path": image.receipt_path,
                "width": image.width,
                "height": image.height,
                "z_index": image.z_index,
                "rect_css": image.rect_css,
                "transform": image.transform,
                "source_receipt_meta": image.source_receipt_meta,
                "source_asset_sha256": source_sha256,
                "source_receipt_sha256": receipt_sha256,
                "source_receipt_summary": receipt_summary,
            })
        })
        .collect();

    let timeline_nodes: Vec<serde_json::Value> = request
        .timeline_nodes
        .iter()
        .map(|node| {
            serde_json::json!({
                "node_id": node.node_id,
                "image_id": node.image_id,
                "path": node.path,
                "receipt_path": node.receipt_path,
                "label": node.label,
                "action": node.action,
                "parents": node.parents,
                "created_at": node.created_at,
                "created_at_iso": node.created_at_iso,
            })
        })
        .collect();

    let limitations = if request.limitations.is_empty() {
        vec!["PSD export completed with default flattened limitations.".to_string()]
    } else {
        request.limitations.clone()
    };
    let edit_receipts: Vec<serde_json::Value> = request
        .edit_receipts
        .iter()
        .map(|receipt| serde_json::json!(receipt))
        .collect();

    serde_json::json!({
        "schema_version": request.schema_version,
        "request": {
            "prompt": "",
            "mode": "local",
            "size": format!("{width}x{height}"),
            "n": 1,
            "seed": null,
            "output_format": request.format,
            "inputs": {
                "init_image": request.flattened_source_path,
                "mask": null,
                "reference_images": request.source_images.iter().map(|image| image.path.clone()).collect::<Vec<_>>(),
            },
            "provider": "local",
            "model": "juggernaut-psd-export-v1",
            "provider_options": {},
            "out_dir": request.run_dir,
            "metadata": {
                "operation": "export_psd",
                "export_contract": "juggernaut.psd_export.v1",
                "document_name": request.document_name,
                "canvas_mode": request.canvas_mode,
                "active_image_id": request.active_image_id,
                "action_sequence": request.action_sequence,
                "limitations": limitations,
                "export_bounds_css": request.export_bounds_css,
                "flattened_size_px": request.flattened_size_px,
                "input_snapshot": {
                    "documentName": request.document_name,
                    "images": request.source_images.iter().map(|image| serde_json::json!({
                        "id": image.id,
                        "path": image.path,
                        "label": image.label,
                    })).collect::<Vec<_>>(),
                    "activeImageId": request.active_image_id,
                    "editReceipts": edit_receipts,
                },
            },
        },
        "resolved": {
            "provider": "local",
            "model": "juggernaut-psd-export-v1",
            "size": format!("{width}x{height}"),
            "width": width,
            "height": height,
            "output_format": request.format,
            "background": "transparent",
            "seed": null,
            "n": 1,
            "user": null,
            "prompt": "",
            "inputs": {
                "init_image": request.flattened_source_path,
                "mask": null,
                "reference_images": request.source_images.iter().map(|image| image.path.clone()).collect::<Vec<_>>(),
            },
            "stream": false,
            "partial_images": null,
            "provider_params": {
                "layer_strategy": "flattened_single_bitmap",
                "channel_count": 4,
                "color_mode": "rgb",
            },
            "warnings": limitations,
        },
        "provider_request": {
            "document_name": request.document_name,
            "flattened_source_path": request.flattened_source_path,
            "source_image_count": request.source_images.len(),
            "source_images": source_images,
            "timeline_nodes": timeline_nodes,
            "edit_receipts": edit_receipts,
        },
        "provider_response": {
            "writer": "juggernaut-psd-export-v1",
            "psd": {
                "version": 1,
                "channels": 4,
                "depth": 8,
                "color_mode": "rgb",
                "layer_strategy": "flattened_single_bitmap",
            },
            "hashes": {
                "flattened_source_sha256": flattened_source_sha256,
                "output_sha256": output_sha256,
            },
        },
        "warnings": limitations,
        "artifacts": {
            "image_path": request.flattened_source_path,
            "export_path": out_path.to_string_lossy().to_string(),
            "receipt_path": receipt_path.to_string_lossy().to_string(),
        },
        "result_metadata": {
            "operation": "export_psd",
            "created_at": chrono::Utc::now().to_rfc3339(),
            "format": request.format,
            "document_name": request.document_name,
            "source_image_count": request.source_images.len(),
            "timeline_node_count": request.timeline_nodes.len(),
            "editable_layer_count": 0,
            "fidelity": "partial_flattened",
            "canvas_mode": request.canvas_mode,
            "active_image_id": request.active_image_id,
            "output_sha256": output_sha256,
            "flattened_source_sha256": flattened_source_sha256,
            "limitations": limitations,
        },
    })
}

#[tauri::command]
fn export_run(
    request: Option<ExportPsdRequest>,
    run_dir: Option<String>,
    out_path: Option<String>,
) -> Result<serde_json::Value, String> {
    let request = resolve_export_request(request, run_dir, out_path)?;
    let run_dir_path = PathBuf::from(&request.run_dir);
    let flattened_source_path = PathBuf::from(&request.flattened_source_path);
    let out_path_buf = PathBuf::from(&request.out_path);
    if let Some(parent) = out_path_buf.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let flattened_source_sha256 = sha256_file(&flattened_source_path)?;
    let reader = image::ImageReader::open(&flattened_source_path)
        .map_err(|e| format!("{}: {e}", flattened_source_path.to_string_lossy()))?;
    let decoded = reader
        .decode()
        .map_err(|e| format!("{}: {e}", flattened_source_path.to_string_lossy()))?;
    let rgba = decoded.to_rgba8();
    let (width, height) = rgba.dimensions();
    let psd_bytes = encode_flattened_psd_rgba(width, height, rgba.as_raw())?;
    let output_sha256 = sha256_hex(&psd_bytes);
    std::fs::write(&out_path_buf, &psd_bytes)
        .map_err(|e| format!("{}: {e}", out_path_buf.to_string_lossy()))?;

    let receipt_name = format!(
        "receipt-export-{}.json",
        chrono::Utc::now().format("%Y%m%dT%H%M%S")
    );
    let receipt_path = run_dir_path.join(receipt_name);
    let receipt_payload = build_export_receipt_payload(
        &request,
        &receipt_path,
        &out_path_buf,
        width,
        height,
        &flattened_source_sha256,
        &output_sha256,
    );
    let encoded_receipt =
        serde_json::to_string_pretty(&receipt_payload).map_err(|e| e.to_string())?;
    std::fs::write(&receipt_path, encoded_receipt)
        .map_err(|e| format!("{}: {e}", receipt_path.to_string_lossy()))?;

    let requested_out_path = PathBuf::from(&request.requested_out_path);
    if requested_out_path != out_path_buf {
        write_legacy_export_pointer(
            &requested_out_path,
            &out_path_buf,
            &receipt_path,
            &request.limitations,
        )?;
    }

    Ok(serde_json::json!({
        "ok": true,
        "psdPath": out_path_buf.to_string_lossy().to_string(),
        "receiptPath": receipt_path.to_string_lossy().to_string(),
        "limitations": request.limitations,
        "out_path": out_path_buf.to_string_lossy().to_string(),
        "receipt_path": receipt_path.to_string_lossy().to_string(),
        "flattened_source_path": flattened_source_path.to_string_lossy().to_string(),
        "width": width,
        "height": height,
        "output_sha256": output_sha256,
    }))
}

#[tauri::command]
fn get_key_status() -> Result<serde_json::Value, String> {
    let vars = collect_brood_env_snapshot();
    let has = |key: &str| -> bool {
        vars.get(key)
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false)
    };

    let openai = has("OPENAI_API_KEY") || has("OPENAI_API_KEY_BACKUP");
    let openrouter = has("OPENROUTER_API_KEY");
    let gemini = has("GEMINI_API_KEY") || has("GOOGLE_API_KEY");
    let flux = has("BFL_API_KEY") || has("FLUX_API_KEY") || openrouter;
    let imagen = has("IMAGEN_API_KEY")
        || has("GOOGLE_API_KEY")
        || has("IMAGEN_VERTEX_PROJECT")
        || has("GOOGLE_APPLICATION_CREDENTIALS");
    let anthropic = has("ANTHROPIC_API_KEY");

    #[derive(Clone, Copy, Debug, Eq, PartialEq)]
    enum RealtimeProvider {
        OpenAiRealtime,
        GeminiFlash,
    }

    impl RealtimeProvider {
        fn as_str(self) -> &'static str {
            match self {
                Self::OpenAiRealtime => "openai_realtime",
                Self::GeminiFlash => "gemini_flash",
            }
        }

        fn from_raw(raw: &str) -> Option<Self> {
            let normalized = raw.trim().to_ascii_lowercase();
            match normalized.as_str() {
                "openai" | "openai_realtime" => Some(Self::OpenAiRealtime),
                "gemini" | "gemini_flash" => Some(Self::GeminiFlash),
                _ => None,
            }
        }
    }

    let configured_global = vars
        .get("BROOD_REALTIME_PROVIDER")
        .and_then(|raw| RealtimeProvider::from_raw(raw));
    let infer_default = || {
        if openai {
            RealtimeProvider::OpenAiRealtime
        } else if openrouter || gemini {
            RealtimeProvider::GeminiFlash
        } else {
            RealtimeProvider::OpenAiRealtime
        }
    };
    let default_provider = configured_global.unwrap_or_else(infer_default);
    let resolve_provider = |key: &str| -> RealtimeProvider {
        vars.get(key)
            .and_then(|raw| RealtimeProvider::from_raw(raw))
            .or(configured_global)
            .unwrap_or_else(infer_default)
    };
    let canvas_provider = resolve_provider("BROOD_CANVAS_CONTEXT_REALTIME_PROVIDER");
    let intent_provider = resolve_provider("BROOD_INTENT_REALTIME_PROVIDER");
    let mother_intent_provider = resolve_provider("BROOD_MOTHER_INTENT_REALTIME_PROVIDER");
    let provider_ready = |provider: RealtimeProvider| -> bool {
        match provider {
            RealtimeProvider::OpenAiRealtime => openai,
            RealtimeProvider::GeminiFlash => gemini || openrouter,
        }
    };
    let realtime_ready_canvas_context = provider_ready(canvas_provider);
    let realtime_ready_intent = provider_ready(intent_provider);
    let realtime_ready_mother_intent = provider_ready(mother_intent_provider);

    Ok(serde_json::json!({
        "openai": openai,
        "openrouter": openrouter,
        "gemini": gemini,
        "imagen": imagen,
        "flux": flux,
        "anthropic": anthropic,
        "realtime_provider_default": default_provider.as_str(),
        "realtime_provider_canvas_context": canvas_provider.as_str(),
        "realtime_provider_intent": intent_provider.as_str(),
        "realtime_provider_mother_intent": mother_intent_provider.as_str(),
        "realtime_ready": realtime_ready_canvas_context && realtime_ready_intent && realtime_ready_mother_intent,
        "realtime_ready_canvas_context": realtime_ready_canvas_context,
        "realtime_ready_intent": realtime_ready_intent,
        "realtime_ready_mother_intent": realtime_ready_mother_intent,
        "realtime_ready_openai": openai,
        "realtime_ready_gemini": gemini || openrouter,
        "realtime_ready_openrouter": openrouter,
    }))
}

fn env_flag(raw: Option<&String>) -> Option<bool> {
    let value = raw?.trim().to_ascii_lowercase();
    match value.as_str() {
        "1" | "true" | "yes" | "on" => Some(true),
        "0" | "false" | "no" | "off" => Some(false),
        _ => None,
    }
}

fn review_first_non_empty(vars: &HashMap<String, String>, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(value) = vars.get(*key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

fn review_mime_type_from_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.trim().to_ascii_lowercase())
        .unwrap_or_default()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        _ => "image/png",
    }
}

fn review_image_data_url(path: &str) -> Result<String, String> {
    let image_path = PathBuf::from(path);
    let bytes = std::fs::read(&image_path).map_err(|e| e.to_string())?;
    let mime = review_mime_type_from_path(&image_path);
    let encoded = BASE64_STANDARD.encode(bytes);
    Ok(format!("data:{mime};base64,{encoded}"))
}

#[derive(Default)]
struct ReviewResponsesWsSession {
    socket: Option<WebSocket<MaybeTlsStream<TcpStream>>>,
    connected_at: Option<Instant>,
    last_response_id: Option<String>,
}

static REVIEW_RESPONSES_WS_SESSION: OnceLock<Mutex<ReviewResponsesWsSession>> = OnceLock::new();

fn review_responses_ws_session() -> &'static Mutex<ReviewResponsesWsSession> {
    REVIEW_RESPONSES_WS_SESSION.get_or_init(|| Mutex::new(ReviewResponsesWsSession::default()))
}

fn review_set_stream_timeouts(
    stream: &mut MaybeTlsStream<TcpStream>,
    timeout: Duration,
) -> Result<(), String> {
    match stream {
        MaybeTlsStream::Plain(socket) => {
            socket
                .set_read_timeout(Some(timeout))
                .map_err(|e| e.to_string())?;
            socket
                .set_write_timeout(Some(timeout))
                .map_err(|e| e.to_string())?;
            Ok(())
        }
        MaybeTlsStream::Rustls(socket) => {
            socket
                .get_mut()
                .set_read_timeout(Some(timeout))
                .map_err(|e| e.to_string())?;
            socket
                .get_mut()
                .set_write_timeout(Some(timeout))
                .map_err(|e| e.to_string())?;
            Ok(())
        }
        _ => Ok(()),
    }
}

fn review_drop_responses_ws_session(session: &mut ReviewResponsesWsSession) {
    session.socket = None;
    session.connected_at = None;
}

fn review_extract_openai_output_text(payload: &serde_json::Value) -> String {
    if let Some(text) = payload.get("output_text").and_then(|value| value.as_str()) {
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    if let Some(output) = payload.get("output").and_then(|value| value.as_array()) {
        let mut parts = Vec::new();
        for item in output {
            if let Some(content) = item.get("content").and_then(|value| value.as_array()) {
                for block in content {
                    let block_type = block
                        .get("type")
                        .and_then(|value| value.as_str())
                        .unwrap_or_default();
                    if block_type == "output_text" || block_type == "text" {
                        if let Some(text) = block
                            .get("text")
                            .and_then(|value| value.as_str())
                            .or_else(|| block.get("content").and_then(|value| value.as_str()))
                        {
                            let trimmed = text.trim();
                            if !trimmed.is_empty() {
                                parts.push(trimmed.to_string());
                            }
                        }
                    }
                }
            }
        }
        if !parts.is_empty() {
            return parts.join("\n");
        }
    }
    String::new()
}

fn review_extract_openrouter_text(payload: &serde_json::Value) -> String {
    if let Some(text) = payload
        .get("choices")
        .and_then(|value| value.as_array())
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
    {
        if let Some(content) = text.get("content") {
            if let Some(raw) = content.as_str() {
                let trimmed = raw.trim();
                if !trimmed.is_empty() {
                    return trimmed.to_string();
                }
            }
            if let Some(items) = content.as_array() {
                let mut parts = Vec::new();
                for item in items {
                    let item_type = item
                        .get("type")
                        .and_then(|value| value.as_str())
                        .unwrap_or_default();
                    if item_type == "text" {
                        if let Some(text) = item.get("text").and_then(|value| value.as_str()) {
                            let trimmed = text.trim();
                            if !trimmed.is_empty() {
                                parts.push(trimmed.to_string());
                            }
                        }
                    }
                }
                if !parts.is_empty() {
                    return parts.join("\n");
                }
            }
        }
    }
    review_extract_openai_output_text(payload)
}

fn review_normalize_openrouter_model(raw: &str, default_model: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return default_model.to_string();
    }
    if trimmed.contains('/') {
        return trimmed.to_string();
    }
    let lower = trimmed.to_ascii_lowercase();
    if lower.starts_with("gpt-") || lower.starts_with("o1") || lower.starts_with("o3") {
        return format!("openai/{trimmed}");
    }
    if lower.starts_with("gemini") {
        return format!("google/{trimmed}");
    }
    trimmed.to_string()
}

fn review_normalize_planner_model(raw: &str, provider: &str) -> String {
    let trimmed = raw.trim();
    let lower = trimmed.to_ascii_lowercase();
    let canonical = if trimmed.is_empty() {
        DESIGN_REVIEW_PLANNER_MODEL.to_string()
    } else if lower == "gpt-5.4-vision"
        || lower == "openai/gpt-5.4-vision"
        || lower == DESIGN_REVIEW_OPENROUTER_PLANNER_MODEL
    {
        DESIGN_REVIEW_PLANNER_MODEL.to_string()
    } else if provider.eq_ignore_ascii_case("openai") {
        trimmed
            .strip_prefix("openai/")
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| trimmed.to_string())
    } else {
        trimmed.to_string()
    };

    if provider.eq_ignore_ascii_case("openrouter") {
        if canonical.eq_ignore_ascii_case(DESIGN_REVIEW_PLANNER_MODEL) {
            return DESIGN_REVIEW_OPENROUTER_PLANNER_MODEL.to_string();
        }
        return review_normalize_openrouter_model(
            &canonical,
            DESIGN_REVIEW_OPENROUTER_PLANNER_MODEL,
        );
    }

    canonical
}

fn review_extract_error_detail(body: &str) -> String {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(trimmed) {
        let candidates = [
            parsed
                .pointer("/error/message")
                .and_then(|value| value.as_str()),
            parsed
                .pointer("/error/metadata/raw")
                .and_then(|value| value.as_str()),
            parsed.pointer("/message").and_then(|value| value.as_str()),
            parsed.pointer("/detail").and_then(|value| value.as_str()),
        ];
        for candidate in candidates.into_iter().flatten() {
            let text = candidate.trim();
            if !text.is_empty() {
                return text.to_string();
            }
        }
    }
    trimmed.to_string()
}

fn review_is_openrouter_auth_error(status: u16, detail: &str) -> bool {
    let lower = detail.to_ascii_lowercase();
    status == 401
        || status == 403
        || lower.contains("user not found")
        || lower.contains("unauthorized")
        || lower.contains("invalid api key")
        || lower.contains("invalid key")
        || lower.contains("expired key")
}

fn review_is_invalid_model_error(status: u16, detail: &str) -> bool {
    let lower = detail.to_ascii_lowercase();
    status == 400
        && (lower.contains("not a valid model id")
            || lower.contains("invalid model id")
            || lower.contains("invalid model")
            || lower.contains("unknown model")
            || lower.contains("unsupported model"))
}

fn review_format_planner_http_error(
    provider: &str,
    normalized_model: &str,
    status: u16,
    body: &str,
) -> String {
    let detail = review_extract_error_detail(body);
    let provider_label = match provider {
        "openrouter" => "OpenRouter",
        "openai" => "OpenAI",
        _ => "Planner",
    };

    if provider == "openrouter" && review_is_openrouter_auth_error(status, &detail) {
        let mut message = format!(
            "{provider_label} planner request failed: configured OpenRouter key is invalid or expired (provider={provider}, normalized model={normalized_model}, status={status})."
        );
        if !detail.is_empty() {
            message.push_str(&format!(" API detail: {detail}"));
        }
        return message;
    }

    if review_is_invalid_model_error(status, &detail) {
        let mut message = format!(
            "{provider_label} planner request failed: invalid model id for provider {provider} (normalized model={normalized_model}, status={status})."
        );
        if !detail.is_empty() {
            message.push_str(&format!(" API detail: {detail}"));
        }
        return message;
    }

    if detail.is_empty() {
        return format!(
            "{provider_label} planner request failed (provider={provider}, normalized model={normalized_model}, status={status})."
        );
    }

    format!(
        "{provider_label} planner request failed (provider={provider}, normalized model={normalized_model}, status={status}): {detail}"
    )
}

fn review_build_openai_planner_payload(
    prompt: &str,
    image_urls: &[String],
    model: &str,
) -> serde_json::Value {
    let mut content = vec![serde_json::json!({
        "type": "input_text",
        "text": prompt,
    })];
    for image_url in image_urls {
        content.push(serde_json::json!({
            "type": "input_image",
            "image_url": image_url,
            "detail": "high",
        }));
    }
    serde_json::json!({
        "model": model,
        "reasoning": {
            "effort": "xhigh",
        },
        "input": [{
            "role": "user",
            "content": content,
        }],
    })
}

fn review_build_openai_planner_ws_event(
    prompt: &str,
    image_urls: &[String],
    model: &str,
    previous_response_id: Option<&str>,
) -> serde_json::Value {
    let mut content = vec![serde_json::json!({
        "type": "input_text",
        "text": prompt,
    })];
    for image_url in image_urls {
        content.push(serde_json::json!({
            "type": "input_image",
            "image_url": image_url,
            "detail": "high",
        }));
    }
    let mut event = serde_json::json!({
        "type": "response.create",
        "model": model,
        "store": false,
        "reasoning": {
            "effort": "xhigh",
        },
        "input": [{
            "type": "message",
            "role": "user",
            "content": content,
        }],
    });
    if let Some(value) = previous_response_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        event["previous_response_id"] = serde_json::json!(value);
    }
    event
}

fn review_extract_openai_ws_response_id(payload: &serde_json::Value) -> Option<String> {
    [
        payload
            .pointer("/response/id")
            .and_then(|value| value.as_str())
            .map(str::trim),
        payload
            .get("id")
            .and_then(|value| value.as_str())
            .map(str::trim),
    ]
    .into_iter()
    .flatten()
    .find(|value| !value.is_empty())
    .map(|value| value.to_string())
}

fn review_extract_openai_ws_error(payload: &serde_json::Value) -> String {
    [
        payload
            .pointer("/error/message")
            .and_then(|value| value.as_str()),
        payload
            .pointer("/response/error/message")
            .and_then(|value| value.as_str()),
        payload.pointer("/message").and_then(|value| value.as_str()),
    ]
    .into_iter()
    .flatten()
    .map(str::trim)
    .find(|value| !value.is_empty())
    .map(|value| value.to_string())
    .unwrap_or_else(|| "OpenAI planner websocket returned an unknown error.".to_string())
}

fn review_openai_planner_http_fallback(
    client: &Client,
    api_key: &str,
    prompt: &str,
    image_urls: &[String],
    normalized_model: &str,
) -> Result<serde_json::Value, String> {
    let payload = review_build_openai_planner_payload(prompt, image_urls, normalized_model);
    let response = client
        .post("https://api.openai.com/v1/responses")
        .bearer_auth(api_key)
        .header("content-type", "application/json")
        .json(&payload)
        .send()
        .map_err(|error| {
            if error.is_timeout() {
                return "OpenAI planner HTTP fallback timed out after 90 seconds.".to_string();
            }
            format!("OpenAI planner HTTP fallback request failed: {error}")
        })?;
    let status = response.status();
    let body = response.text().map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(review_format_planner_http_error(
            "openai",
            normalized_model,
            status.as_u16(),
            &body,
        ));
    }
    let parsed: serde_json::Value =
        serde_json::from_str(&body).unwrap_or_else(|_| serde_json::json!({ "raw": body.clone() }));
    Ok(serde_json::json!({
        "provider": "openai",
        "model": normalized_model,
        "transport": "responses_http_fallback",
        "text": review_extract_openai_output_text(&parsed),
        "response_id": review_extract_openai_ws_response_id(&parsed),
        "raw": parsed,
    }))
}

fn review_openai_ws_connect(
    session: &mut ReviewResponsesWsSession,
    api_key: &str,
) -> Result<(), String> {
    let needs_reconnect = session
        .connected_at
        .map(|connected_at| connected_at.elapsed() >= Duration::from_secs(55 * 60))
        .unwrap_or(true)
        || session.socket.is_none();
    if !needs_reconnect {
        return Ok(());
    }
    review_drop_responses_ws_session(session);
    let mut request = "wss://api.openai.com/v1/responses"
        .into_client_request()
        .map_err(|e| e.to_string())?;
    let auth_header = format!("Bearer {api_key}")
        .parse()
        .map_err(|e| format!("invalid websocket auth header: {e}"))?;
    request.headers_mut().insert("Authorization", auth_header);
    let (mut socket, _) =
        connect(request).map_err(|e| format!("OpenAI planner websocket connect failed: {e}"))?;
    review_set_stream_timeouts(socket.get_mut(), Duration::from_secs(90))?;
    session.connected_at = Some(Instant::now());
    session.socket = Some(socket);
    Ok(())
}

fn review_openai_planner_ws_request_inner(
    socket: &mut WebSocket<MaybeTlsStream<TcpStream>>,
    prompt: &str,
    image_urls: &[String],
    normalized_model: &str,
    previous_response_id: Option<&str>,
) -> Result<(String, Option<String>, serde_json::Value), String> {
    let event = review_build_openai_planner_ws_event(
        prompt,
        image_urls,
        normalized_model,
        previous_response_id,
    );
    socket
        .send(Message::Text(event.to_string().into()))
        .map_err(|e| format!("OpenAI planner websocket send failed: {e}"))?;

    let mut streamed_text = String::new();
    loop {
        let message = socket.read().map_err(|e| {
            format!("OpenAI planner websocket read failed or timed out after 90 seconds: {e}")
        })?;
        match message {
            Message::Text(raw) => {
                let parsed: serde_json::Value =
                    serde_json::from_str(raw.as_str()).unwrap_or_else(|_| {
                        serde_json::json!({
                            "type": "unknown",
                            "raw": raw.as_str(),
                        })
                    });
                let event_type = parsed
                    .get("type")
                    .and_then(|value| value.as_str())
                    .unwrap_or_default();
                match event_type {
                    "response.output_text.delta" => {
                        if let Some(delta) = parsed.get("delta").and_then(|value| value.as_str()) {
                            streamed_text.push_str(delta);
                        }
                    }
                    "response.output_text.done" => {
                        if let Some(text) = parsed.get("text").and_then(|value| value.as_str()) {
                            streamed_text = text.trim().to_string();
                        }
                    }
                    "response.completed" => {
                        let response = parsed
                            .get("response")
                            .cloned()
                            .unwrap_or_else(|| serde_json::json!({}));
                        let response_id = review_extract_openai_ws_response_id(&response)
                            .or_else(|| review_extract_openai_ws_response_id(&parsed));
                        let output_text = review_extract_openai_output_text(&response);
                        return Ok((
                            if output_text.trim().is_empty() {
                                streamed_text.trim().to_string()
                            } else {
                                output_text
                            },
                            response_id,
                            response,
                        ));
                    }
                    "response.failed" | "response.incomplete" | "error" => {
                        return Err(review_extract_openai_ws_error(&parsed));
                    }
                    _ => {}
                }
            }
            Message::Ping(payload) => {
                socket
                    .send(Message::Pong(payload))
                    .map_err(|e| format!("OpenAI planner websocket ping reply failed: {e}"))?;
            }
            Message::Close(frame) => {
                let detail = frame
                    .as_ref()
                    .map(|value| value.reason.to_string())
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| "connection closed".to_string());
                return Err(format!(
                    "OpenAI planner websocket closed before completion: {detail}"
                ));
            }
            _ => {}
        }
    }
}

fn review_openai_planner_ws_request(
    session: &mut ReviewResponsesWsSession,
    prompt: &str,
    image_urls: &[String],
    normalized_model: &str,
    previous_response_id: Option<&str>,
) -> Result<serde_json::Value, String> {
    let result = {
        let Some(socket) = session.socket.as_mut() else {
            return Err("OpenAI planner websocket session is unavailable.".to_string());
        };
        review_openai_planner_ws_request_inner(
            socket,
            prompt,
            image_urls,
            normalized_model,
            previous_response_id,
        )
    };
    match result {
        Ok((text, response_id, raw)) => {
            session.last_response_id = response_id.clone();
            Ok(serde_json::json!({
                "provider": "openai",
                "model": normalized_model,
                "transport": "responses_websocket",
                "text": text,
                "response_id": response_id,
                "previous_response_id": previous_response_id,
                "raw": raw,
            }))
        }
        Err(error) => {
            review_drop_responses_ws_session(session);
            Err(error)
        }
    }
}

fn review_apply_openrouter_headers(
    mut request: reqwest::blocking::RequestBuilder,
    vars: &HashMap<String, String>,
) -> reqwest::blocking::RequestBuilder {
    if let Some(referer) = review_first_non_empty(vars, &["OPENROUTER_HTTP_REFERER"]) {
        request = request.header("HTTP-Referer", referer);
    }
    if let Some(title) = review_first_non_empty(vars, &["OPENROUTER_X_TITLE"]) {
        request = request.header("X-Title", title);
    } else {
        request = request.header("X-Title", "Juggernaut");
    }
    request
}

fn review_google_extract_images(
    payload: &serde_json::Value,
) -> Result<Vec<(Vec<u8>, String)>, String> {
    let mut out = Vec::new();
    let candidates = payload
        .get("candidates")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    for candidate in candidates {
        let parts = candidate
            .get("content")
            .and_then(|value| value.as_object())
            .and_then(|content| content.get("parts"))
            .and_then(|value| value.as_array())
            .cloned()
            .unwrap_or_default();
        for part in parts {
            let inline = part
                .get("inlineData")
                .or_else(|| part.get("inline_data"))
                .and_then(|value| value.as_object())
                .cloned()
                .unwrap_or_default();
            let Some(data) = inline.get("data").and_then(|value| value.as_str()) else {
                continue;
            };
            if data.trim().is_empty() {
                continue;
            }
            let bytes = BASE64_STANDARD
                .decode(data.trim().as_bytes())
                .map_err(|e| format!("Google preview image decode failed: {e}"))?;
            let mime = inline
                .get("mimeType")
                .or_else(|| inline.get("mime_type"))
                .and_then(|value| value.as_str())
                .unwrap_or("image/png")
                .to_string();
            out.push((bytes, mime));
        }
    }
    Ok(out)
}

fn review_collect_openrouter_images(
    value: &serde_json::Value,
    key_hint: Option<&str>,
    out: &mut Vec<String>,
) {
    match value {
        serde_json::Value::Object(map) => {
            for (key, nested) in map {
                review_collect_openrouter_images(nested, Some(key), out);
            }
        }
        serde_json::Value::Array(items) => {
            for item in items {
                review_collect_openrouter_images(item, key_hint, out);
            }
        }
        serde_json::Value::String(raw) => {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                return;
            }
            let key = key_hint
                .map(|value| value.trim().to_ascii_lowercase())
                .unwrap_or_default();
            let looks_http = trimmed.starts_with("http://") || trimmed.starts_with("https://");
            let looks_data_url = trimmed.starts_with("data:image/");
            let looks_b64_key = key.contains("b64") || key.contains("base64") || key == "result";
            let looks_url_key = key == "url"
                || key.ends_with("_url")
                || key.ends_with("url")
                || key.contains("image_url");
            if looks_data_url || (looks_http && looks_url_key) || looks_b64_key {
                if !out.iter().any(|existing| existing == trimmed) {
                    out.push(trimmed.to_string());
                }
            }
        }
        _ => {}
    }
}

fn review_decode_openrouter_data_url(raw: &str) -> Result<(Vec<u8>, String), String> {
    let (meta, payload) = raw
        .split_once(',')
        .ok_or_else(|| "invalid data URL image payload".to_string())?;
    let mime = meta
        .trim()
        .strip_prefix("data:")
        .and_then(|rest| rest.split(';').next())
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .unwrap_or("image/png")
        .to_string();
    let bytes = BASE64_STANDARD
        .decode(payload.trim().as_bytes())
        .map_err(|e| format!("OpenRouter image decode failed: {e}"))?;
    Ok((bytes, mime))
}

fn review_extract_openrouter_images(
    payload: &serde_json::Value,
) -> Result<Vec<(Vec<u8>, String)>, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let mut candidates = Vec::new();
    review_collect_openrouter_images(payload, None, &mut candidates);
    let mut out = Vec::new();
    for candidate in candidates {
        let trimmed = candidate.trim();
        if trimmed.starts_with("data:image/") {
            if let Ok(image) = review_decode_openrouter_data_url(trimmed) {
                out.push(image);
            }
            continue;
        }
        if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
            let response = client.get(trimmed).send().map_err(|e| e.to_string())?;
            if response.status().is_success() {
                let mime = response
                    .headers()
                    .get("content-type")
                    .and_then(|value| value.to_str().ok())
                    .unwrap_or("image/png")
                    .to_string();
                let bytes = response.bytes().map_err(|e| e.to_string())?.to_vec();
                out.push((bytes, mime));
            }
            continue;
        }
        if let Ok(bytes) = BASE64_STANDARD.decode(trimmed.as_bytes()) {
            out.push((bytes, "image/png".to_string()));
        }
    }
    Ok(out)
}

fn run_design_review_planner_request(
    request: &serde_json::Value,
    vars: &HashMap<String, String>,
) -> Result<serde_json::Value, String> {
    let provider_pref = request
        .get("provider")
        .and_then(|value| value.as_str())
        .unwrap_or("auto")
        .trim()
        .to_ascii_lowercase();
    let requested_model = request
        .get("model")
        .and_then(|value| value.as_str())
        .unwrap_or(DESIGN_REVIEW_PLANNER_MODEL)
        .trim()
        .to_string();
    let prompt = request
        .get("prompt")
        .and_then(|value| value.as_str())
        .ok_or("planner prompt missing")?
        .to_string();
    let image_paths: Vec<String> = request
        .get("images")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|entry| {
            entry.as_str().map(|value| value.to_string()).or_else(|| {
                entry
                    .get("path")
                    .and_then(|value| value.as_str())
                    .map(|value| value.to_string())
            })
        })
        .filter(|value| !value.trim().is_empty())
        .collect();
    let client = Client::builder()
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|e| e.to_string())?;

    if provider_pref == "auto" || provider_pref == "openai" {
        if let Some(api_key) =
            review_first_non_empty(vars, &["OPENAI_API_KEY", "OPENAI_API_KEY_BACKUP"])
        {
            let normalized_model = review_normalize_planner_model(&requested_model, "openai");
            let image_urls = image_paths
                .iter()
                .map(|path| review_image_data_url(path))
                .collect::<Result<Vec<_>, _>>()?;
            let previous_response_id = request
                .get("previous_response_id")
                .and_then(|value| value.as_str())
                .or_else(|| {
                    request
                        .get("previousResponseId")
                        .and_then(|value| value.as_str())
                });
            let session_lock = review_responses_ws_session()
                .lock()
                .map_err(|_| "OpenAI planner websocket session lock is poisoned.".to_string())?;
            let mut session = session_lock;
            match review_openai_ws_connect(&mut session, &api_key).and_then(|_| {
                review_openai_planner_ws_request(
                    &mut session,
                    &prompt,
                    &image_urls,
                    &normalized_model,
                    previous_response_id,
                )
            }) {
                Ok(result) => return Ok(result),
                Err(ws_error) => {
                    let mut fallback = review_openai_planner_http_fallback(
                        &client,
                        &api_key,
                        &prompt,
                        &image_urls,
                        &normalized_model,
                    )
                    .map_err(|http_error| {
                        format!(
                            "OpenAI planner websocket request failed: {ws_error} HTTP fallback also failed: {http_error}"
                        )
                    })?;
                    if let Some(object) = fallback.as_object_mut() {
                        object.insert("fallback_reason".to_string(), serde_json::json!(ws_error));
                    }
                    return Ok(fallback);
                }
            }
        }
    }

    if provider_pref == "auto" || provider_pref == "openrouter" {
        if let Some(api_key) = review_first_non_empty(vars, &["OPENROUTER_API_KEY"]) {
            let normalized_model = review_normalize_planner_model(&requested_model, "openrouter");
            let mut content = vec![serde_json::json!({
                "type": "text",
                "text": prompt,
            })];
            for path in &image_paths {
                content.push(serde_json::json!({
                    "type": "image_url",
                    "image_url": {
                        "url": review_image_data_url(path)?,
                    }
                }));
            }
            let payload = serde_json::json!({
                "model": normalized_model,
                "messages": [{
                    "role": "user",
                    "content": content,
                }],
                "temperature": 0.2,
            });
            let request = client
                .post(
                    review_first_non_empty(vars, &["OPENROUTER_API_BASE"])
                        .unwrap_or_else(|| "https://openrouter.ai/api/v1".to_string())
                        + "/chat/completions",
                )
                .bearer_auth(api_key)
                .header("content-type", "application/json");
            let response = review_apply_openrouter_headers(request, vars)
                .json(&payload)
                .send()
                .map_err(|e| format!("OpenRouter planner request failed: {e}"))?;
            let status = response.status();
            let body = response.text().map_err(|e| e.to_string())?;
            if !status.is_success() {
                return Err(review_format_planner_http_error(
                    "openrouter",
                    &normalized_model,
                    status.as_u16(),
                    &body,
                ));
            }
            let parsed: serde_json::Value = serde_json::from_str(&body)
                .unwrap_or_else(|_| serde_json::json!({ "raw": body.clone() }));
            return Ok(serde_json::json!({
                "provider": "openrouter",
                "model": normalized_model,
                "transport": "chat_completions",
                "text": review_extract_openrouter_text(&parsed),
                "raw": parsed,
            }));
        }
    }

    Err("No planner provider credentials are configured for design review. Set OPENAI_API_KEY or OPENROUTER_API_KEY.".to_string())
}

fn run_design_review_preview_request(
    request: &serde_json::Value,
    vars: &HashMap<String, String>,
) -> Result<serde_json::Value, String> {
    let provider_pref = request
        .get("provider")
        .and_then(|value| value.as_str())
        .unwrap_or("auto")
        .trim()
        .to_ascii_lowercase();
    let model = request
        .get("model")
        .and_then(|value| value.as_str())
        .unwrap_or("gemini-3.1-flash-image-preview")
        .trim()
        .to_string();
    let prompt = request
        .get("prompt")
        .and_then(|value| value.as_str())
        .ok_or("preview prompt missing")?
        .to_string();
    let output_path = request
        .get("outputPath")
        .and_then(|value| value.as_str())
        .ok_or("preview outputPath missing")?
        .to_string();
    let input_path = request
        .get("inputImage")
        .and_then(|value| value.get("path"))
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
        .or_else(|| {
            request
                .get("inputImage")
                .and_then(|value| value.as_str())
                .map(|value| value.to_string())
        })
        .ok_or("preview inputImage path missing")?;
    let client = Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    if provider_pref == "auto" || provider_pref == "google" {
        if let Some(api_key) = review_first_non_empty(vars, &["GEMINI_API_KEY", "GOOGLE_API_KEY"]) {
            let image_bytes = std::fs::read(&input_path).map_err(|e| e.to_string())?;
            let mime = review_mime_type_from_path(Path::new(&input_path)).to_string();
            let endpoint_base = review_first_non_empty(vars, &["GEMINI_API_BASE"])
                .unwrap_or_else(|| "https://generativelanguage.googleapis.com/v1beta".to_string());
            let model_path = if model.starts_with("models/") {
                model.clone()
            } else {
                format!("models/{model}")
            };
            let endpoint = format!("{endpoint_base}/{model_path}:generateContent");
            let payload = serde_json::json!({
                "contents": [{
                    "role": "user",
                    "parts": [
                        {
                            "inlineData": {
                                "mimeType": mime,
                                "data": BASE64_STANDARD.encode(image_bytes),
                            }
                        },
                        { "text": prompt }
                    ]
                }],
                "generationConfig": {
                    "responseModalities": ["TEXT", "IMAGE"],
                    "temperature": 0.25
                }
            });
            let response = client
                .post(endpoint)
                .query(&[("key", api_key)])
                .header("content-type", "application/json")
                .json(&payload)
                .send()
                .map_err(|e| format!("Google preview request failed: {e}"))?;
            let status = response.status();
            let body = response.text().map_err(|e| e.to_string())?;
            if !status.is_success() {
                return Err(format!(
                    "Google preview request failed ({}): {}",
                    status.as_u16(),
                    body
                ));
            }
            let parsed: serde_json::Value = serde_json::from_str(&body)
                .unwrap_or_else(|_| serde_json::json!({ "raw": body.clone() }));
            let images = review_google_extract_images(&parsed)?;
            let Some((bytes, mime_type)) = images.into_iter().next() else {
                return Err("Google preview renderer returned no image.".to_string());
            };
            std::fs::write(&output_path, bytes).map_err(|e| e.to_string())?;
            return Ok(serde_json::json!({
                "provider": "google",
                "model": model,
                "transport": "generate_content",
                "outputPath": output_path,
                "mimeType": mime_type,
                "raw": parsed,
            }));
        }
    }

    if provider_pref == "auto" || provider_pref == "openrouter" {
        if let Some(api_key) = review_first_non_empty(vars, &["OPENROUTER_API_KEY"]) {
            let payload = serde_json::json!({
                "model": review_normalize_openrouter_model(&model, "google/gemini-3.1-flash-image-preview"),
                "input": [{
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": prompt,
                        },
                        {
                            "type": "input_image",
                            "image_url": review_image_data_url(&input_path)?,
                        }
                    ]
                }],
                "modalities": ["text", "image"],
                "stream": false,
                "image_config": {
                    "image_size": "1K",
                }
            });
            let endpoint = format!(
                "{}/responses",
                review_first_non_empty(vars, &["OPENROUTER_API_BASE"])
                    .unwrap_or_else(|| "https://openrouter.ai/api/v1".to_string())
            );
            let request = client
                .post(endpoint)
                .bearer_auth(api_key)
                .header("content-type", "application/json");
            let response = review_apply_openrouter_headers(request, vars)
                .json(&payload)
                .send()
                .map_err(|e| format!("OpenRouter preview request failed: {e}"))?;
            let status = response.status();
            let body = response.text().map_err(|e| e.to_string())?;
            if !status.is_success() {
                return Err(format!(
                    "OpenRouter preview request failed ({}): {}",
                    status.as_u16(),
                    body
                ));
            }
            let parsed: serde_json::Value = serde_json::from_str(&body)
                .unwrap_or_else(|_| serde_json::json!({ "raw": body.clone() }));
            let images = review_extract_openrouter_images(&parsed)?;
            let Some((bytes, mime_type)) = images.into_iter().next() else {
                return Err("OpenRouter preview renderer returned no image.".to_string());
            };
            std::fs::write(&output_path, bytes).map_err(|e| e.to_string())?;
            return Ok(serde_json::json!({
                "provider": "openrouter",
                "model": review_normalize_openrouter_model(&model, "google/gemini-3.1-flash-image-preview"),
                "transport": "responses",
                "outputPath": output_path,
                "mimeType": mime_type,
                "raw": parsed,
            }));
        }
    }

    Err("No preview renderer credentials are configured for design review.".to_string())
}

#[tauri::command]
fn run_design_review_provider_request(
    request: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let kind = request
        .get("kind")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    if kind.is_empty() {
        return Err("design review provider request kind missing".to_string());
    }
    let vars = collect_brood_env_snapshot();
    match kind.as_str() {
        "planner" | "upload_analysis" => run_design_review_planner_request(&request, &vars),
        "preview" => run_design_review_preview_request(&request, &vars),
        other => Err(format!(
            "unsupported design review provider request kind: {other}"
        )),
    }
}

fn runtime_channel_label() -> &'static str {
    if find_repo_root_best_effort().is_some() {
        "source_cloner"
    } else {
        "dmg_installer"
    }
}

fn install_telemetry_log_path_from_env() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME env is unavailable".to_string())?;
    let trimmed = home.trim();
    if trimmed.is_empty() {
        return Err("HOME env is empty".to_string());
    }
    Ok(PathBuf::from(trimmed)
        .join(".brood")
        .join("install_events.jsonl"))
}

fn install_telemetry_config_path_from_env() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME env is unavailable".to_string())?;
    let trimmed = home.trim();
    if trimmed.is_empty() {
        return Err("HOME env is empty".to_string());
    }
    Ok(PathBuf::from(trimmed)
        .join(".brood")
        .join("install_telemetry_config.json"))
}

#[tauri::command]
fn get_install_telemetry_defaults() -> Result<serde_json::Value, String> {
    let vars = collect_brood_env_snapshot();
    let disk_config = install_telemetry_config_path_from_env()
        .ok()
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok());
    let disk_opt_in = disk_config
        .as_ref()
        .and_then(|row| row.get("opt_in"))
        .and_then(|row| row.as_bool());
    let disk_force_opt_in = disk_config
        .as_ref()
        .and_then(|row| row.get("force_opt_in"))
        .and_then(|row| row.as_bool());
    let disk_endpoint = disk_config
        .as_ref()
        .and_then(|row| row.get("endpoint"))
        .and_then(|row| row.as_str())
        .map(|row| row.trim().to_string())
        .filter(|row| !row.is_empty());
    let disk_install_id = disk_config
        .as_ref()
        .and_then(|row| row.get("install_id"))
        .and_then(|row| row.as_str())
        .map(|row| row.trim().to_string())
        .filter(|row| !row.is_empty());

    let opt_in = env_flag(vars.get("BROOD_INSTALL_TELEMETRY"))
        .or_else(|| env_flag(vars.get("BROOD_TELEMETRY")))
        .or(disk_opt_in)
        .unwrap_or(false);
    let force_opt_in = env_flag(vars.get("BROOD_INSTALL_TELEMETRY_FORCE"))
        .or(disk_force_opt_in)
        .unwrap_or(false);
    let endpoint = vars
        .get("BROOD_INSTALL_TELEMETRY_ENDPOINT")
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .or(disk_endpoint);
    let install_id = vars
        .get("BROOD_INSTALL_TELEMETRY_INSTALL_ID")
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .or(disk_install_id);

    Ok(serde_json::json!({
        "opt_in_default": opt_in,
        "force_opt_in": force_opt_in,
        "endpoint": endpoint,
        "install_id": install_id,
        "runtime_channel": runtime_channel_label(),
        "app_version": env!("CARGO_PKG_VERSION"),
    }))
}

#[tauri::command]
fn append_install_telemetry_event(
    payload: serde_json::Value,
    max_bytes: Option<u64>,
) -> Result<(), String> {
    let log_path = install_telemetry_log_path_from_env()?;
    if let Some(parent) = log_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let mut line = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    line.push('\n');

    let default_limit = 5_u64 * 1024 * 1024;
    let limit_u64 = max_bytes
        .unwrap_or(default_limit)
        .clamp(8 * 1024, 50 * 1024 * 1024);
    let limit = usize::try_from(limit_u64).unwrap_or(default_limit as usize);

    let existing = std::fs::read_to_string(&log_path).unwrap_or_default();
    let mut merged = existing;
    merged.push_str(&line);
    if merged.len() > limit {
        let start = merged.len().saturating_sub(limit);
        let bytes = &merged.as_bytes()[start..];
        let mut trimmed = String::from_utf8_lossy(bytes).to_string();
        if let Some(first_newline) = trimmed.find('\n') {
            trimmed = trimmed[first_newline + 1..].to_string();
        }
        merged = trimmed;
    }

    std::fs::write(log_path, merged).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_pty_status(state: State<'_, SharedPtyState>) -> Result<serde_json::Value, String> {
    let mut state = state.inner().lock().map_err(|_| "Lock poisoned")?;
    Ok(pty_status_value(&mut state))
}

#[tauri::command]
fn read_file_since(
    path: String,
    offset: u64,
    max_bytes: Option<u64>,
) -> Result<serde_json::Value, String> {
    let limit = max_bytes.unwrap_or(1024 * 1024); // 1MB safety cap per poll
    let mut file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    let metadata = file.metadata().map_err(|e| e.to_string())?;
    let file_len = metadata.len();
    let safe_offset = offset.min(file_len);
    file.seek(SeekFrom::Start(safe_offset))
        .map_err(|e| e.to_string())?;

    let mut buffer = Vec::new();
    // Read up to `limit` bytes to avoid giant allocations if the offset gets reset incorrectly.
    file.take(limit)
        .read_to_end(&mut buffer)
        .map_err(|e| e.to_string())?;
    let new_offset = safe_offset + buffer.len() as u64;
    Ok(serde_json::json!({
        "chunk": buffer,
        "new_offset": new_offset,
        "file_len": file_len,
        "clamped_offset": safe_offset,
    }))
}

#[derive(serde::Deserialize)]
struct BridgeRequest {
    op: String,
    data: Option<String>,
    action: Option<String>,
    payload: Option<serde_json::Value>,
    timeout_ms: Option<u64>,
}

#[derive(serde::Deserialize)]
struct BridgeAutomationResult {
    request_id: String,
    ok: Option<bool>,
    detail: Option<String>,
    state: Option<serde_json::Value>,
    events: Option<Vec<serde_json::Value>>,
    markers: Option<Vec<String>>,
}

#[cfg(target_family = "unix")]
fn write_bridge_response(stream: &mut UnixStream, payload: serde_json::Value) {
    if let Ok(encoded) = serde_json::to_string(&payload) {
        let _ = stream.write_all(encoded.as_bytes());
        let _ = stream.write_all(b"\n");
        let _ = stream.flush();
    }
}

#[cfg(target_family = "unix")]
fn handle_bridge_client(
    mut stream: UnixStream,
    state: SharedPtyState,
    app_handle: tauri::AppHandle,
) {
    let reader_stream = match stream.try_clone() {
        Ok(s) => s,
        Err(_) => return,
    };
    let mut reader = BufReader::new(reader_stream);
    let mut line = String::new();
    loop {
        line.clear();
        let n = match reader.read_line(&mut line) {
            Ok(value) => value,
            Err(_) => break,
        };
        if n == 0 {
            break;
        }
        let req: BridgeRequest = match serde_json::from_str(line.trim()) {
            Ok(value) => value,
            Err(err) => {
                write_bridge_response(
                    &mut stream,
                    serde_json::json!({
                        "ok": false,
                        "error": format!("invalid_json: {err}"),
                    }),
                );
                continue;
            }
        };

        match req.op.as_str() {
            "ping" => {
                write_bridge_response(&mut stream, serde_json::json!({"ok": true}));
            }
            "status" => {
                let mut guard = match state.lock() {
                    Ok(value) => value,
                    Err(_) => {
                        write_bridge_response(
                            &mut stream,
                            serde_json::json!({"ok": false, "error": "lock_poisoned"}),
                        );
                        continue;
                    }
                };
                let status = pty_status_value(&mut guard);
                write_bridge_response(
                    &mut stream,
                    serde_json::json!({
                        "ok": true,
                        "status": status,
                    }),
                );
            }
            "write" => {
                let payload = req.data.unwrap_or_default();
                let mut guard = match state.lock() {
                    Ok(value) => value,
                    Err(_) => {
                        write_bridge_response(
                            &mut stream,
                            serde_json::json!({"ok": false, "error": "lock_poisoned"}),
                        );
                        continue;
                    }
                };
                match write_to_pty(&mut guard, &payload) {
                    Ok(()) => {
                        let status = pty_status_value(&mut guard);
                        write_bridge_response(
                            &mut stream,
                            serde_json::json!({
                                "ok": true,
                                "status": status,
                            }),
                        );
                    }
                    Err(err) => {
                        let status = pty_status_value(&mut guard);
                        write_bridge_response(
                            &mut stream,
                            serde_json::json!({
                                "ok": false,
                                "error": err,
                                "status": status,
                            }),
                        );
                    }
                }
            }
            "automation" => {
                let action = req.action.unwrap_or_default();
                let action_payload = req.payload.unwrap_or_else(|| serde_json::json!({}));
                let wait_ms = req.timeout_ms.unwrap_or(10_000);
                let (request_id, rx) = {
                    let mut guard = match state.lock() {
                        Ok(value) => value,
                        Err(_) => {
                            write_bridge_response(
                                &mut stream,
                                serde_json::json!({"ok": false, "error": "lock_poisoned"}),
                            );
                            continue;
                        }
                    };

                    if action.trim().is_empty() {
                        write_bridge_response(
                            &mut stream,
                            serde_json::json!({"ok": false, "error": "missing_automation_action"}),
                        );
                        continue;
                    }
                    if !guard.automation_frontend_ready {
                        write_bridge_response(
                            &mut stream,
                            serde_json::json!({
                                "ok": false,
                                "error": "automation_frontend_not_ready",
                                "detail": "Desktop UI automation handler is not yet registered. Wait for app UI bootstrap.",
                                "state": pty_status_value(&mut guard),
                                "markers": ["automation_frontend_not_ready"],
                            }),
                        );
                        continue;
                    }

                    let id = format!("{}-{}", process::id(), guard.automation_request_seq);
                    guard.automation_request_seq = guard.automation_request_seq.saturating_add(1);
                    let (sender, receiver) = mpsc::channel();
                    let _ = guard.automation_waiters.insert(id.clone(), sender);
                    (id, receiver)
                };

                let emit_payload = serde_json::json!({
                    "request_id": request_id,
                    "action": action,
                    "payload": action_payload,
                    "timeout_ms": wait_ms,
                });

                eprintln!(
                    "brood desktop bridge automation request {} dispatched (action={})",
                    request_id, action
                );
                let _ = app_handle.emit_all("desktop-automation", emit_payload);
                eprintln!("brood desktop bridge automation event emitted request_id={request_id}");

                let timeout_ms = wait_ms.max(250);
                let timeout = Duration::from_millis(timeout_ms);
                let mut result_payload = match rx.recv_timeout(timeout) {
                    Ok(payload) => payload,
                    Err(_) => {
                        let _ = {
                            if let Ok(mut guard) = state.lock() {
                                guard.automation_waiters.remove(&request_id)
                            } else {
                                None
                            }
                        };
                        serde_json::json!({
                            "ok": false,
                            "error": "automation_timeout",
                            "request_id": request_id,
                            "detail": "Automation operation timed out waiting for app-side result.",
                            "state": serde_json::json!({}),
                            "markers": ["automation_timeout"],
                        })
                    }
                };

                if let Some(map) = result_payload.as_object_mut() {
                    if map.get("request_id").is_none() {
                        map.insert(
                            "request_id".to_string(),
                            serde_json::json!(request_id.clone()),
                        );
                    }
                    if map.get("ok").is_none() {
                        map.insert("ok".to_string(), serde_json::json!(true));
                    }
                } else {
                    result_payload = serde_json::json!({
                        "ok": false,
                        "request_id": request_id,
                        "error": "automation_result_type_invalid",
                    });
                }

                write_bridge_response(&mut stream, result_payload);
            }
            _ => {
                write_bridge_response(
                    &mut stream,
                    serde_json::json!({
                        "ok": false,
                        "error": format!("unsupported_op: {}", req.op),
                    }),
                );
            }
        }
    }
}

#[tauri::command]
fn report_automation_result(
    state: State<'_, SharedPtyState>,
    result: BridgeAutomationResult,
) -> Result<(), String> {
    let request_id = result.request_id.trim().to_string();
    if request_id.is_empty() {
        eprintln!("brood desktop bridge report_automation_result missing request_id");
        return Err("missing request_id".to_string());
    }
    eprintln!("brood desktop bridge received automation result for request_id={request_id}");
    let sender = {
        let mut guard = state.lock().map_err(|_| "lock_poisoned")?;
        guard
            .automation_waiters
            .remove(&request_id)
            .ok_or_else(|| {
                eprintln!(
                    "brood desktop bridge unknown_request_id={request_id}; waiter missing or already timed out"
                );
                "unknown_request_id".to_string()
            })
    }?;

    let mut payload = serde_json::json!({"ok": true, "request_id": request_id});
    if let Some(ok) = result.ok {
        payload["ok"] = serde_json::json!(ok);
    }
    if let Some(detail) = result.detail {
        payload["detail"] = serde_json::json!(detail);
    }
    if let Some(state_payload) = result.state {
        payload["state"] = state_payload;
    }
    if let Some(events) = result.events {
        payload["events"] = serde_json::json!(events);
    }
    if let Some(markers) = result.markers {
        payload["markers"] = serde_json::json!(markers);
    }

    eprintln!("brood desktop bridge automation result accepted request_id={request_id}");
    sender
        .send(payload)
        .map_err(|_| {
            eprintln!(
                "brood desktop bridge automation result send failed request_id={request_id}; receiver dropped"
            );
            "automation_receiver_dropped".to_string()
        })
}

#[tauri::command]
fn report_automation_frontend_ready(
    state: State<'_, SharedPtyState>,
    ready: bool,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|_| "lock_poisoned")?;
    guard.automation_frontend_ready = ready;
    Ok(())
}

fn start_external_bridge(state: SharedPtyState, app_handle: tauri::AppHandle) {
    #[cfg(target_family = "unix")]
    {
        let socket = std::env::var("BROOD_DESKTOP_BRIDGE_SOCKET")
            .unwrap_or_else(|_| "/tmp/brood_desktop_bridge.sock".to_string());
        let socket_path = PathBuf::from(socket);
        if let Some(parent) = socket_path.parent() {
            if std::fs::create_dir_all(parent).is_err() {
                return;
            }
        }
        let _ = std::fs::remove_file(&socket_path);
        let listener = match UnixListener::bind(&socket_path) {
            Ok(value) => value,
            Err(err) => {
                eprintln!("brood desktop bridge bind failed: {err}");
                return;
            }
        };
        let _ = std::fs::set_permissions(&socket_path, std::fs::Permissions::from_mode(0o600));
        std::thread::spawn(move || {
            for incoming in listener.incoming() {
                match incoming {
                    Ok(stream) => {
                        let clone = state.clone();
                        let bridge_handle = app_handle.clone();
                        std::thread::spawn(move || {
                            handle_bridge_client(stream, clone, bridge_handle)
                        });
                    }
                    Err(err) => {
                        eprintln!("brood desktop bridge accept failed: {err}");
                        break;
                    }
                }
            }
        });
    }
    #[cfg(not(target_family = "unix"))]
    {
        let _ = state;
    }
}

#[cfg(target_os = "macos")]
fn apply_macos_native_window_polish(window: &tauri::Window) -> Result<(), String> {
    const NS_VISUAL_EFFECT_MATERIAL_HEADER_VIEW: isize = 10;
    const NS_VISUAL_EFFECT_BLENDING_MODE_BEHIND_WINDOW: isize = 0;
    const NS_VISUAL_EFFECT_STATE_FOLLOWS_WINDOW_ACTIVE_STATE: isize = 0;
    const NS_TITLEBAR_SEPARATOR_STYLE_LINE: isize = 2;

    unsafe {
        let ns_window = window
            .ns_window()
            .map_err(|error| format!("failed to resolve macOS window handle: {error}"))?
            as id;
        if ns_window == nil {
            return Err("macOS window handle was nil".to_string());
        }

        let content_view = ns_window.contentView();
        if content_view == nil {
            return Err("macOS content view was nil".to_string());
        }

        let host_view = {
            let superview = content_view.superview();
            if superview == nil {
                content_view
            } else {
                superview
            }
        };

        // Install a native AppKit material behind the webview so the title bar
        // and traffic-light gutter read like native macOS chrome instead of CSS blur.
        let effect_view: id = msg_send![class!(NSVisualEffectView), alloc];
        let effect_view: id = msg_send![effect_view, initWithFrame: host_view.bounds()];
        if effect_view == nil {
            return Err("failed to allocate NSVisualEffectView".to_string());
        }

        effect_view.setAutoresizingMask_(NSViewWidthSizable | NSViewHeightSizable);
        let aqua_name = NSString::alloc(nil).init_str("NSAppearanceNameAqua");
        let light_appearance: id = msg_send![class!(NSAppearance), appearanceNamed: aqua_name];
        if light_appearance != nil {
            let (): () = msg_send![ns_window, setAppearance: light_appearance];
            let (): () = msg_send![host_view, setAppearance: light_appearance];
            let (): () = msg_send![effect_view, setAppearance: light_appearance];
        }
        let (): () = msg_send![effect_view, setMaterial: NS_VISUAL_EFFECT_MATERIAL_HEADER_VIEW];
        let (): () =
            msg_send![effect_view, setBlendingMode: NS_VISUAL_EFFECT_BLENDING_MODE_BEHIND_WINDOW];
        let (): () = msg_send![
            effect_view,
            setState: NS_VISUAL_EFFECT_STATE_FOLLOWS_WINDOW_ACTIVE_STATE
        ];

        let window_background: id = msg_send![class!(NSColor), windowBackgroundColor];
        ns_window.setOpaque_(NO);
        ns_window.setBackgroundColor_(window_background);
        ns_window.setTitleVisibility_(NSWindowTitleVisibility::NSWindowTitleHidden);
        ns_window.setTitlebarAppearsTransparent_(YES);
        ns_window.setMovableByWindowBackground_(NO);
        let can_set_toolbar_style: BOOL =
            msg_send![ns_window, respondsToSelector: sel!(setToolbarStyle:)];
        if can_set_toolbar_style == YES {
            ns_window.setToolbarStyle_(NSWindowToolbarStyle::NSWindowToolbarStyleUnifiedCompact);
        }
        let can_set_separator_style: BOOL =
            msg_send![ns_window, respondsToSelector: sel!(setTitlebarSeparatorStyle:)];
        if can_set_separator_style == YES {
            let (): () =
                msg_send![ns_window, setTitlebarSeparatorStyle: NS_TITLEBAR_SEPARATOR_STYLE_LINE];
        }

        let relative_view = if host_view == content_view {
            nil
        } else {
            content_view
        };
        let (): () = msg_send![
            host_view,
            addSubview: effect_view
            positioned: NSWindowOrderingMode::NSWindowBelow.bits()
            relativeTo: relative_view
        ];
    }

    Ok(())
}

fn main() {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let pty_state: SharedPtyState = Arc::new(Mutex::new(PtyState::new()));
    let context = tauri::generate_context!();
    let menu = build_app_menu(&context.package_info().name);
    tauri::Builder::default()
        .menu(menu)
        .on_menu_event(|event| match event.menu_item_id() {
            MENU_CANVAS_IMPORT => emit_native_menu_action(&event.window(), "import_photos"),
            MENU_CANVAS_EXPORT_PSD => emit_native_menu_action(&event.window(), "export_psd"),
            MENU_CANVAS_SETTINGS => emit_native_menu_action(&event.window(), "open_settings"),
            _ => {}
        })
        .manage(pty_state)
        .invoke_handler(tauri::generate_handler![
            report_automation_result,
            report_automation_frontend_ready,
            spawn_pty,
            write_pty,
            resize_pty,
            create_run_dir,
            get_repo_root,
            export_run,
            get_key_status,
            get_install_telemetry_defaults,
            append_install_telemetry_event,
            save_openrouter_api_key,
            openrouter_oauth_pkce_sign_in,
            run_design_review_provider_request,
            get_pty_status,
            read_file_since,
        ])
        .setup(|app| {
            let handle = app.handle();
            start_external_bridge(
                app.state::<SharedPtyState>().inner().clone(),
                handle.clone(),
            );
            #[cfg(target_os = "macos")]
            if let Some(main_window) = app.get_window("main") {
                if let Err(error) = apply_macos_native_window_polish(&main_window) {
                    eprintln!("native window polish failed: {error}");
                }
            }
            Ok(())
        })
        .run(context)
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{
        encode_flattened_psd_rgba, is_native_engine_placeholder, push_native_path_candidate,
        resolve_existing_env_binary_path, review_build_openai_planner_payload,
        review_build_openai_planner_ws_event, review_format_planner_http_error,
        review_normalize_planner_model, EngineProgramCandidate,
        DESIGN_REVIEW_OPENROUTER_PLANNER_MODEL, DESIGN_REVIEW_PLANNER_MODEL,
    };

    #[test]
    fn flattened_psd_encoder_writes_expected_header_and_planes() {
        let bytes = encode_flattened_psd_rgba(1, 2, &[1, 2, 3, 4, 5, 6, 7, 8]).unwrap();
        assert_eq!(&bytes[0..4], b"8BPS");
        assert_eq!(u16::from_be_bytes([bytes[4], bytes[5]]), 1);
        assert_eq!(u16::from_be_bytes([bytes[12], bytes[13]]), 4);
        assert_eq!(
            u32::from_be_bytes([bytes[14], bytes[15], bytes[16], bytes[17]]),
            2
        );
        assert_eq!(
            u32::from_be_bytes([bytes[18], bytes[19], bytes[20], bytes[21]]),
            1
        );
        assert_eq!(u16::from_be_bytes([bytes[22], bytes[23]]), 8);
        assert_eq!(u16::from_be_bytes([bytes[24], bytes[25]]), 3);
        assert_eq!(u16::from_be_bytes([bytes[38], bytes[39]]), 0);
        assert_eq!(&bytes[40..48], &[1, 5, 2, 6, 3, 7, 4, 8]);
    }

    #[test]
    fn flattened_psd_encoder_rejects_wrong_rgba_length() {
        let err = encode_flattened_psd_rgba(2, 1, &[1, 2, 3]).unwrap_err();
        assert!(err.contains("expected 8 rgba bytes"));
    }

    fn temp_file_path(name: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|row| row.as_nanos())
            .unwrap_or(0);
        std::env::temp_dir().join(format!("brood-tauri-test-{stamp}-{name}"))
    }

    #[test]
    fn placeholder_candidate_is_skipped() {
        let path = temp_file_path("stub-brood-rs");
        let _ = std::fs::remove_file(&path);
        std::fs::write(
            &path,
            "#!/usr/bin/env bash\n# BROOD_RS_PLACEHOLDER_STUB\necho \"brood-rs resource not staged\" >&2\nexit 1\n",
        )
        .expect("write placeholder");
        let mut candidates: Vec<EngineProgramCandidate> = Vec::new();
        push_native_path_candidate(&mut candidates, path.clone(), "stub");
        assert!(is_native_engine_placeholder(&path));
        assert!(candidates.is_empty());
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn real_candidate_is_kept() {
        let path = temp_file_path("real-brood-rs");
        let _ = std::fs::remove_file(&path);
        std::fs::write(&path, b"\x7fELFnot-a-real-binary").expect("write binary");
        let mut candidates: Vec<EngineProgramCandidate> = Vec::new();
        push_native_path_candidate(&mut candidates, path.clone(), "real");
        assert!(!is_native_engine_placeholder(&path));
        assert_eq!(candidates.len(), 1);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn resolve_existing_env_binary_path_canonicalizes_relative_paths() {
        let cwd = std::env::current_dir().expect("cwd");
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|row| row.as_nanos())
            .unwrap_or(0);
        let filename = format!("brood-tauri-rel-bin-{stamp}");
        let full = cwd.join(&filename);
        let _ = std::fs::remove_file(&full);
        std::fs::write(&full, b"\x7fELFnot-a-real-binary").expect("write binary");

        let resolved =
            resolve_existing_env_binary_path(&filename).expect("resolve relative env binary path");
        let expected = std::fs::canonicalize(&full).unwrap_or(full.clone());
        assert_eq!(resolved, expected);

        let _ = std::fs::remove_file(full);
    }

    #[test]
    fn openai_planner_payload_uses_xhigh_reasoning_and_high_detail_images() {
        let payload = review_build_openai_planner_payload(
            "Plan the next edit.",
            &[
                "data:image/png;base64,AAAA".to_string(),
                "https://example.com/ref.png".to_string(),
            ],
            DESIGN_REVIEW_PLANNER_MODEL,
        );

        assert_eq!(
            payload.get("model").and_then(|value| value.as_str()),
            Some("gpt-5.4")
        );
        assert_eq!(
            payload
                .pointer("/reasoning/effort")
                .and_then(|value| value.as_str()),
            Some("xhigh")
        );
        assert_eq!(
            payload
                .pointer("/input/0/content/1/detail")
                .and_then(|value| value.as_str()),
            Some("high")
        );
        assert_eq!(
            payload
                .pointer("/input/0/content/2/detail")
                .and_then(|value| value.as_str()),
            Some("high")
        );
    }

    #[test]
    fn openai_planner_ws_event_uses_response_create_and_previous_response_id() {
        let event = review_build_openai_planner_ws_event(
            "Plan the next edit.",
            &["data:image/png;base64,AAAA".to_string()],
            DESIGN_REVIEW_PLANNER_MODEL,
            Some("resp_prev_123"),
        );

        assert_eq!(
            event.get("type").and_then(|value| value.as_str()),
            Some("response.create")
        );
        assert_eq!(
            event.get("store").and_then(|value| value.as_bool()),
            Some(false)
        );
        assert_eq!(
            event
                .pointer("/input/0/type")
                .and_then(|value| value.as_str()),
            Some("message")
        );
        assert_eq!(
            event
                .get("previous_response_id")
                .and_then(|value| value.as_str()),
            Some("resp_prev_123")
        );
    }

    #[test]
    fn planner_model_normalization_uses_openai_gpt_5_4_for_openrouter() {
        assert_eq!(
            review_normalize_planner_model("", "openai"),
            DESIGN_REVIEW_PLANNER_MODEL
        );
        assert_eq!(
            review_normalize_planner_model("gpt-5.4-vision", "openai"),
            DESIGN_REVIEW_PLANNER_MODEL
        );
        assert_eq!(
            review_normalize_planner_model("openai/gpt-5.4", "openai"),
            DESIGN_REVIEW_PLANNER_MODEL
        );
        assert_eq!(
            review_normalize_planner_model("gpt-5.4", "openrouter"),
            DESIGN_REVIEW_OPENROUTER_PLANNER_MODEL
        );
        assert_eq!(
            review_normalize_planner_model("openai/gpt-5.4-vision", "openrouter"),
            DESIGN_REVIEW_OPENROUTER_PLANNER_MODEL
        );
    }

    #[test]
    fn planner_error_message_flags_invalid_or_expired_openrouter_auth() {
        let message = review_format_planner_http_error(
            "openrouter",
            DESIGN_REVIEW_OPENROUTER_PLANNER_MODEL,
            401,
            r#"{"error":{"message":"User not found"}}"#,
        );

        assert!(message.contains("configured OpenRouter key is invalid or expired"));
        assert!(message.contains("provider=openrouter"));
        assert!(message.contains("normalized model=openai/gpt-5.4"));
    }

    #[test]
    fn planner_error_message_includes_normalized_model_for_invalid_model_ids() {
        let message = review_format_planner_http_error(
            "openrouter",
            "openai/gpt-5.4-vision",
            400,
            r#"{"error":{"message":"openai/gpt-5.4-vision is not a valid model ID"}}"#,
        );

        assert!(message.contains("invalid model id"));
        assert!(message.contains("provider openrouter"));
        assert!(message.contains("normalized model=openai/gpt-5.4-vision"));
    }
}
