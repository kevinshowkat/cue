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
use rand::rngs::OsRng;
use rand::RngCore;
use reqwest::blocking::Client;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet, VecDeque};
use std::io::{BufRead, BufReader};
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::TcpListener;
use std::net::TcpStream;
#[cfg(target_family = "unix")]
use std::os::unix::fs::PermissionsExt;
#[cfg(target_family = "unix")]
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::{Path, PathBuf};
use std::process::{self, Stdio};
use std::sync::mpsc;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant, UNIX_EPOCH};
use tauri::{AboutMetadata, CustomMenuItem, Manager, Menu, MenuItem, State, Submenu};
use tungstenite::client::IntoClientRequest;
use tungstenite::stream::MaybeTlsStream;
use tungstenite::{connect, Message, WebSocket};
use url::Url;

const MENU_FILE_NEW_SESSION: &str = "file_new_session";
const MENU_FILE_OPEN_SESSION: &str = "file_open_session";
const MENU_FILE_SAVE_SESSION: &str = "file_save_session";
const MENU_FILE_CLOSE_SESSION: &str = "file_close_session";
const MENU_FILE_IMPORT_PHOTOS: &str = "file_import_photos";
const MENU_FILE_EXPORT_SESSION: &str = "file_export_session";
const MENU_FILE_SETTINGS: &str = "file_settings";
const MENU_SETTINGS_ICON_PACK_DEFAULT_CLASSIC: &str = "settings_icon_pack_default_classic";
const MENU_SETTINGS_ICON_PACK_OSCILLO_INK: &str = "settings_icon_pack_oscillo_ink";
const MENU_SETTINGS_ICON_PACK_INDUSTRIAL_MONO: &str = "settings_icon_pack_industrial_mono";
const MENU_SETTINGS_ICON_PACK_PAINTERLY_FOLK: &str = "settings_icon_pack_painterly_folk";
const MENU_SETTINGS_ICON_PACK_KINETIC_MARKER: &str = "settings_icon_pack_kinetic_marker";
const MENU_TOOLS_CREATE_TOOL: &str = "tools_create_tool";
const MENU_TOOLS_SLOT_PREFIX: &str = "tools_slot_";
const MENU_SHORTCUTS_SLOT_PREFIX: &str = "shortcuts_slot_";
const NATIVE_TOOLS_SLOT_COUNT: usize = 8;
const NATIVE_SHORTCUTS_SLOT_COUNT: usize = 9;
const NATIVE_MENU_ACTION_EVENT: &str = "native-menu-action";
const DESIGN_REVIEW_PLANNER_MODEL: &str = "gpt-5.4";
const DESIGN_REVIEW_OPENROUTER_PLANNER_MODEL: &str = "openai/gpt-5.4";
// Provider-facing Gemini model id for the final apply path (marketed as Nano Banana 2).
const DESIGN_REVIEW_APPLY_MODEL: &str = "gemini-3.1-flash-image-preview";
const REVIEW_OPENAI_RESPONSES_WS_TRANSPORT: &str = "responses_websocket";
const REVIEW_OPENAI_RESPONSES_HTTP_TRANSPORT: &str = "responses_http";
const REVIEW_OPENAI_RESPONSES_HTTP_FALLBACK_TRANSPORT: &str = "responses_http_fallback";
const REVIEW_OPENROUTER_CHAT_COMPLETIONS_TRANSPORT: &str = "chat_completions";
const REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT: &str = "generate_content";
const REVIEW_OPENROUTER_RESPONSES_TRANSPORT: &str = "responses";
// GPT-5.4 planner responses can pause for longer stretches between websocket
// events on image-heavy reviews; keep the transport budget loose enough to
// avoid false timeouts without turning real hangs into multi-minute waits.
const REVIEW_OPENAI_RESPONSES_WS_IO_TIMEOUT: Duration = Duration::from_secs(45);
const REVIEW_OPENAI_RESPONSES_WS_FIRST_EVENT_TIMEOUT: Duration = Duration::from_secs(45);
const REVIEW_OPENAI_RESPONSES_WS_COMPLETION_TIMEOUT: Duration = Duration::from_secs(90);
const REVIEW_FAST_PLANNER_HTTP_TIMEOUT: Duration = Duration::from_secs(45);
const REVIEW_STANDARD_PLANNER_HTTP_TIMEOUT: Duration = Duration::from_secs(90);
const MAGIC_SELECT_LOCAL_CONTRACT: &str = "juggernaut.magic_select.local.prepared.v1";
const MAGIC_SELECT_LOCAL_PREPARE_ACTION: &str = "magic_select_prepare";
const MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION: &str = "magic_select_warm_click";
const MAGIC_SELECT_LOCAL_RELEASE_ACTION: &str = "magic_select_release";
const MAGIC_SELECT_LOCAL_DEFAULT_MODEL_ID: &str = "mobile_sam_vit_t";
const MAGIC_SELECT_LOCAL_DEFAULT_HELPER_SCRIPT: &str = "scripts/magic_select_mobile_sam.py";
const MAGIC_SELECT_LOCAL_DEFAULT_PYTHON: &str = "python3";
const MAGIC_SELECT_LOCAL_DEFAULT_MASK_THRESHOLD: u8 = 127;
const MAGIC_SELECT_LOCAL_DEFAULT_MAX_CONTOUR_POINTS: usize = 256;
const MAGIC_SELECT_LOCAL_STDERR_TAIL_LINES: usize = 64;
const DESKTOP_SESSION_COMMAND_CONTRACT: &str = "cue.desktop.session.command.v1";
const DESKTOP_SESSION_UPDATE_CONTRACT: &str = "cue.desktop.session.update.v1";
const DESKTOP_SESSION_UPDATE_EVENT: &str = "cue-desktop-session-update";
const DESKTOP_SESSION_ACTION_START: &str = "session.start";
const DESKTOP_SESSION_ACTION_DISPATCH: &str = "session.dispatch";
const DESKTOP_SESSION_ACTION_STATUS: &str = "session.status";
const DESKTOP_SESSION_ACTION_STOP: &str = "session.stop";
const DESKTOP_SESSION_UPDATE_KIND_STATUS: &str = "status";
const DESKTOP_SESSION_UPDATE_KIND_EVENT: &str = "event";
const DESKTOP_SESSION_PHASE_STARTING: &str = "starting";
const DESKTOP_SESSION_PHASE_READY: &str = "ready";
const DESKTOP_SESSION_PHASE_STOPPED: &str = "stopped";
const DESKTOP_SESSION_PHASE_ERROR: &str = "error";
const DESKTOP_MODEL_PACK_INSTALL_CONTRACT: &str = "cue.desktop.model-pack.install.v1";
const DESKTOP_MODEL_PACK_UPDATE_CONTRACT: &str = "cue.desktop.model-pack.update.v1";
const DESKTOP_MODEL_PACK_UPDATE_EVENT: &str = "cue-desktop-model-pack-update";
const DESKTOP_MODEL_PACK_ACTION_STATUS: &str = "pack.status";
const DESKTOP_MODEL_PACK_INSTALL_ACTION: &str = "pack.install";
const DESKTOP_MODEL_PACK_UPDATE_KIND_MODEL_PACK: &str = "model_pack";
const DESKTOP_MODEL_PACK_STATUS_LOCKED: &str = "locked";
const DESKTOP_MODEL_PACK_STATUS_AVAILABLE: &str = "available";
const DESKTOP_MODEL_PACK_STATUS_INSTALLING: &str = "installing";
const DESKTOP_MODEL_PACK_STATUS_INSTALLED: &str = "installed";
const DESKTOP_MODEL_PACK_STATUS_INSTALL_FAILED: &str = "install_failed";
const DESKTOP_MODEL_PACK_PHASE_ENTITLEMENT_CHECK: &str = "entitlement_check";
const DESKTOP_MODEL_PACK_PHASE_VERIFY: &str = "verify";
const DESKTOP_MODEL_PACK_PHASE_INSTALL: &str = "install";
const DESKTOP_MODEL_PACK_PHASE_INSTALLED: &str = "installed";
const MAGIC_SELECT_LOCAL_PACK_ID: &str = "cue.magic-select";
const MAGIC_SELECT_LOCAL_PACK_VERSION: &str = "1.0.0";
const MAGIC_SELECT_LOCAL_PACK_MANIFEST_SCHEMA: &str = "cue.model-pack-manifest.v1";
const MAGIC_SELECT_LOCAL_PACK_MANIFEST_FILENAME: &str = "manifest.json";

fn build_placeholder_menu(prefix: &str, slot_count: usize, label_prefix: &str) -> Menu {
    let mut menu = Menu::new();
    for index in 0..slot_count {
        menu = menu.add_item(
            CustomMenuItem::new(
                format!("{prefix}{index}"),
                format!("{label_prefix} {}", index + 1),
            )
            .disabled(),
        );
    }
    menu
}

fn build_file_menu() -> Menu {
    let new_session = CustomMenuItem::new(MENU_FILE_NEW_SESSION.to_string(), "New Session")
        .accelerator("CmdOrCtrl+N");
    let open_session = CustomMenuItem::new(MENU_FILE_OPEN_SESSION.to_string(), "Open Session…")
        .accelerator("CmdOrCtrl+O");
    let save_session = CustomMenuItem::new(MENU_FILE_SAVE_SESSION.to_string(), "Save Session")
        .accelerator("CmdOrCtrl+S");
    let close_session = CustomMenuItem::new(MENU_FILE_CLOSE_SESSION.to_string(), "Close Session")
        .accelerator("CmdOrCtrl+Shift+W");
    let import_photos = CustomMenuItem::new(MENU_FILE_IMPORT_PHOTOS.to_string(), "Import Photos…");
    let export_session =
        CustomMenuItem::new(MENU_FILE_EXPORT_SESSION.to_string(), "Export Session…")
            .accelerator("CmdOrCtrl+Shift+E");
    let settings =
        CustomMenuItem::new(MENU_FILE_SETTINGS.to_string(), "Settings…").accelerator("CmdOrCtrl+,");

    #[allow(unused_mut)]
    let mut file_menu = Menu::new()
        .add_item(new_session)
        .add_item(open_session)
        .add_item(save_session)
        .add_item(close_session)
        .add_native_item(MenuItem::Separator)
        .add_item(import_photos)
        .add_item(export_session)
        .add_native_item(MenuItem::Separator)
        .add_item(settings)
        .add_native_item(MenuItem::Separator)
        .add_native_item(MenuItem::CloseWindow);

    #[cfg(not(target_os = "macos"))]
    {
        file_menu = file_menu.add_native_item(MenuItem::Quit);
    }

    file_menu
}

fn build_tools_menu() -> Menu {
    let create_tool = CustomMenuItem::new(MENU_TOOLS_CREATE_TOOL.to_string(), "Create Tool");
    let slot_labels = [
        "Marker",
        "Highlight",
        "Magic Select",
        "Stamp",
        "Eraser",
        "Custom Tool Slot 1",
        "Custom Tool Slot 2",
        "Custom Tool Slot 3",
    ];
    let mut menu = Menu::new()
        .add_item(create_tool)
        .add_native_item(MenuItem::Separator);
    for index in 0..NATIVE_TOOLS_SLOT_COUNT {
        menu = menu.add_item(
            CustomMenuItem::new(
                format!("{MENU_TOOLS_SLOT_PREFIX}{index}"),
                slot_labels
                    .get(index)
                    .copied()
                    .unwrap_or("Tool Slot")
                    .to_string(),
            )
            .disabled(),
        );
    }
    menu
}

fn build_shortcuts_menu() -> Menu {
    build_placeholder_menu(
        MENU_SHORTCUTS_SLOT_PREFIX,
        NATIVE_SHORTCUTS_SLOT_COUNT,
        "Shortcut Slot",
    )
}

fn native_iconography_menu_items() -> [(&'static str, &'static str, &'static str); 5] {
    [
        (
            "default_classic",
            MENU_SETTINGS_ICON_PACK_DEFAULT_CLASSIC,
            "Default",
        ),
        (
            "oscillo_ink",
            MENU_SETTINGS_ICON_PACK_OSCILLO_INK,
            "Oscillo / Cuphead",
        ),
        (
            "industrial_mono",
            MENU_SETTINGS_ICON_PACK_INDUSTRIAL_MONO,
            "Jony Ive",
        ),
        (
            "painterly_folk",
            MENU_SETTINGS_ICON_PACK_PAINTERLY_FOLK,
            "Frida Kahlo",
        ),
        (
            "kinetic_marker",
            MENU_SETTINGS_ICON_PACK_KINETIC_MARKER,
            "Michael Jordan",
        ),
    ]
}

fn active_iconography_menu_title(pack_id: &str, active_pack_id: &str, label: &str) -> String {
    if pack_id == active_pack_id {
        format!("[x] {label}")
    } else {
        label.to_string()
    }
}

fn build_settings_menu() -> Menu {
    let active_pack_id = "default_classic";
    let mut menu = Menu::new();
    for (pack_id, menu_id, label) in native_iconography_menu_items() {
        menu = menu.add_item(CustomMenuItem::new(
            menu_id.to_string(),
            active_iconography_menu_title(pack_id, active_pack_id, label),
        ));
    }
    menu
}

fn build_app_menu(app_name: &str) -> Menu {
    let mut menu = Menu::new();

    #[cfg(target_os = "macos")]
    {
        menu = menu.add_submenu(Submenu::new(
            app_name,
            Menu::new()
                .add_native_item(MenuItem::About(
                    app_name.to_string(),
                    AboutMetadata::default(),
                ))
                .add_native_item(MenuItem::Separator)
                .add_native_item(MenuItem::Services)
                .add_native_item(MenuItem::Separator)
                .add_native_item(MenuItem::Hide)
                .add_native_item(MenuItem::HideOthers)
                .add_native_item(MenuItem::ShowAll)
                .add_native_item(MenuItem::Separator)
                .add_native_item(MenuItem::Quit),
        ));
    }

    menu = menu.add_submenu(Submenu::new("File", build_file_menu()));

    #[cfg(not(target_os = "linux"))]
    {
        let mut edit_menu = Menu::new();
        #[cfg(target_os = "macos")]
        {
            edit_menu = edit_menu.add_native_item(MenuItem::Undo);
            edit_menu = edit_menu.add_native_item(MenuItem::Redo);
            edit_menu = edit_menu.add_native_item(MenuItem::Separator);
        }
        edit_menu = edit_menu.add_native_item(MenuItem::Cut);
        edit_menu = edit_menu.add_native_item(MenuItem::Copy);
        edit_menu = edit_menu.add_native_item(MenuItem::Paste);
        #[cfg(target_os = "macos")]
        {
            edit_menu = edit_menu.add_native_item(MenuItem::SelectAll);
        }
        menu = menu.add_submenu(Submenu::new("Edit", edit_menu));
    }

    #[cfg(target_os = "macos")]
    {
        menu = menu.add_submenu(Submenu::new(
            "View",
            Menu::new().add_native_item(MenuItem::EnterFullScreen),
        ));
    }

    menu = menu.add_submenu(Submenu::new("Tools", build_tools_menu()));
    menu = menu.add_submenu(Submenu::new("Shortcuts", build_shortcuts_menu()));

    let mut window_menu = Menu::new().add_native_item(MenuItem::Minimize);
    #[cfg(target_os = "macos")]
    {
        window_menu = window_menu.add_native_item(MenuItem::Zoom);
        window_menu = window_menu.add_native_item(MenuItem::Separator);
    }
    window_menu = window_menu.add_native_item(MenuItem::CloseWindow);
    menu = menu.add_submenu(Submenu::new("Window", window_menu));
    menu.add_submenu(Submenu::new("Settings", build_settings_menu()))
}

fn emit_native_menu_action(window: &tauri::Window, action: &str) {
    let payload = serde_json::json!({ "action": action });
    let _ = window.emit(NATIVE_MENU_ACTION_EVENT, payload);
}

#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeMenuSlotPayload {
    #[serde(default)]
    label: String,
    #[serde(default)]
    enabled: bool,
}

#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeMenuFileStatePayload {
    #[serde(default)]
    can_new_session: bool,
    #[serde(default)]
    can_open_session: bool,
    #[serde(default)]
    can_save_session: bool,
    #[serde(default)]
    can_close_session: bool,
    #[serde(default)]
    can_export_session: bool,
    #[serde(default)]
    can_import_photos: bool,
    #[serde(default)]
    can_open_settings: bool,
}

#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeMenuStatePayload {
    #[serde(default)]
    file: NativeMenuFileStatePayload,
    #[serde(default)]
    tools: Vec<NativeMenuSlotPayload>,
    #[serde(default)]
    shortcuts: Vec<NativeMenuSlotPayload>,
}

fn update_native_menu_item(
    window: &tauri::Window,
    id: &str,
    title: Option<&str>,
    enabled: Option<bool>,
) {
    let handle = window.menu_handle();
    let Some(item) = handle.try_get_item(id) else {
        return;
    };
    if let Some(title) = title {
        let _ = item.set_title(title.to_string());
    }
    if let Some(enabled) = enabled {
        let _ = item.set_enabled(enabled);
    }
}

fn sync_native_menu_slots(
    window: &tauri::Window,
    prefix: &str,
    slot_count: usize,
    fallback_prefix: &str,
    entries: &[NativeMenuSlotPayload],
) {
    for index in 0..slot_count {
        let entry = entries.get(index);
        let label = entry
            .map(|entry| entry.label.trim())
            .filter(|label| !label.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| format!("{fallback_prefix} {}", index + 1));
        let enabled = entry.map(|entry| entry.enabled).unwrap_or(false);
        update_native_menu_item(
            window,
            &format!("{prefix}{index}"),
            Some(&label),
            Some(enabled),
        );
    }
}

fn sync_native_iconography_menu_titles(window: &tauri::Window, active_pack_id: &str) {
    for (pack_id, menu_id, label) in native_iconography_menu_items() {
        let title = active_iconography_menu_title(pack_id, active_pack_id, label);
        update_native_menu_item(window, menu_id, Some(&title), Some(true));
    }
}

#[tauri::command]
fn sync_native_menu_state(
    window: tauri::Window,
    payload: NativeMenuStatePayload,
) -> Result<(), String> {
    update_native_menu_item(
        &window,
        MENU_FILE_NEW_SESSION,
        None,
        Some(payload.file.can_new_session),
    );
    update_native_menu_item(
        &window,
        MENU_FILE_OPEN_SESSION,
        None,
        Some(payload.file.can_open_session),
    );
    update_native_menu_item(
        &window,
        MENU_FILE_SAVE_SESSION,
        None,
        Some(payload.file.can_save_session),
    );
    update_native_menu_item(
        &window,
        MENU_FILE_CLOSE_SESSION,
        None,
        Some(payload.file.can_close_session),
    );
    update_native_menu_item(
        &window,
        MENU_FILE_IMPORT_PHOTOS,
        None,
        Some(payload.file.can_import_photos),
    );
    update_native_menu_item(
        &window,
        MENU_FILE_EXPORT_SESSION,
        None,
        Some(payload.file.can_export_session),
    );
    update_native_menu_item(
        &window,
        MENU_FILE_SETTINGS,
        None,
        Some(payload.file.can_open_settings),
    );
    sync_native_menu_slots(
        &window,
        MENU_TOOLS_SLOT_PREFIX,
        NATIVE_TOOLS_SLOT_COUNT,
        "Tool Slot",
        &payload.tools,
    );
    sync_native_menu_slots(
        &window,
        MENU_SHORTCUTS_SLOT_PREFIX,
        NATIVE_SHORTCUTS_SLOT_COUNT,
        "Shortcut Slot",
        &payload.shortcuts,
    );
    Ok(())
}

#[tauri::command]
fn sync_native_iconography_menu(
    window: tauri::Window,
    active_pack_id: String,
) -> Result<(), String> {
    sync_native_iconography_menu_titles(&window, active_pack_id.trim());
    Ok(())
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
    if let Some(root) = first_non_empty_env(&["CUE_REPO_ROOT", "BROOD_REPO_ROOT"]) {
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

fn remove_dotenv_key(path: &Path, key: &str) -> Result<bool, String> {
    if !path.exists() {
        return Ok(false);
    }

    let original = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut removed = false;
    let mut lines: Vec<String> = Vec::new();

    for raw_line in original.lines() {
        let trimmed = raw_line.trim();
        let normalized = if let Some(stripped) = trimmed.strip_prefix("export ") {
            stripped.trim()
        } else {
            trimmed
        };
        let matches_key = normalized
            .split_once('=')
            .map(|(existing_key, _)| existing_key.trim() == key)
            .unwrap_or(false);
        if matches_key {
            removed = true;
            continue;
        }
        lines.push(raw_line.to_string());
    }

    if !removed {
        return Ok(false);
    }

    while lines
        .last()
        .map(|line| line.trim().is_empty())
        .unwrap_or(false)
    {
        lines.pop();
    }

    let mut rendered = lines.join("\n");
    if !rendered.is_empty() {
        rendered.push('\n');
    }
    std::fs::write(path, rendered).map_err(|e| e.to_string())?;
    Ok(true)
}

fn first_non_empty_env(keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        std::env::var(key)
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
    })
}

fn first_present_env(keys: &[&str]) -> Option<(String, String)> {
    keys.iter().find_map(|key| {
        std::env::var(key)
            .ok()
            .map(|value| ((*key).to_string(), value))
    })
}

fn home_config_dir_candidates() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(raw) = first_non_empty_env(&["CUE_HOME_DIR", "BROOD_HOME_DIR"]) {
        dirs.push(PathBuf::from(raw));
    }
    if let Some(home) =
        tauri::api::path::home_dir().or_else(|| std::env::var("HOME").ok().map(PathBuf::from))
    {
        let cue_dir = home.join(".cue");
        if !dirs.iter().any(|path| path == &cue_dir) {
            dirs.push(cue_dir);
        }
        let legacy_dir = home.join(".brood");
        if !dirs.iter().any(|path| path == &legacy_dir) {
            dirs.push(legacy_dir);
        }
    }
    dirs
}

fn preferred_home_config_dir() -> Option<PathBuf> {
    home_config_dir_candidates().into_iter().next()
}

fn preferred_model_pack_root() -> Result<PathBuf, String> {
    let config_dir = preferred_home_config_dir().ok_or("No home dir")?;
    Ok(config_dir.join("model-packs"))
}

fn merge_known_dotenv_layers(target: &mut HashMap<String, String>) {
    for dir in home_config_dir_candidates() {
        merge_dotenv_vars(target, &dir.join(".env"));
    }
}

fn preferred_run_root() -> Result<PathBuf, String> {
    if let Some(raw) = first_non_empty_env(&["CUE_RUN_ROOT", "BROOD_RUN_ROOT"]) {
        return Ok(PathBuf::from(raw));
    }
    let home = tauri::api::path::home_dir()
        .or_else(|| std::env::var("HOME").ok().map(PathBuf::from))
        .ok_or("No home dir")?;
    Ok(home.join("cue_runs"))
}

fn env_value<'a>(vars: &'a HashMap<String, String>, keys: &[&str]) -> Option<&'a String> {
    keys.iter()
        .find_map(|key| vars.get(*key).filter(|value| !value.trim().is_empty()))
}

fn collect_brood_env_snapshot() -> HashMap<String, String> {
    let mut vars: HashMap<String, String> = std::env::vars().collect();

    merge_known_dotenv_layers(&mut vars);

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

    let config_dir = preferred_home_config_dir().ok_or("No home dir")?;
    std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    let env_path = config_dir.join(".env");
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

#[tauri::command]
fn clear_openrouter_api_key() -> Result<serde_json::Value, String> {
    let env_path = preferred_home_config_dir()
        .ok_or("No home dir")?
        .join(".env");
    let removed = remove_dotenv_key(&env_path, "OPENROUTER_API_KEY")?;
    std::env::remove_var("OPENROUTER_API_KEY");
    Ok(serde_json::json!({
        "ok": true,
        "removed": removed,
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
         <body><div class=\"card\"><h1>{title}</h1><p>{body}</p><p>You can close this window and return to Cue.</p></div></body></html>"
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
                        "State validation failed. Please retry from Cue.",
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
                        "Authorization code was missing. Please retry from Cue.",
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

fn command_exit_detail(status: process::ExitStatus) -> String {
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

    for env_key in [
        "CUE_RS_BIN",
        "CUE_ENGINE_BINARY",
        "BROOD_RS_BIN",
        "BROOD_ENGINE_BINARY",
    ] {
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
    writer: Option<process::ChildStdin>,
    child: Option<process::Child>,
    run_dir: Option<String>,
    events_path: Option<String>,
    launch_mode: Option<String>,
    launch_label: Option<String>,
    last_exit_detail: Option<String>,
    last_error: Option<String>,
    session_seq: u64,
    automation_frontend_ready: bool,
    automation_request_seq: u64,
    automation_waiters: HashMap<String, mpsc::Sender<serde_json::Value>>,
}

impl PtyState {
    fn new() -> Self {
        Self {
            writer: None,
            child: None,
            run_dir: None,
            events_path: None,
            launch_mode: None,
            launch_label: None,
            last_exit_detail: None,
            last_error: None,
            session_seq: 0,
            automation_frontend_ready: false,
            automation_request_seq: 0,
            automation_waiters: HashMap::new(),
        }
    }
}

type SharedPtyState = Arc<Mutex<PtyState>>;

#[derive(Debug, Clone, Default)]
struct DesktopModelPackRecord {
    request_id: Option<String>,
    status: Option<String>,
    phase: Option<String>,
    completed_bytes: Option<u64>,
    total_bytes: Option<u64>,
    detail: Option<String>,
    pack_version: Option<String>,
    manifest_path: Option<String>,
    model_ids: Vec<String>,
    warnings: Vec<String>,
}

#[derive(Debug, Default)]
struct DesktopModelPackState {
    packs: HashMap<String, DesktopModelPackRecord>,
}

type SharedDesktopModelPackState = Arc<Mutex<DesktopModelPackState>>;

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
        return Err("desktop session runtime not running".to_string());
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
    let mut last_exit_detail = state.last_exit_detail.clone();
    let mut last_error = state.last_error.clone();

    if let Some(child) = state.child.as_mut() {
        pid = Some(child.id());
        match child.try_wait() {
            Ok(Some(status)) => {
                has_child = false;
                last_exit_detail = Some(command_exit_detail(status));
                state.child = None;
                state.writer = None;
                state.run_dir = None;
                state.events_path = None;
                state.launch_mode = None;
                state.launch_label = None;
                state.last_exit_detail = last_exit_detail.clone();
                state.last_error = None;
            }
            Ok(None) => {
                child_running = true;
            }
            Err(err) => {
                child_running = true;
                last_error = Some(err.to_string());
                state.last_error = last_error.clone();
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
        "launch_mode": state.launch_mode.clone(),
        "launch_label": state.launch_label.clone(),
        "last_exit_detail": last_exit_detail,
        "last_error": last_error,
    })
}

fn clear_runtime_session(state: &mut PtyState) {
    if let Some(mut child) = state.child.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    state.writer = None;
    state.run_dir = None;
    state.events_path = None;
    state.launch_mode = None;
    state.launch_label = None;
    state.last_exit_detail = None;
    state.last_error = None;
    state.session_seq = state.session_seq.saturating_add(1);
}

fn default_events_path_for_run_dir(run_dir: &str) -> String {
    Path::new(run_dir)
        .join("events.jsonl")
        .to_string_lossy()
        .to_string()
}

fn quote_cli_arg(value: &str) -> String {
    let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{escaped}\"")
}

fn emit_desktop_session_status_update(
    app_handle: &tauri::AppHandle,
    run_dir: &str,
    phase: &str,
    launch_mode: Option<&str>,
    launch_label: Option<&str>,
    detail: Option<&str>,
) {
    let payload = serde_json::json!({
        "contract": DESKTOP_SESSION_UPDATE_CONTRACT,
        "kind": DESKTOP_SESSION_UPDATE_KIND_STATUS,
        "session": {
            "runDir": run_dir,
        },
        "runtime": {
            "phase": phase,
            "running": phase == DESKTOP_SESSION_PHASE_READY,
        },
        "launch": {
            "mode": launch_mode,
            "label": launch_label,
        },
        "detail": detail,
    });
    let _ = app_handle.emit_all(DESKTOP_SESSION_UPDATE_EVENT, payload);
}

fn emit_desktop_session_event_update(
    app_handle: &tauri::AppHandle,
    run_dir: &str,
    event: serde_json::Value,
) {
    let payload = serde_json::json!({
        "contract": DESKTOP_SESSION_UPDATE_CONTRACT,
        "kind": DESKTOP_SESSION_UPDATE_KIND_EVENT,
        "session": {
            "runDir": run_dir,
        },
        "event": event,
    });
    let _ = app_handle.emit_all(DESKTOP_SESSION_UPDATE_EVENT, payload);
}

fn merge_model_pack_warnings(primary: &[String], secondary: &[String]) -> Vec<String> {
    let mut merged: Vec<String> = Vec::new();
    for warning in primary.iter().chain(secondary.iter()) {
        let normalized = warning.trim();
        if normalized.is_empty() || merged.iter().any(|existing| existing == normalized) {
            continue;
        }
        merged.push(normalized.to_string());
    }
    merged
}

fn set_desktop_model_pack_record(
    state: &SharedDesktopModelPackState,
    pack_id: &str,
    record: DesktopModelPackRecord,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|_| "lock_poisoned".to_string())?;
    guard.packs.insert(pack_id.to_string(), record);
    Ok(())
}

fn read_desktop_model_pack_record(
    state: &SharedDesktopModelPackState,
    pack_id: &str,
) -> Result<Option<DesktopModelPackRecord>, String> {
    let guard = state.lock().map_err(|_| "lock_poisoned".to_string())?;
    Ok(guard.packs.get(pack_id).cloned())
}

fn build_desktop_model_pack_update_payload(
    pack_id: &str,
    record: &DesktopModelPackRecord,
) -> serde_json::Value {
    serde_json::json!({
        "contract": DESKTOP_MODEL_PACK_UPDATE_CONTRACT,
        "requestId": record.request_id,
        "kind": DESKTOP_MODEL_PACK_UPDATE_KIND_MODEL_PACK,
        "pack": {
            "packId": pack_id,
            "packVersion": record.pack_version,
            "status": record.status,
            "manifestPath": record.manifest_path,
            "modelIds": record.model_ids,
            "warnings": record.warnings,
        },
        "progress": {
            "phase": record.phase,
            "completedBytes": record.completed_bytes,
            "totalBytes": record.total_bytes,
        },
        "detail": record.detail,
    })
}

fn emit_desktop_model_pack_update(
    app_handle: &tauri::AppHandle,
    pack_id: &str,
    record: &DesktopModelPackRecord,
) {
    let payload = build_desktop_model_pack_update_payload(pack_id, record);
    let _ = app_handle.emit_all(DESKTOP_MODEL_PACK_UPDATE_EVENT, payload);
}

fn drain_child_pipe<R>(mut reader: R)
where
    R: Read + Send + 'static,
{
    std::thread::spawn(move || {
        let mut buffer = [0u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(_) => {}
                Err(_) => break,
            }
        }
    });
}

fn read_events_since(
    path: &Path,
    offset: &mut u64,
    tail: &mut String,
) -> Result<Vec<serde_json::Value>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let file_len = file.metadata().map_err(|e| e.to_string())?.len();
    let safe_offset = (*offset).min(file_len);
    if safe_offset < *offset {
        tail.clear();
    }
    file.seek(SeekFrom::Start(safe_offset))
        .map_err(|e| e.to_string())?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
    *offset = safe_offset + buffer.len() as u64;
    if buffer.is_empty() {
        return Ok(Vec::new());
    }

    tail.push_str(&String::from_utf8_lossy(&buffer));
    let mut events = Vec::new();
    while let Some(newline_idx) = tail.find('\n') {
        let line = tail[..newline_idx].trim().to_string();
        let next_tail = tail[newline_idx + 1..].to_string();
        *tail = next_tail;
        if line.is_empty() {
            continue;
        }
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&line) {
            events.push(value);
        }
    }
    Ok(events)
}

fn start_runtime_monitor(
    state: SharedPtyState,
    app_handle: tauri::AppHandle,
    session_seq: u64,
    run_dir: String,
    events_path: String,
) {
    std::thread::spawn(move || {
        let events_path = PathBuf::from(events_path);
        let mut events_offset = 0u64;
        let mut events_tail = String::new();

        loop {
            let mut should_break = false;
            let mut exit_phase: Option<&'static str> = None;
            let mut exit_detail: Option<String> = None;
            let (launch_mode, launch_label) = {
                let mut guard = match state.lock() {
                    Ok(value) => value,
                    Err(_) => break,
                };
                if guard.session_seq != session_seq {
                    break;
                }
                let launch_mode = guard.launch_mode.clone();
                let launch_label = guard.launch_label.clone();
                match guard.child.as_mut() {
                    Some(child) => match child.try_wait() {
                        Ok(Some(status)) => {
                            exit_phase = Some(DESKTOP_SESSION_PHASE_STOPPED);
                            exit_detail = Some(command_exit_detail(status));
                            guard.child = None;
                            guard.writer = None;
                            guard.run_dir = None;
                            guard.events_path = None;
                            guard.last_exit_detail = exit_detail.clone();
                            guard.last_error = None;
                            guard.launch_mode = None;
                            guard.launch_label = None;
                        }
                        Ok(None) => {}
                        Err(err) => {
                            exit_phase = Some(DESKTOP_SESSION_PHASE_ERROR);
                            exit_detail = Some(err.to_string());
                            guard.child = None;
                            guard.writer = None;
                            guard.run_dir = None;
                            guard.events_path = None;
                            guard.last_exit_detail = None;
                            guard.last_error = exit_detail.clone();
                            guard.launch_mode = None;
                            guard.launch_label = None;
                        }
                    },
                    None => {
                        should_break = true;
                    }
                }
                (launch_mode, launch_label)
            };

            if let Some(phase) = exit_phase {
                emit_desktop_session_status_update(
                    &app_handle,
                    &run_dir,
                    phase,
                    launch_mode.as_deref(),
                    launch_label.as_deref(),
                    exit_detail.as_deref(),
                );
                let _ = app_handle.emit_all("pty-exit", true);
                break;
            }
            if should_break {
                break;
            }

            if let Ok(events) =
                read_events_since(&events_path, &mut events_offset, &mut events_tail)
            {
                for event in events {
                    emit_desktop_session_event_update(&app_handle, &run_dir, event);
                }
            }

            std::thread::sleep(Duration::from_millis(150));
        }
    });
}

struct SpawnedRuntimeSession {
    child: process::Child,
    writer: process::ChildStdin,
    run_dir: Option<String>,
    events_path: String,
    launch_label: String,
    launch_mode: String,
}

fn spawn_runtime_process(
    app: &tauri::AppHandle,
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
    env: Option<std::collections::HashMap<String, String>>,
) -> Result<SpawnedRuntimeSession, String> {
    let mut merged_env = env.unwrap_or_default();
    merge_known_dotenv_layers(&mut merged_env);
    if let Some(repo_root) = find_repo_root_best_effort() {
        let env_path = repo_root.join(".env");
        if env_path.exists() {
            merge_dotenv_vars(&mut merged_env, &env_path);
        }
    }

    let mut launch_errors: Vec<String> = Vec::new();
    let candidates = resolve_spawn_candidates(app, &command);

    for candidate in candidates {
        eprintln!(
            "brood desktop spawn attempting '{}' ({})",
            candidate.program, candidate.label
        );

        let mut cmd = process::Command::new(candidate.program.clone());
        cmd.args(&args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if let Some(dir) = cwd.as_ref() {
            cmd.current_dir(PathBuf::from(dir));
        }
        for (key, value) in &merged_env {
            cmd.env(key, value);
        }

        let mut child = match cmd.spawn() {
            Ok(child) => child,
            Err(err) => {
                launch_errors.push(format!("{}: {}", candidate.label, err));
                continue;
            }
        };

        let mut immediate_exit = child
            .try_wait()
            .map_err(|err| err.to_string())?
            .map(command_exit_detail);
        if immediate_exit.is_none() {
            std::thread::sleep(Duration::from_millis(220));
            immediate_exit = child
                .try_wait()
                .map_err(|err| err.to_string())?
                .map(command_exit_detail);
        }
        if let Some(detail) = immediate_exit {
            launch_errors.push(format!(
                "{}: exited immediately ({detail})",
                candidate.label
            ));
            continue;
        }

        let writer = child
            .stdin
            .take()
            .ok_or_else(|| "engine stdin unavailable".to_string())?;
        if let Some(stdout) = child.stdout.take() {
            drain_child_pipe(stdout);
        }
        if let Some(stderr) = child.stderr.take() {
            drain_child_pipe(stderr);
        }

        eprintln!(
            "brood desktop spawn command resolved '{}' -> '{}' ({})",
            command, candidate.program, candidate.label
        );
        let run_dir = extract_arg_value(&args, "--out");
        let events_path = extract_arg_value(&args, "--events").unwrap_or_else(|| {
            run_dir
                .as_deref()
                .map(default_events_path_for_run_dir)
                .unwrap_or_default()
        });
        return Ok(SpawnedRuntimeSession {
            child,
            writer,
            run_dir,
            events_path,
            launch_label: candidate.label,
            launch_mode: "native".to_string(),
        });
    }

    if launch_errors.is_empty() {
        return Err(format!(
            "failed to spawn engine command '{}'",
            command.trim()
        ));
    }
    Err(format!(
        "failed to spawn engine command '{}': {}",
        command.trim(),
        launch_errors.join(" | ")
    ))
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
    let spawned = spawn_runtime_process(&app, command, args, cwd, env)?;
    let events_path = spawned.events_path.clone();
    let run_dir = spawned.run_dir.clone();
    let launch_mode = spawned.launch_mode.clone();
    let launch_label = spawned.launch_label.clone();
    let state_handle = state.inner().clone();
    let session_seq = {
        let mut guard = state_handle.lock().map_err(|_| "Lock poisoned")?;
        clear_runtime_session(&mut guard);
        guard.session_seq = guard.session_seq.saturating_add(1);
        let session_seq = guard.session_seq;
        guard.writer = Some(spawned.writer);
        guard.child = Some(spawned.child);
        guard.run_dir = run_dir.clone();
        guard.events_path = Some(events_path.clone());
        guard.launch_mode = Some(launch_mode.clone());
        guard.launch_label = Some(launch_label.clone());
        session_seq
    };
    if let Some(run_dir) = run_dir {
        emit_desktop_session_status_update(
            &app,
            &run_dir,
            DESKTOP_SESSION_PHASE_READY,
            Some(&launch_mode),
            Some(&launch_label),
            None,
        );
        start_runtime_monitor(state_handle, app, session_seq, run_dir, events_path);
    }
    Ok(())
}

#[tauri::command]
fn write_pty(state: State<'_, SharedPtyState>, data: String) -> Result<(), String> {
    let mut state = state.inner().lock().map_err(|_| "Lock poisoned")?;
    write_to_pty(&mut state, &data)
}

#[tauri::command]
fn resize_pty(state: State<'_, SharedPtyState>, cols: u16, rows: u16) -> Result<(), String> {
    let _ = state;
    let _ = cols;
    let _ = rows;
    Ok(())
}

#[tauri::command]
fn create_run_dir() -> Result<serde_json::Value, String> {
    let run_root = preferred_run_root()?;
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
struct MagicSelectPointPayload {
    x: f64,
    y: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct MagicSelectSettingsPayload {
    mask_threshold: Option<u8>,
    max_contour_points: Option<usize>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct MagicSelectPrepareImageRequest {
    image_id: String,
    image_path: String,
    run_dir: String,
    stable_source_ref: String,
    source: String,
    settings: MagicSelectSettingsPayload,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct MagicSelectWarmClickRequest {
    prepared_image_id: String,
    image_id: String,
    click_anchor: MagicSelectPointPayload,
    source: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct MagicSelectReleaseRequest {
    prepared_image_id: String,
    image_id: String,
    reason: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct MagicSelectClickRequest {
    image_id: String,
    image_path: String,
    run_dir: Option<String>,
    stable_source_ref: Option<String>,
    click_anchor: MagicSelectPointPayload,
    source: Option<String>,
    settings: Option<MagicSelectSettingsPayload>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct MagicSelectHelperModelPayload {
    id: String,
    revision: String,
    path: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct MagicSelectHelperInput {
    contract: &'static str,
    action: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    image_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    prepared_image_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    image_cache_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    image_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    click_anchor: Option<MagicSelectPointPayload>,
    #[serde(skip_serializing_if = "Option::is_none")]
    output_mask_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    model: Option<MagicSelectHelperModelPayload>,
    #[serde(skip_serializing_if = "Option::is_none")]
    settings: Option<MagicSelectSettingsPayload>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct MagicSelectHelperOutput {
    ok: Option<bool>,
    action: Option<String>,
    image_id: Option<String>,
    prepared_image_id: Option<String>,
    code: Option<String>,
    details: Option<serde_json::Value>,
    mask_path: Option<String>,
    confidence: Option<f64>,
    model_id: Option<String>,
    model_revision: Option<String>,
    runtime: Option<String>,
    warnings: Option<Vec<String>>,
    error: Option<String>,
}

#[derive(Debug, Clone)]
struct MagicSelectRuntimeConfig {
    python_bin: String,
    helper_path: PathBuf,
    model_path: PathBuf,
    model_id: String,
    model_revision: String,
    runtime_id: String,
}

#[derive(Debug, Clone)]
struct NormalizedMagicSelectSettings {
    mask_threshold: u8,
    max_contour_points: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct MagicSelectContourPoint {
    x: i32,
    y: i32,
}

#[derive(Debug, Clone)]
struct MagicSelectMaskSummary {
    width: u32,
    height: u32,
    bounds_x: u32,
    bounds_y: u32,
    bounds_w: u32,
    bounds_h: u32,
    contour_points: Vec<MagicSelectContourPoint>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct MagicSelectFileFingerprint {
    len: u64,
    modified_unix_nanos: Option<u128>,
}

#[derive(Debug, Clone)]
struct MagicSelectCachedFileHash {
    fingerprint: MagicSelectFileFingerprint,
    sha256: String,
}

#[derive(Debug, Clone)]
struct MagicSelectPreparedImageState {
    prepared_image_id: String,
    image_cache_key: String,
    image_id: String,
    image_path: PathBuf,
    artifact_root: PathBuf,
    stable_source_ref: String,
    source: String,
    settings: NormalizedMagicSelectSettings,
    image_sha256: String,
    runtime_id: String,
    model_id: String,
    model_revision: String,
    prepared_at_millis: i64,
}

#[derive(Debug)]
struct MagicSelectWorkerClient {
    runtime_signature: String,
    child: process::Child,
    stdin: process::ChildStdin,
    stdout: BufReader<process::ChildStdout>,
    stderr_tail: Arc<Mutex<VecDeque<String>>>,
    prepared_image_ids: HashSet<String>,
}

#[derive(Debug, Default)]
struct MagicSelectWorkerSession {
    client: Option<MagicSelectWorkerClient>,
    cached_image_hashes: HashMap<PathBuf, MagicSelectCachedFileHash>,
    prepared_images: HashMap<String, MagicSelectPreparedImageState>,
}

#[derive(Debug, Clone)]
struct MagicSelectWorkerError {
    action: String,
    image_id: Option<String>,
    prepared_image_id: Option<String>,
    code: String,
    warnings: Vec<String>,
    details: Option<serde_json::Value>,
}

#[tauri::command]
fn prepare_local_magic_select_image(
    request: MagicSelectPrepareImageRequest,
) -> Result<serde_json::Value, serde_json::Value> {
    magic_select_prepare_local_image_impl(request)
}

#[tauri::command]
fn run_local_magic_select_warm_click(
    request: MagicSelectWarmClickRequest,
) -> Result<serde_json::Value, serde_json::Value> {
    magic_select_run_local_warm_click_impl(request)
}

#[tauri::command]
fn release_local_magic_select_image(
    request: MagicSelectReleaseRequest,
) -> Result<serde_json::Value, serde_json::Value> {
    magic_select_release_local_image_impl(request)
}

#[derive(Debug, Clone, Copy)]
struct MagicSelectCandidateBounds {
    x: u32,
    y: u32,
    w: u32,
    h: u32,
}

#[derive(Debug, Clone)]
struct MagicSelectWarmClickReceiptPersistence {
    contract: String,
    action: String,
    image_id: String,
    prepared_image_id: String,
    source: String,
    click_anchor: MagicSelectPointPayload,
    prepared_image: serde_json::Value,
    mask_path: PathBuf,
    mask_sha256: String,
    receipt_path: PathBuf,
    reproducibility: serde_json::Value,
    candidate_id: String,
    candidate_bounds: MagicSelectCandidateBounds,
    confidence: f64,
    contour_point_count: usize,
    created_at: String,
    warnings: Vec<String>,
}

fn build_magic_select_candidate_bounds_value(
    bounds: MagicSelectCandidateBounds,
) -> serde_json::Value {
    serde_json::json!({
        "x": bounds.x,
        "y": bounds.y,
        "w": bounds.w,
        "h": bounds.h,
    })
}

fn build_magic_select_warm_click_receipt_artifacts(
    persistence: &MagicSelectWarmClickReceiptPersistence,
) -> serde_json::Value {
    serde_json::json!({
        "mask_path": persistence.mask_path.to_string_lossy().to_string(),
        "mask_sha256": persistence.mask_sha256.as_str(),
    })
}

fn build_magic_select_warm_click_receipt_payload(
    persistence: &MagicSelectWarmClickReceiptPersistence,
) -> serde_json::Value {
    serde_json::json!({
        "schema_version": 1,
        "contract": persistence.contract.as_str(),
        "action": persistence.action.as_str(),
        "request": {
            "image_id": persistence.image_id.as_str(),
            "prepared_image_id": persistence.prepared_image_id.as_str(),
            "source": persistence.source.as_str(),
            "click_anchor": persistence.click_anchor.clone(),
        },
        "prepared_image": persistence.prepared_image.clone(),
        "artifacts": build_magic_select_warm_click_receipt_artifacts(persistence),
        "result_metadata": {
            "candidate_id": persistence.candidate_id.as_str(),
            "candidate_bounds": build_magic_select_candidate_bounds_value(persistence.candidate_bounds),
            "confidence": persistence.confidence,
            "contour_point_count": persistence.contour_point_count,
            "created_at": persistence.created_at.as_str(),
        },
        "reproducibility": persistence.reproducibility.clone(),
        "warnings": persistence.warnings.clone(),
    })
}

fn persist_magic_select_warm_click_receipt(
    persistence: &MagicSelectWarmClickReceiptPersistence,
) -> Result<(), String> {
    let receipt_payload = build_magic_select_warm_click_receipt_payload(persistence);
    let encoded_receipt =
        serde_json::to_string_pretty(&receipt_payload).map_err(|e| e.to_string())?;
    std::fs::write(&persistence.receipt_path, encoded_receipt)
        .map_err(|e| format!("{}: {e}", persistence.receipt_path.to_string_lossy()))?;
    Ok(())
}

fn spawn_magic_select_warm_click_receipt_persistence<F>(
    persistence: MagicSelectWarmClickReceiptPersistence,
    before_persist: F,
) -> Result<std::thread::JoinHandle<()>, String>
where
    F: FnOnce() + Send + 'static,
{
    let receipt_path = persistence.receipt_path.clone();
    std::thread::Builder::new()
        .name("magic-select-warm-click-receipt".to_string())
        .spawn(move || {
            before_persist();
            if let Err(error) = persist_magic_select_warm_click_receipt(&persistence) {
                eprintln!(
                    "Magic Select warm-click receipt persistence failed at {}: {error}",
                    receipt_path.to_string_lossy()
                );
            }
        })
        .map_err(|e| e.to_string())
}

fn schedule_magic_select_warm_click_receipt_persistence(
    persistence: MagicSelectWarmClickReceiptPersistence,
) -> Option<String> {
    spawn_magic_select_warm_click_receipt_persistence(persistence, || {})
        .map(|_| None)
        .unwrap_or_else(|error| {
            Some(format!(
                "Magic Select receipt persistence could not start: {error}"
            ))
        })
}

#[tauri::command]
fn run_local_magic_select_click(
    request: MagicSelectClickRequest,
) -> Result<serde_json::Value, String> {
    let image_id = request.image_id.trim().to_string();
    if image_id.is_empty() {
        return Err("magic_select_click requires imageId".to_string());
    }
    let image_path = request.image_path.trim().to_string();
    if image_path.is_empty() {
        return Err("magic_select_click requires imagePath".to_string());
    }
    let run_dir = if let Some(run_dir) = request
        .run_dir
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        run_dir.to_string()
    } else {
        magic_select_resolve_artifact_root(None)
            .map_err(|e| format!("failed to resolve run dir for magic_select_click: {e}"))?
            .to_string_lossy()
            .to_string()
    };
    let source = request
        .source
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("canvas_magic_select")
        .to_string();
    let stable_source_ref = request
        .stable_source_ref
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&image_path)
        .to_string();
    let settings = magic_select_normalize_settings(request.settings.clone());
    let prepare_response = magic_select_prepare_local_image_impl(MagicSelectPrepareImageRequest {
        image_id: image_id.clone(),
        image_path: image_path.clone(),
        run_dir,
        stable_source_ref,
        source: source.clone(),
        settings: MagicSelectSettingsPayload {
            mask_threshold: Some(settings.mask_threshold),
            max_contour_points: Some(settings.max_contour_points),
        },
    })
    .map_err(magic_select_error_payload_to_string)?;
    let prepared_image_id = prepare_response
        .get("preparedImageId")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| {
            "prepare_local_magic_select_image did not return preparedImageId".to_string()
        })?
        .to_string();
    magic_select_run_local_warm_click_impl(MagicSelectWarmClickRequest {
        prepared_image_id,
        image_id,
        click_anchor: request.click_anchor,
        source,
    })
    .map_err(magic_select_error_payload_to_string)
}

fn magic_select_error_payload(
    action: &str,
    code: &str,
    image_id: Option<&str>,
    prepared_image_id: Option<&str>,
    details: Option<serde_json::Value>,
    warnings: Option<Vec<String>>,
) -> serde_json::Value {
    let mut payload = serde_json::json!({
        "code": code,
        "nonDestructive": true,
        "contract": MAGIC_SELECT_LOCAL_CONTRACT,
        "action": action,
        "imageId": image_id.map(str::to_string),
        "preparedImageId": prepared_image_id.map(str::to_string),
    });
    if let Some(map) = payload.as_object_mut() {
        if let Some(details) = details {
            map.insert("details".to_string(), details);
        }
        if let Some(warnings) = warnings {
            if !warnings.is_empty() {
                map.insert("warnings".to_string(), serde_json::json!(warnings));
            }
        }
    }
    payload
}

fn magic_select_error_message_details(message: impl Into<String>) -> serde_json::Value {
    serde_json::json!({ "message": message.into() })
}

fn magic_select_error_payload_to_string(payload: serde_json::Value) -> String {
    payload
        .get("details")
        .and_then(|value| value.get("message"))
        .and_then(serde_json::Value::as_str)
        .map(str::to_string)
        .or_else(|| {
            payload
                .get("code")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
        })
        .unwrap_or_else(|| payload.to_string())
}

fn magic_select_prepare_local_image_impl(
    request: MagicSelectPrepareImageRequest,
) -> Result<serde_json::Value, serde_json::Value> {
    let image_id = request.image_id.trim().to_string();
    if image_id.is_empty() {
        return Err(magic_select_error_payload(
            MAGIC_SELECT_LOCAL_PREPARE_ACTION,
            "magic_select_prepare_requires_image_id",
            None,
            None,
            Some(magic_select_error_message_details(
                "prepare_local_magic_select_image requires imageId",
            )),
            None,
        ));
    }
    let image_path_text = request.image_path.trim().to_string();
    if image_path_text.is_empty() {
        return Err(magic_select_error_payload(
            MAGIC_SELECT_LOCAL_PREPARE_ACTION,
            "magic_select_prepare_requires_image_path",
            Some(&image_id),
            None,
            Some(magic_select_error_message_details(
                "prepare_local_magic_select_image requires imagePath",
            )),
            None,
        ));
    }
    let image_path = PathBuf::from(&image_path_text);
    if !image_path.is_file() {
        return Err(magic_select_error_payload(
            MAGIC_SELECT_LOCAL_PREPARE_ACTION,
            "magic_select_prepare_source_image_missing",
            Some(&image_id),
            None,
            Some(magic_select_error_message_details(format!(
                "Magic Select source image not found at {}.",
                image_path.to_string_lossy()
            ))),
            None,
        ));
    }
    let run_dir = request.run_dir.trim().to_string();
    if run_dir.is_empty() {
        return Err(magic_select_error_payload(
            MAGIC_SELECT_LOCAL_PREPARE_ACTION,
            "magic_select_prepare_requires_run_dir",
            Some(&image_id),
            None,
            Some(magic_select_error_message_details(
                "prepare_local_magic_select_image requires runDir",
            )),
            None,
        ));
    }
    let stable_source_ref = request.stable_source_ref.trim().to_string();
    if stable_source_ref.is_empty() {
        return Err(magic_select_error_payload(
            MAGIC_SELECT_LOCAL_PREPARE_ACTION,
            "magic_select_prepare_requires_stable_source_ref",
            Some(&image_id),
            None,
            Some(magic_select_error_message_details(
                "prepare_local_magic_select_image requires stableSourceRef",
            )),
            None,
        ));
    }
    let source = request.source.trim().to_string();
    if source.is_empty() {
        return Err(magic_select_error_payload(
            MAGIC_SELECT_LOCAL_PREPARE_ACTION,
            "magic_select_prepare_requires_source",
            Some(&image_id),
            None,
            Some(magic_select_error_message_details(
                "prepare_local_magic_select_image requires source",
            )),
            None,
        ));
    }

    let settings = magic_select_normalize_settings(Some(request.settings.clone()));
    let artifact_root = magic_select_resolve_artifact_root(Some(&run_dir)).map_err(|detail| {
        magic_select_error_payload(
            MAGIC_SELECT_LOCAL_PREPARE_ACTION,
            "magic_select_prepare_run_dir_invalid",
            Some(&image_id),
            None,
            Some(magic_select_error_message_details(detail)),
            None,
        )
    })?;
    let runtime = magic_select_resolve_runtime_config().map_err(|detail| {
        magic_select_error_payload(
            MAGIC_SELECT_LOCAL_PREPARE_ACTION,
            "magic_select_runtime_unavailable",
            Some(&image_id),
            None,
            Some(magic_select_error_message_details(detail)),
            None,
        )
    })?;
    let mut session = magic_select_worker_session().lock().map_err(|_| {
        magic_select_error_payload(
            MAGIC_SELECT_LOCAL_PREPARE_ACTION,
            "magic_select_worker_session_lock_failed",
            Some(&image_id),
            None,
            Some(magic_select_error_message_details(
                "Magic Select worker session lock poisoned",
            )),
            None,
        )
    })?;
    let image_sha256 =
        magic_select_sha256_file_cached(&mut session, &image_path).map_err(|detail| {
            magic_select_error_payload(
                MAGIC_SELECT_LOCAL_PREPARE_ACTION,
                "magic_select_prepare_hash_failed",
                Some(&image_id),
                None,
                Some(magic_select_error_message_details(detail)),
                None,
            )
        })?;
    let image_cache_key = magic_select_image_cache_key(&stable_source_ref, &image_sha256);
    let prepared_image_id =
        magic_select_prepared_image_id(&image_cache_key, &image_id, &artifact_root, &settings);
    let prepared_at_millis = chrono::Utc::now().timestamp_millis();
    let mut state = MagicSelectPreparedImageState {
        prepared_image_id: prepared_image_id.clone(),
        image_cache_key: image_cache_key.clone(),
        image_id: image_id.clone(),
        image_path: image_path.clone(),
        artifact_root: artifact_root.clone(),
        stable_source_ref: stable_source_ref.clone(),
        source: source.clone(),
        settings: settings.clone(),
        image_sha256: image_sha256.clone(),
        runtime_id: runtime.runtime_id.clone(),
        model_id: runtime.model_id.clone(),
        model_revision: runtime.model_revision.clone(),
        prepared_at_millis,
    };
    let helper_output =
        magic_select_prepare_worker_image(&mut session, &runtime, &state).map_err(|err| {
            magic_select_worker_error_payload(
                MAGIC_SELECT_LOCAL_PREPARE_ACTION,
                Some(&image_id),
                Some(&prepared_image_id),
                err,
            )
        })?;
    state.model_id = helper_output
        .model_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&runtime.model_id)
        .to_string();
    state.model_revision = helper_output
        .model_revision
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&runtime.model_revision)
        .to_string();
    state.runtime_id = helper_output
        .runtime
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&runtime.runtime_id)
        .to_string();
    let warnings = helper_output.warnings.unwrap_or_default();
    session
        .prepared_images
        .insert(prepared_image_id.clone(), state.clone());
    drop(session);

    let stamp = chrono::Utc::now().format("%Y%m%dT%H%M%S%3f").to_string();
    let prepared_image = magic_select_prepared_image_payload(&state);
    let receipt_path = artifact_root.join(format!("receipt-magic-select-prepare-{stamp}.json"));
    let reproducibility = serde_json::json!({
        "runtime": state.runtime_id,
        "modelId": state.model_id,
        "modelRevision": state.model_revision,
        "imageHash": state.image_sha256,
        "imageCacheKey": state.image_cache_key,
        "preparedImageId": state.prepared_image_id,
        "stableSourceRef": state.stable_source_ref,
        "settings": {
            "maskThreshold": state.settings.mask_threshold,
            "maxContourPoints": state.settings.max_contour_points,
        },
    });
    let receipt_payload = serde_json::json!({
        "schema_version": 1,
        "contract": MAGIC_SELECT_LOCAL_CONTRACT,
        "action": MAGIC_SELECT_LOCAL_PREPARE_ACTION,
        "request": {
            "image_id": image_id.clone(),
            "image_path": image_path.to_string_lossy().to_string(),
            "run_dir": artifact_root.to_string_lossy().to_string(),
            "stable_source_ref": stable_source_ref,
            "source": source,
            "settings": {
                "mask_threshold": settings.mask_threshold,
                "max_contour_points": settings.max_contour_points,
            },
        },
        "prepared_image": prepared_image.clone(),
        "reproducibility": reproducibility.clone(),
        "warnings": warnings.clone(),
    });
    let encoded_receipt = serde_json::to_string_pretty(&receipt_payload).map_err(|detail| {
        magic_select_error_payload(
            MAGIC_SELECT_LOCAL_PREPARE_ACTION,
            "magic_select_prepare_receipt_encode_failed",
            Some(&image_id),
            Some(&prepared_image_id),
            Some(magic_select_error_message_details(detail.to_string())),
            None,
        )
    })?;
    std::fs::write(&receipt_path, encoded_receipt).map_err(|detail| {
        magic_select_error_payload(
            MAGIC_SELECT_LOCAL_PREPARE_ACTION,
            "magic_select_prepare_receipt_write_failed",
            Some(&image_id),
            Some(&prepared_image_id),
            Some(magic_select_error_message_details(format!(
                "{}: {detail}",
                receipt_path.to_string_lossy()
            ))),
            None,
        )
    })?;

    Ok(serde_json::json!({
        "ok": true,
        "contract": MAGIC_SELECT_LOCAL_CONTRACT,
        "action": MAGIC_SELECT_LOCAL_PREPARE_ACTION,
        "imageId": image_id,
        "preparedImageId": prepared_image_id,
        "preparedImage": prepared_image,
        "receipt": {
            "path": receipt_path.to_string_lossy().to_string(),
            "reproducibility": reproducibility,
        },
        "warnings": warnings,
    }))
}

fn magic_select_run_local_warm_click_impl(
    request: MagicSelectWarmClickRequest,
) -> Result<serde_json::Value, serde_json::Value> {
    let prepared_image_id = request.prepared_image_id.trim().to_string();
    if prepared_image_id.is_empty() {
        return Err(magic_select_error_payload(
            MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,
            "magic_select_warm_click_requires_prepared_image_id",
            None,
            None,
            Some(magic_select_error_message_details(
                "run_local_magic_select_warm_click requires preparedImageId",
            )),
            None,
        ));
    }
    let image_id = request.image_id.trim().to_string();
    if image_id.is_empty() {
        return Err(magic_select_error_payload(
            MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,
            "magic_select_warm_click_requires_image_id",
            None,
            Some(&prepared_image_id),
            Some(magic_select_error_message_details(
                "run_local_magic_select_warm_click requires imageId",
            )),
            None,
        ));
    }
    let source = request.source.trim().to_string();
    if source.is_empty() {
        return Err(magic_select_error_payload(
            MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,
            "magic_select_warm_click_requires_source",
            Some(&image_id),
            Some(&prepared_image_id),
            Some(magic_select_error_message_details(
                "run_local_magic_select_warm_click requires source",
            )),
            None,
        ));
    }

    let runtime = magic_select_resolve_runtime_config().map_err(|detail| {
        magic_select_error_payload(
            MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,
            "magic_select_runtime_unavailable",
            Some(&image_id),
            Some(&prepared_image_id),
            Some(magic_select_error_message_details(detail)),
            None,
        )
    })?;
    let mut session = magic_select_worker_session().lock().map_err(|_| {
        magic_select_error_payload(
            MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,
            "magic_select_worker_session_lock_failed",
            Some(&image_id),
            Some(&prepared_image_id),
            Some(magic_select_error_message_details(
                "Magic Select worker session lock poisoned",
            )),
            None,
        )
    })?;
    let state = session
        .prepared_images
        .get(&prepared_image_id)
        .cloned()
        .ok_or_else(|| {
            magic_select_error_payload(
                MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,
                "prepared_image_not_found",
                Some(&image_id),
                Some(&prepared_image_id),
                Some(magic_select_error_message_details(
                    "Prepared Magic Select image was not found. Prepare it again before clicking.",
                )),
                None,
            )
        })?;
    if state.image_id != image_id {
        return Err(magic_select_error_payload(
            MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,
            "magic_select_warm_click_image_id_mismatch",
            Some(&image_id),
            Some(&prepared_image_id),
            Some(magic_select_error_message_details(format!(
                "preparedImageId {} belongs to imageId {}, not {}",
                prepared_image_id, state.image_id, image_id
            ))),
            None,
        ));
    }
    if state.model_id != runtime.model_id || state.model_revision != runtime.model_revision {
        return Err(magic_select_error_payload(
            MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,
            "magic_select_prepared_image_runtime_mismatch",
            Some(&image_id),
            Some(&prepared_image_id),
            Some(magic_select_error_message_details(
                "Magic Select runtime configuration changed after prepare. Release and prepare the image again.",
            )),
            None,
        ));
    }

    let (image_width, image_height) =
        image::image_dimensions(&state.image_path).map_err(|detail| {
            magic_select_error_payload(
                MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,
                "magic_select_warm_click_image_dimensions_failed",
                Some(&image_id),
                Some(&prepared_image_id),
                Some(magic_select_error_message_details(format!(
                    "{}: {detail}",
                    state.image_path.to_string_lossy()
                ))),
                None,
            )
        })?;
    let click_x = (request.click_anchor.x.round() as i64)
        .clamp(0, i64::from(image_width.saturating_sub(1))) as u32;
    let click_y = (request.click_anchor.y.round() as i64)
        .clamp(0, i64::from(image_height.saturating_sub(1))) as u32;
    let click_anchor = MagicSelectPointPayload {
        x: f64::from(click_x),
        y: f64::from(click_y),
    };

    let stamp = chrono::Utc::now().format("%Y%m%dT%H%M%S%3f").to_string();
    let output_mask_path = state
        .artifact_root
        .join(format!("artifact-{stamp}-magic-select-mask.png"));
    let helper_output = magic_select_run_worker_warm_click(
        &mut session,
        &runtime,
        &state,
        &click_anchor,
        &source,
        &output_mask_path,
    )
    .map_err(|err| {
        magic_select_worker_error_payload(
            MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,
            Some(&image_id),
            Some(&prepared_image_id),
            err,
        )
    })?;
    drop(session);

    let resolved_mask_path = helper_output
        .mask_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| output_mask_path.clone());
    if !resolved_mask_path.is_file() {
        return Err(magic_select_error_payload(
            MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,
            "magic_select_warm_click_mask_missing",
            Some(&image_id),
            Some(&prepared_image_id),
            Some(magic_select_error_message_details(format!(
                "Local Magic Select helper completed without writing a mask at {}.",
                resolved_mask_path.to_string_lossy()
            ))),
            None,
        ));
    }

    let model_id = helper_output
        .model_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&state.model_id)
        .to_string();
    let model_revision = helper_output
        .model_revision
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&state.model_revision)
        .to_string();
    let runtime_id = helper_output
        .runtime
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&state.runtime_id)
        .to_string();
    let confidence = helper_output
        .confidence
        .filter(|value| value.is_finite())
        .unwrap_or(1.0)
        .clamp(0.0, 1.0);
    let mut warnings = helper_output.warnings.unwrap_or_default();
    let mask_sha256 = sha256_file(&resolved_mask_path).map_err(|detail| {
        magic_select_error_payload(
            MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,
            "magic_select_warm_click_mask_hash_failed",
            Some(&image_id),
            Some(&prepared_image_id),
            Some(magic_select_error_message_details(detail)),
            None,
        )
    })?;
    let mask_summary = magic_select_read_mask_summary(
        &resolved_mask_path,
        state.settings.mask_threshold,
        state.settings.max_contour_points,
    )
    .map_err(|detail| {
        magic_select_error_payload(
            MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,
            "magic_select_warm_click_mask_summary_failed",
            Some(&image_id),
            Some(&prepared_image_id),
            Some(magic_select_error_message_details(detail)),
            None,
        )
    })?;
    let candidate_id = format!("magic-select-{}", &mask_sha256[..12]);
    let contour_points: Vec<serde_json::Value> = mask_summary
        .contour_points
        .iter()
        .map(|point| serde_json::json!({ "x": point.x, "y": point.y }))
        .collect();
    let mask_ref = serde_json::json!({
        "path": resolved_mask_path.to_string_lossy().to_string(),
        "sha256": mask_sha256,
        "width": mask_summary.width,
        "height": mask_summary.height,
        "format": "png",
    });
    let candidate_bounds = MagicSelectCandidateBounds {
        x: mask_summary.bounds_x,
        y: mask_summary.bounds_y,
        w: mask_summary.bounds_w,
        h: mask_summary.bounds_h,
    };
    let candidate = serde_json::json!({
        "id": candidate_id,
        "label": "Magic Select",
        "bounds": build_magic_select_candidate_bounds_value(candidate_bounds),
        "contourPoints": contour_points.clone(),
        "polygon": contour_points,
        "maskRef": mask_ref.clone(),
        "confidence": confidence,
        "source": format!("local_model:{model_id}"),
    });
    let prepared_image = magic_select_prepared_image_payload(&state);
    let created_at = chrono::Utc::now();
    let reproducibility = serde_json::json!({
        "runtime": runtime_id,
        "modelId": model_id,
        "modelRevision": model_revision,
        "imageHash": state.image_sha256,
        "imageCacheKey": state.image_cache_key,
        "preparedImageId": state.prepared_image_id,
        "stableSourceRef": state.stable_source_ref,
        "clickAnchor": click_anchor.clone(),
        "settings": {
            "maskThreshold": state.settings.mask_threshold,
            "maxContourPoints": state.settings.max_contour_points,
        },
        "outputMaskPath": resolved_mask_path.to_string_lossy().to_string(),
        "outputMaskHash": mask_ref["sha256"].clone(),
    });
    let group = serde_json::json!({
        "imageId": image_id.clone(),
        "anchor": request.click_anchor,
        "candidates": [candidate.clone()],
        "activeCandidateIndex": 0,
        "chosenCandidateId": candidate["id"].clone(),
        "updatedAt": created_at.timestamp_millis(),
        "reproducibility": reproducibility.clone(),
        "warnings": warnings.clone(),
    });
    let receipt_path = state
        .artifact_root
        .join(format!("receipt-magic-select-warm-click-{stamp}.json"));
    let receipt_persistence = MagicSelectWarmClickReceiptPersistence {
        contract: MAGIC_SELECT_LOCAL_CONTRACT.to_string(),
        action: MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION.to_string(),
        image_id: image_id.clone(),
        prepared_image_id: prepared_image_id.clone(),
        source: source.clone(),
        click_anchor: click_anchor.clone(),
        prepared_image: prepared_image.clone(),
        mask_path: resolved_mask_path.clone(),
        mask_sha256: mask_sha256.clone(),
        receipt_path: receipt_path.clone(),
        reproducibility: reproducibility.clone(),
        candidate_id: candidate_id.clone(),
        candidate_bounds,
        confidence,
        contour_point_count: mask_summary.contour_points.len(),
        created_at: created_at.to_rfc3339(),
        warnings: warnings.clone(),
    };
    let receipt_artifacts = build_magic_select_warm_click_receipt_artifacts(&receipt_persistence);
    if let Some(warning) = schedule_magic_select_warm_click_receipt_persistence(receipt_persistence)
    {
        warnings.push(warning);
    }

    Ok(serde_json::json!({
        "ok": true,
        "contract": MAGIC_SELECT_LOCAL_CONTRACT,
        "action": MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,
        "imageId": image_id,
        "candidate": candidate,
        "group": {
            "imageId": group["imageId"].clone(),
            "anchor": group["anchor"].clone(),
            "candidates": group["candidates"].clone(),
            "activeCandidateIndex": group["activeCandidateIndex"].clone(),
            "chosenCandidateId": group["chosenCandidateId"].clone(),
            "updatedAt": group["updatedAt"].clone(),
            "reproducibility": group["reproducibility"].clone(),
            "warnings": warnings.clone(),
        },
        "receipt": {
            "path": receipt_path.to_string_lossy().to_string(),
            "reproducibility": reproducibility,
            "artifacts": receipt_artifacts,
        },
        "warnings": warnings,
        "preparedImageId": prepared_image_id,
        "preparedImage": prepared_image,
    }))
}

fn magic_select_release_local_image_impl(
    request: MagicSelectReleaseRequest,
) -> Result<serde_json::Value, serde_json::Value> {
    let prepared_image_id = request.prepared_image_id.trim().to_string();
    if prepared_image_id.is_empty() {
        return Err(magic_select_error_payload(
            MAGIC_SELECT_LOCAL_RELEASE_ACTION,
            "magic_select_release_requires_prepared_image_id",
            None,
            None,
            Some(magic_select_error_message_details(
                "release_local_magic_select_image requires preparedImageId",
            )),
            None,
        ));
    }
    let image_id = request.image_id.trim().to_string();
    if image_id.is_empty() {
        return Err(magic_select_error_payload(
            MAGIC_SELECT_LOCAL_RELEASE_ACTION,
            "magic_select_release_requires_image_id",
            None,
            Some(&prepared_image_id),
            Some(magic_select_error_message_details(
                "release_local_magic_select_image requires imageId",
            )),
            None,
        ));
    }
    let reason = request.reason.trim().to_string();
    if reason.is_empty() {
        return Err(magic_select_error_payload(
            MAGIC_SELECT_LOCAL_RELEASE_ACTION,
            "magic_select_release_requires_reason",
            Some(&image_id),
            Some(&prepared_image_id),
            Some(magic_select_error_message_details(
                "release_local_magic_select_image requires reason",
            )),
            None,
        ));
    }

    let mut session = magic_select_worker_session().lock().map_err(|_| {
        magic_select_error_payload(
            MAGIC_SELECT_LOCAL_RELEASE_ACTION,
            "magic_select_worker_session_lock_failed",
            Some(&image_id),
            Some(&prepared_image_id),
            Some(magic_select_error_message_details(
                "Magic Select worker session lock poisoned",
            )),
            None,
        )
    })?;
    if let Some(state) = session.prepared_images.get(&prepared_image_id) {
        if state.image_id != image_id {
            return Err(magic_select_error_payload(
                MAGIC_SELECT_LOCAL_RELEASE_ACTION,
                "magic_select_release_image_id_mismatch",
                Some(&image_id),
                Some(&prepared_image_id),
                Some(magic_select_error_message_details(format!(
                    "preparedImageId {} belongs to imageId {}, not {}",
                    prepared_image_id, state.image_id, image_id
                ))),
                None,
            ));
        }
    }
    session.prepared_images.remove(&prepared_image_id);
    let mut warnings = Vec::new();
    if let Err(err) =
        magic_select_release_worker_image(&mut session, &image_id, &prepared_image_id, &reason)
    {
        if let Some(message) = err
            .details
            .as_ref()
            .and_then(|value| value.get("message"))
            .and_then(serde_json::Value::as_str)
        {
            warnings.push(message.to_string());
        } else {
            warnings.push(err.code);
        }
    }
    Ok(serde_json::json!({
        "ok": true,
        "contract": MAGIC_SELECT_LOCAL_CONTRACT,
        "action": MAGIC_SELECT_LOCAL_RELEASE_ACTION,
        "imageId": image_id,
        "preparedImageId": prepared_image_id,
        "warnings": warnings,
    }))
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
    seq: Option<u32>,
    #[serde(default)]
    kind: Option<String>,
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
    image_ids: Vec<String>,
    #[serde(default)]
    preview_image_id: Option<String>,
    #[serde(default)]
    preview_path: Option<String>,
    #[serde(default)]
    receipt_paths: Vec<String>,
    #[serde(default)]
    visual_mode: Option<String>,
    #[serde(default)]
    detail: Option<String>,
    #[serde(default)]
    is_head: Option<bool>,
    #[serde(default)]
    created_at: Option<i64>,
    #[serde(default)]
    created_at_iso: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScreenshotPolishExportPayload {
    #[serde(default)]
    proposal_id: Option<String>,
    #[serde(default)]
    selected_proposal_id: Option<String>,
    #[serde(default)]
    preview_image_path: Option<String>,
    #[serde(default)]
    changed_region_bounds: Option<serde_json::Value>,
    #[serde(default)]
    preserve_region_ids: Vec<String>,
    #[serde(default)]
    rationale_codes: Vec<String>,
    #[serde(default)]
    frame_context: Option<serde_json::Value>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportRunRequest {
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
    timeline_schema_version: Option<u32>,
    #[serde(default)]
    timeline_head_node_id: Option<String>,
    #[serde(default)]
    action_sequence: Vec<String>,
    #[serde(default)]
    edit_receipts: Vec<ExportEditReceiptPayload>,
    #[serde(default)]
    limitations: Vec<String>,
    #[serde(default)]
    screenshot_polish: Option<ScreenshotPolishExportPayload>,
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
struct ResolvedExportRunRequest {
    schema_version: u32,
    document_name: String,
    format: NativeExportFormat,
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
    timeline_schema_version: Option<u32>,
    timeline_head_node_id: Option<String>,
    action_sequence: Vec<String>,
    edit_receipts: Vec<ExportEditReceiptPayload>,
    limitations: Vec<String>,
    screenshot_polish: Option<ScreenshotPolishExportPayload>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum NativeExportFormat {
    Psd,
    Png,
    Jpg,
    Webp,
    Tiff,
}

impl NativeExportFormat {
    fn parse(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "psd" => Some(Self::Psd),
            "png" => Some(Self::Png),
            "jpg" | "jpeg" => Some(Self::Jpg),
            "webp" => Some(Self::Webp),
            "tif" | "tiff" => Some(Self::Tiff),
            _ => None,
        }
    }

    fn id(self) -> &'static str {
        match self {
            Self::Psd => "psd",
            Self::Png => "png",
            Self::Jpg => "jpg",
            Self::Webp => "webp",
            Self::Tiff => "tiff",
        }
    }

    fn primary_extension(self) -> &'static str {
        match self {
            Self::Psd => "psd",
            Self::Png => "png",
            Self::Jpg => "jpg",
            Self::Webp => "webp",
            Self::Tiff => "tiff",
        }
    }

    fn matches_extension(self, value: &str) -> bool {
        match self {
            Self::Psd => value.eq_ignore_ascii_case("psd"),
            Self::Png => value.eq_ignore_ascii_case("png"),
            Self::Jpg => value.eq_ignore_ascii_case("jpg") || value.eq_ignore_ascii_case("jpeg"),
            Self::Webp => value.eq_ignore_ascii_case("webp"),
            Self::Tiff => value.eq_ignore_ascii_case("tif") || value.eq_ignore_ascii_case("tiff"),
        }
    }

    fn operation(self) -> &'static str {
        match self {
            Self::Psd => "export_psd",
            Self::Png => "export_png",
            Self::Jpg => "export_jpg",
            Self::Webp => "export_webp",
            Self::Tiff => "export_tiff",
        }
    }

    fn export_contract(self) -> &'static str {
        match self {
            Self::Psd => "cue.export.psd.v1",
            Self::Png | Self::Jpg | Self::Webp | Self::Tiff => "cue.export.raster.v1",
        }
    }

    fn writer_id(self) -> &'static str {
        match self {
            Self::Psd => "cue-psd-export-v1",
            Self::Png | Self::Jpg | Self::Webp | Self::Tiff => "cue-raster-export-v1",
        }
    }

    fn supports_alpha(self) -> bool {
        !matches!(self, Self::Jpg)
    }

    fn background(self) -> &'static str {
        if self.supports_alpha() {
            "transparent"
        } else {
            "white"
        }
    }

    fn fidelity(self) -> &'static str {
        match self {
            Self::Psd => "partial_flattened",
            Self::Png | Self::Jpg | Self::Webp | Self::Tiff => "flattened_raster",
        }
    }

    fn media_type(self) -> &'static str {
        match self {
            Self::Psd => "image/vnd.adobe.photoshop",
            Self::Png => "image/png",
            Self::Jpg => "image/jpeg",
            Self::Webp => "image/webp",
            Self::Tiff => "image/tiff",
        }
    }

    fn image_format(self) -> Option<image::ImageFormat> {
        match self {
            Self::Psd => None,
            Self::Png => Some(image::ImageFormat::Png),
            Self::Jpg => Some(image::ImageFormat::Jpeg),
            Self::Webp => Some(image::ImageFormat::WebP),
            Self::Tiff => Some(image::ImageFormat::Tiff),
        }
    }
}

fn parse_export_format(value: &str) -> Result<NativeExportFormat, String> {
    NativeExportFormat::parse(value).ok_or_else(|| {
        format!(
            "unsupported export format '{}'; expected one of psd, png, jpg/jpeg, webp, tiff/tif",
            value
        )
    })
}

fn default_export_document_name(run_dir: &Path) -> String {
    run_dir
        .file_name()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("cue-export")
        .to_string()
}

fn default_export_limitations(format: NativeExportFormat) -> Vec<String> {
    let mut out = vec![match format {
        NativeExportFormat::Psd => "PSD export is flattened to a single bitmap composition with alpha; editable per-source PSD layers are not included in the current screenshot-polish baseline.".to_string(),
        NativeExportFormat::Png => "PNG export is flattened to a single bitmap composition with alpha and does not preserve editable layers, masks, or tool semantics.".to_string(),
        NativeExportFormat::Jpg => "JPG export is flattened to a single bitmap composition; transparent pixels are composited onto white and editable layers are not included in the current screenshot-polish baseline.".to_string(),
        NativeExportFormat::Webp => "WEBP export is flattened to a single bitmap composition with alpha and does not preserve editable layers, masks, or tool semantics.".to_string(),
        NativeExportFormat::Tiff => "TIFF export is flattened to a single bitmap composition with alpha and does not preserve editable layers, masks, or tool semantics.".to_string(),
    }];
    out.push("Export reconstructs canvas placement from Cue run artifacts and does not preserve live tool semantics, masks, or effect-token re-editability.".to_string());
    out.push(
        "Export pixel dimensions currently follow Cue canvas world geometry in CSS pixels rather than preserving source DPI metadata."
            .to_string(),
    );
    if format == NativeExportFormat::Psd {
        out.push(
            "If the shell still requests export.html, the native exporter normalizes the handoff output to .psd and leaves a pointer note at the requested legacy path."
                .to_string(),
        );
    }
    out
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

fn normalize_export_out_path(
    requested: &Path,
    run_dir: &Path,
    format: NativeExportFormat,
) -> PathBuf {
    let base = if requested.as_os_str().is_empty() {
        run_dir.join(format!("export.{}", format.primary_extension()))
    } else {
        requested.to_path_buf()
    };
    match base.extension().and_then(|value| value.to_str()) {
        Some(ext) if format.matches_extension(ext) => base,
        _ => base.with_extension(format.primary_extension()),
    }
}

const EXPORT_RUN_ARTIFACTS_DIRNAME: &str = "artifacts";
const EXPORT_RUN_RECEIPTS_DIRNAME: &str = "receipts";

fn export_run_artifacts_dir(run_dir: &Path) -> PathBuf {
    run_dir.join(EXPORT_RUN_ARTIFACTS_DIRNAME)
}

fn export_run_receipts_dir(run_dir: &Path) -> PathBuf {
    run_dir.join(EXPORT_RUN_RECEIPTS_DIRNAME)
}

fn canonical_export_stem(
    flattened_source_path: &Path,
    handoff_out_path: &Path,
    format: NativeExportFormat,
) -> String {
    let from_flattened = flattened_source_path
        .file_stem()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.trim_end_matches(".flattened").trim())
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let from_handoff = handoff_out_path
        .file_stem()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| {
            value
                .chars()
                .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
                .collect::<String>()
                .trim_matches('-')
                .to_ascii_lowercase()
        })
        .filter(|value| !value.is_empty());
    from_flattened
        .or(from_handoff)
        .unwrap_or_else(|| format!("export-{}", format.primary_extension()))
}

fn canonical_export_artifact_path(
    run_dir: &Path,
    flattened_source_path: &Path,
    handoff_out_path: &Path,
    format: NativeExportFormat,
) -> PathBuf {
    export_run_artifacts_dir(run_dir).join(format!(
        "{}.{}",
        canonical_export_stem(flattened_source_path, handoff_out_path, format),
        format.primary_extension()
    ))
}

fn canonical_export_receipt_path(
    run_dir: &Path,
    flattened_source_path: &Path,
    handoff_out_path: &Path,
    format: NativeExportFormat,
) -> PathBuf {
    export_run_receipts_dir(run_dir).join(format!(
        "receipt-{}.json",
        canonical_export_stem(flattened_source_path, handoff_out_path, format)
    ))
}

fn run_id_from_run_dir(run_dir: &Path) -> Option<String> {
    run_dir
        .file_name()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn flatten_rgba_for_opaque_export(rgba: &image::RgbaImage) -> image::RgbImage {
    let (width, height) = rgba.dimensions();
    let mut out = Vec::with_capacity((width as usize) * (height as usize) * 3);
    for pixel in rgba.pixels() {
        let alpha = u32::from(pixel[3]);
        for channel in pixel.0.iter().take(3) {
            let value = ((u32::from(*channel) * alpha) + (255 * (255 - alpha)) + 127) / 255;
            out.push(value as u8);
        }
    }
    image::RgbImage::from_raw(width, height, out)
        .expect("flattened opaque export buffer dimensions should stay valid")
}

fn encode_dynamic_image(
    image: image::DynamicImage,
    format: image::ImageFormat,
) -> Result<Vec<u8>, String> {
    let mut cursor = std::io::Cursor::new(Vec::new());
    image
        .write_to(&mut cursor, format)
        .map_err(|e| e.to_string())?;
    Ok(cursor.into_inner())
}

fn encode_flattened_export(
    format: NativeExportFormat,
    rgba: &image::RgbaImage,
) -> Result<Vec<u8>, String> {
    let (width, height) = rgba.dimensions();
    match format {
        NativeExportFormat::Psd => encode_flattened_psd_rgba(width, height, rgba.as_raw()),
        NativeExportFormat::Jpg => encode_dynamic_image(
            image::DynamicImage::ImageRgb8(flatten_rgba_for_opaque_export(rgba)),
            image::ImageFormat::Jpeg,
        ),
        NativeExportFormat::Png | NativeExportFormat::Webp | NativeExportFormat::Tiff => {
            encode_dynamic_image(
                image::DynamicImage::ImageRgba8(rgba.clone()),
                format
                    .image_format()
                    .expect("raster export format should map to an image encoder"),
            )
        }
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
    let receipt_dirs = [run_dir.to_path_buf(), export_run_receipts_dir(run_dir)];
    for receipt_dir in receipt_dirs {
        if !receipt_dir.exists() {
            continue;
        }
        let entries = std::fs::read_dir(&receipt_dir)
            .map_err(|e| format!("{}: {e}", receipt_dir.to_string_lossy()))?;
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

fn magic_select_normalize_settings(
    settings: Option<MagicSelectSettingsPayload>,
) -> NormalizedMagicSelectSettings {
    let raw = settings.unwrap_or_default();
    let mask_threshold = raw
        .mask_threshold
        .unwrap_or(MAGIC_SELECT_LOCAL_DEFAULT_MASK_THRESHOLD)
        .clamp(1, u8::MAX);
    let max_contour_points = raw
        .max_contour_points
        .unwrap_or(MAGIC_SELECT_LOCAL_DEFAULT_MAX_CONTOUR_POINTS)
        .clamp(16, 4096);
    NormalizedMagicSelectSettings {
        mask_threshold,
        max_contour_points,
    }
}

fn magic_select_default_model_revision(model_path: &Path) -> Result<String, String> {
    let digest = sha256_file(model_path)?;
    Ok(format!("sha256:{}", &digest[..12]))
}

static MAGIC_SELECT_WORKER_SESSION: OnceLock<Mutex<MagicSelectWorkerSession>> = OnceLock::new();

fn magic_select_worker_session() -> &'static Mutex<MagicSelectWorkerSession> {
    MAGIC_SELECT_WORKER_SESSION.get_or_init(|| Mutex::new(MagicSelectWorkerSession::default()))
}

impl MagicSelectWorkerClient {
    fn runtime_signature(runtime: &MagicSelectRuntimeConfig) -> String {
        format!(
            "{}|{}|{}|{}|{}|{}",
            runtime.python_bin,
            runtime.helper_path.to_string_lossy(),
            runtime.model_path.to_string_lossy(),
            runtime.model_id,
            runtime.model_revision,
            runtime.runtime_id,
        )
    }

    fn spawn(runtime: &MagicSelectRuntimeConfig) -> Result<Self, String> {
        let working_dir = runtime
            .helper_path
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(std::env::temp_dir);
        let mut child = process::Command::new(&runtime.python_bin)
            .arg(&runtime.helper_path)
            .arg("--worker")
            .current_dir(working_dir)
            .env("PYTHONUNBUFFERED", "1")
            .env("PYTHONHASHSEED", "0")
            .env("CUDA_VISIBLE_DEVICES", "")
            .env("OMP_NUM_THREADS", "1")
            .env("MKL_NUM_THREADS", "1")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("failed to spawn local Magic Select worker: {e}"))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "local Magic Select worker stdin unavailable".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "local Magic Select worker stdout unavailable".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "local Magic Select worker stderr unavailable".to_string())?;
        let stderr_tail = Arc::new(Mutex::new(VecDeque::new()));
        magic_select_spawn_stderr_drain(stderr, Arc::clone(&stderr_tail));

        Ok(Self {
            runtime_signature: Self::runtime_signature(runtime),
            child,
            stdin,
            stdout: BufReader::new(stdout),
            stderr_tail,
            prepared_image_ids: HashSet::new(),
        })
    }

    fn matches_runtime(&self, runtime: &MagicSelectRuntimeConfig) -> bool {
        self.runtime_signature == Self::runtime_signature(runtime)
    }

    fn stderr_snapshot(&self) -> String {
        let Ok(lines) = self.stderr_tail.lock() else {
            return String::new();
        };
        lines.iter().cloned().collect::<Vec<_>>().join("\n")
    }

    fn send_request(
        &mut self,
        input: &MagicSelectHelperInput,
    ) -> Result<MagicSelectHelperOutput, MagicSelectWorkerError> {
        let mut encoded = serde_json::to_vec(input).map_err(|e| MagicSelectWorkerError {
            action: input.action.to_string(),
            image_id: input.image_id.clone(),
            prepared_image_id: input.prepared_image_id.clone(),
            code: "magic_select_worker_encode_failed".to_string(),
            warnings: Vec::new(),
            details: Some(magic_select_error_message_details(e.to_string())),
        })?;
        encoded.push(b'\n');
        self.stdin
            .write_all(&encoded)
            .map_err(|e| MagicSelectWorkerError {
                action: input.action.to_string(),
                image_id: input.image_id.clone(),
                prepared_image_id: input.prepared_image_id.clone(),
                code: "magic_select_worker_write_failed".to_string(),
                warnings: Vec::new(),
                details: Some(magic_select_error_message_details(format!(
                    "failed to write request to the local Magic Select worker: {e}"
                ))),
            })?;
        self.stdin.flush().map_err(|e| MagicSelectWorkerError {
            action: input.action.to_string(),
            image_id: input.image_id.clone(),
            prepared_image_id: input.prepared_image_id.clone(),
            code: "magic_select_worker_flush_failed".to_string(),
            warnings: Vec::new(),
            details: Some(magic_select_error_message_details(format!(
                "failed to flush request to the local Magic Select worker: {e}"
            ))),
        })?;

        let stdout = loop {
            let mut line = String::new();
            let read = self
                .stdout
                .read_line(&mut line)
                .map_err(|e| MagicSelectWorkerError {
                    action: input.action.to_string(),
                    image_id: input.image_id.clone(),
                    prepared_image_id: input.prepared_image_id.clone(),
                    code: "magic_select_worker_read_failed".to_string(),
                    warnings: Vec::new(),
                    details: Some(magic_select_error_message_details(format!(
                        "failed to read response from the local Magic Select worker: {e}"
                    ))),
                })?;
            if read == 0 {
                let stderr = self.stderr_snapshot();
                let status = self
                    .child
                    .try_wait()
                    .ok()
                    .flatten()
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| "still running".to_string());
                let detail = if stderr.is_empty() {
                    format!("worker closed stdout unexpectedly (status: {status})")
                } else {
                    format!(
                        "worker closed stdout unexpectedly (status: {status}). stderr: {stderr}"
                    )
                };
                return Err(MagicSelectWorkerError {
                    action: input.action.to_string(),
                    image_id: input.image_id.clone(),
                    prepared_image_id: input.prepared_image_id.clone(),
                    code: "magic_select_worker_closed_stdout".to_string(),
                    warnings: Vec::new(),
                    details: Some(magic_select_error_message_details(detail)),
                });
            }
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                break trimmed.to_string();
            }
        };

        let parsed = serde_json::from_str::<MagicSelectHelperOutput>(&stdout).map_err(|e| {
            let stderr = self.stderr_snapshot();
            let detail = if stderr.is_empty() {
                format!("Local Magic Select worker returned invalid JSON: {e}. stdout='{stdout}'")
            } else {
                format!(
                    "Local Magic Select worker returned invalid JSON: {e}. stdout='{stdout}' stderr='{stderr}'"
                )
            };
            MagicSelectWorkerError {
                action: input.action.to_string(),
                image_id: input.image_id.clone(),
                prepared_image_id: input.prepared_image_id.clone(),
                code: "magic_select_worker_invalid_json".to_string(),
                warnings: Vec::new(),
                details: Some(magic_select_error_message_details(detail)),
            }
        })?;
        if parsed.ok == Some(false) {
            let detail = parsed
                .details
                .clone()
                .or_else(|| parsed.error.clone().map(magic_select_error_message_details))
                .or_else(|| {
                    let stderr = self.stderr_snapshot();
                    (!stderr.is_empty()).then_some(magic_select_error_message_details(stderr))
                });
            return Err(MagicSelectWorkerError {
                action: parsed
                    .action
                    .clone()
                    .unwrap_or_else(|| input.action.to_string()),
                image_id: parsed.image_id.clone().or_else(|| input.image_id.clone()),
                prepared_image_id: parsed
                    .prepared_image_id
                    .clone()
                    .or_else(|| input.prepared_image_id.clone()),
                code: parsed
                    .code
                    .clone()
                    .unwrap_or_else(|| "magic_select_worker_failed".to_string()),
                warnings: parsed.warnings.clone().unwrap_or_default(),
                details: detail,
            });
        }
        Ok(parsed)
    }

    fn ensure_prepared(
        &mut self,
        runtime: &MagicSelectRuntimeConfig,
        state: &MagicSelectPreparedImageState,
    ) -> Result<MagicSelectHelperOutput, MagicSelectWorkerError> {
        if self.prepared_image_ids.contains(&state.prepared_image_id) {
            return Ok(MagicSelectHelperOutput {
                ok: Some(true),
                action: Some(MAGIC_SELECT_LOCAL_PREPARE_ACTION.to_string()),
                image_id: Some(state.image_id.clone()),
                prepared_image_id: Some(state.prepared_image_id.clone()),
                code: None,
                details: None,
                mask_path: None,
                confidence: None,
                model_id: Some(runtime.model_id.clone()),
                model_revision: Some(runtime.model_revision.clone()),
                runtime: Some(runtime.runtime_id.clone()),
                warnings: Some(Vec::new()),
                error: None,
            });
        }
        let response = self.send_request(&MagicSelectHelperInput {
            contract: MAGIC_SELECT_LOCAL_CONTRACT,
            action: MAGIC_SELECT_LOCAL_PREPARE_ACTION,
            image_id: Some(state.image_id.clone()),
            prepared_image_id: Some(state.prepared_image_id.clone()),
            image_cache_key: Some(state.image_cache_key.clone()),
            image_path: Some(state.image_path.to_string_lossy().to_string()),
            click_anchor: None,
            output_mask_path: None,
            source: Some(state.source.clone()),
            reason: None,
            model: Some(magic_select_helper_model_payload(runtime)),
            settings: Some(magic_select_settings_payload(&state.settings)),
        })?;
        let prepared_image_id = response
            .prepared_image_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(&state.prepared_image_id)
            .to_string();
        self.prepared_image_ids.insert(prepared_image_id);
        Ok(response)
    }

    fn run_warm_click(
        &mut self,
        state: &MagicSelectPreparedImageState,
        click_anchor: &MagicSelectPointPayload,
        source: &str,
        output_mask_path: &Path,
    ) -> Result<MagicSelectHelperOutput, MagicSelectWorkerError> {
        let response = self.send_request(&MagicSelectHelperInput {
            contract: MAGIC_SELECT_LOCAL_CONTRACT,
            action: MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,
            image_id: Some(state.image_id.clone()),
            prepared_image_id: Some(state.prepared_image_id.clone()),
            image_cache_key: None,
            image_path: None,
            click_anchor: Some(click_anchor.clone()),
            output_mask_path: Some(output_mask_path.to_string_lossy().to_string()),
            source: Some(source.to_string()),
            reason: None,
            model: None,
            settings: None,
        })?;
        let prepared_image_id = response
            .prepared_image_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(&state.prepared_image_id)
            .to_string();
        self.prepared_image_ids.insert(prepared_image_id);
        Ok(response)
    }

    fn release_prepared_image(
        &mut self,
        image_id: &str,
        prepared_image_id: &str,
        reason: &str,
    ) -> Result<(), MagicSelectWorkerError> {
        let response = self.send_request(&MagicSelectHelperInput {
            contract: MAGIC_SELECT_LOCAL_CONTRACT,
            action: MAGIC_SELECT_LOCAL_RELEASE_ACTION,
            image_id: Some(image_id.to_string()),
            prepared_image_id: Some(prepared_image_id.to_string()),
            image_cache_key: None,
            image_path: None,
            click_anchor: None,
            output_mask_path: None,
            source: None,
            reason: Some(reason.to_string()),
            model: None,
            settings: None,
        })?;
        let prepared_image_id = response
            .prepared_image_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(prepared_image_id)
            .to_string();
        self.prepared_image_ids.remove(&prepared_image_id);
        Ok(())
    }
}

impl Drop for MagicSelectWorkerClient {
    fn drop(&mut self) {
        let _ = self.stdin.flush();
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn magic_select_spawn_stderr_drain(
    stderr: process::ChildStderr,
    stderr_tail: Arc<Mutex<VecDeque<String>>>,
) {
    std::thread::spawn(move || {
        let mut reader = BufReader::new(stderr);
        loop {
            let mut line = String::new();
            let Ok(read) = reader.read_line(&mut line) else {
                break;
            };
            if read == 0 {
                break;
            }
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            let Ok(mut tail) = stderr_tail.lock() else {
                break;
            };
            if tail.len() >= MAGIC_SELECT_LOCAL_STDERR_TAIL_LINES {
                tail.pop_front();
            }
            tail.push_back(trimmed.to_string());
        }
    });
}

fn magic_select_file_fingerprint(path: &Path) -> Result<MagicSelectFileFingerprint, String> {
    let metadata =
        std::fs::metadata(path).map_err(|e| format!("{}: {e}", path.to_string_lossy()))?;
    let modified_unix_nanos = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_nanos());
    Ok(MagicSelectFileFingerprint {
        len: metadata.len(),
        modified_unix_nanos,
    })
}

fn magic_select_sha256_file_cached(
    session: &mut MagicSelectWorkerSession,
    path: &Path,
) -> Result<String, String> {
    let fingerprint = magic_select_file_fingerprint(path)?;
    if let Some(cached) = session.cached_image_hashes.get(path) {
        if cached.fingerprint == fingerprint {
            return Ok(cached.sha256.clone());
        }
    }
    let digest = sha256_file(path)?;
    session.cached_image_hashes.insert(
        path.to_path_buf(),
        MagicSelectCachedFileHash {
            fingerprint,
            sha256: digest.clone(),
        },
    );
    Ok(digest)
}

fn magic_select_helper_model_payload(
    runtime: &MagicSelectRuntimeConfig,
) -> MagicSelectHelperModelPayload {
    MagicSelectHelperModelPayload {
        id: runtime.model_id.clone(),
        revision: runtime.model_revision.clone(),
        path: runtime.model_path.to_string_lossy().to_string(),
    }
}

fn magic_select_settings_payload(
    settings: &NormalizedMagicSelectSettings,
) -> MagicSelectSettingsPayload {
    MagicSelectSettingsPayload {
        mask_threshold: Some(settings.mask_threshold),
        max_contour_points: Some(settings.max_contour_points),
    }
}

fn magic_select_image_cache_key(stable_source_ref: &str, image_sha256: &str) -> String {
    let stable_source_ref = stable_source_ref.trim();
    let digest = sha256_hex(format!("{stable_source_ref}\n{image_sha256}").as_bytes());
    format!("magic-select-image-{}", &digest[..16])
}

fn magic_select_prepared_image_id(
    image_cache_key: &str,
    image_id: &str,
    artifact_root: &Path,
    settings: &NormalizedMagicSelectSettings,
) -> String {
    let digest = sha256_hex(
        format!(
            "{image_cache_key}\n{image_id}\n{}\n{}\n{}",
            artifact_root.to_string_lossy(),
            settings.mask_threshold,
            settings.max_contour_points,
        )
        .as_bytes(),
    );
    format!("magic-select-prepared-{}", &digest[..16])
}

fn magic_select_prepared_image_payload(state: &MagicSelectPreparedImageState) -> serde_json::Value {
    serde_json::json!({
        "id": state.prepared_image_id,
        "imageId": state.image_id,
        "imagePath": state.image_path.to_string_lossy().to_string(),
        "stableSourceRef": state.stable_source_ref,
        "source": state.source,
        "settings": {
            "maskThreshold": state.settings.mask_threshold,
            "maxContourPoints": state.settings.max_contour_points,
        },
        "imageHash": state.image_sha256,
        "runtime": state.runtime_id,
        "modelId": state.model_id,
        "modelRevision": state.model_revision,
        "preparedAt": state.prepared_at_millis,
    })
}

fn magic_select_worker_client<'a>(
    session: &'a mut MagicSelectWorkerSession,
    runtime: &MagicSelectRuntimeConfig,
) -> Result<&'a mut MagicSelectWorkerClient, String> {
    let needs_restart = session
        .client
        .as_ref()
        .map(|client| !client.matches_runtime(runtime))
        .unwrap_or(false);
    if needs_restart {
        session.client = None;
    }
    if session.client.is_none() {
        session.client = Some(MagicSelectWorkerClient::spawn(runtime)?);
    }
    session
        .client
        .as_mut()
        .ok_or_else(|| "local Magic Select worker unavailable".to_string())
}

fn magic_select_prepare_worker_image(
    session: &mut MagicSelectWorkerSession,
    runtime: &MagicSelectRuntimeConfig,
    state: &MagicSelectPreparedImageState,
) -> Result<MagicSelectHelperOutput, MagicSelectWorkerError> {
    let result = {
        let client = magic_select_worker_client(session, runtime).map_err(|detail| {
            MagicSelectWorkerError {
                action: MAGIC_SELECT_LOCAL_PREPARE_ACTION.to_string(),
                image_id: Some(state.image_id.clone()),
                prepared_image_id: Some(state.prepared_image_id.clone()),
                code: "magic_select_worker_unavailable".to_string(),
                warnings: Vec::new(),
                details: Some(magic_select_error_message_details(detail)),
            }
        })?;
        client.ensure_prepared(runtime, state)
    };
    match result {
        Ok(response) => Ok(response),
        Err(err) => {
            session.client = None;
            Err(err)
        }
    }
}

fn magic_select_run_worker_warm_click(
    session: &mut MagicSelectWorkerSession,
    runtime: &MagicSelectRuntimeConfig,
    state: &MagicSelectPreparedImageState,
    click_anchor: &MagicSelectPointPayload,
    source: &str,
    output_mask_path: &Path,
) -> Result<MagicSelectHelperOutput, MagicSelectWorkerError> {
    let first_attempt = {
        let client = magic_select_worker_client(session, runtime).map_err(|detail| {
            MagicSelectWorkerError {
                action: MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION.to_string(),
                image_id: Some(state.image_id.clone()),
                prepared_image_id: Some(state.prepared_image_id.clone()),
                code: "magic_select_worker_unavailable".to_string(),
                warnings: Vec::new(),
                details: Some(magic_select_error_message_details(detail)),
            }
        })?;
        if !client.prepared_image_ids.contains(&state.prepared_image_id) {
            client.ensure_prepared(runtime, state)?;
        }
        client.run_warm_click(state, click_anchor, source, output_mask_path)
    };
    match first_attempt {
        Ok(response) => Ok(response),
        Err(err) if err.code == "prepared_image_not_found" => {
            let retry = {
                let client = magic_select_worker_client(session, runtime).map_err(|detail| {
                    MagicSelectWorkerError {
                        action: MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION.to_string(),
                        image_id: Some(state.image_id.clone()),
                        prepared_image_id: Some(state.prepared_image_id.clone()),
                        code: "magic_select_worker_unavailable".to_string(),
                        warnings: Vec::new(),
                        details: Some(magic_select_error_message_details(detail)),
                    }
                })?;
                client.prepared_image_ids.remove(&state.prepared_image_id);
                client.ensure_prepared(runtime, state)?;
                client.run_warm_click(state, click_anchor, source, output_mask_path)
            };
            match retry {
                Ok(response) => Ok(response),
                Err(err) => {
                    session.client = None;
                    Err(err)
                }
            }
        }
        Err(err) => {
            session.client = None;
            Err(err)
        }
    }
}

fn magic_select_release_worker_image(
    session: &mut MagicSelectWorkerSession,
    image_id: &str,
    prepared_image_id: &str,
    reason: &str,
) -> Result<(), MagicSelectWorkerError> {
    let Some(client) = session.client.as_mut() else {
        return Ok(());
    };
    let result = client.release_prepared_image(image_id, prepared_image_id, reason);
    match result {
        Ok(()) => Ok(()),
        Err(err) => {
            session.client = None;
            Err(err)
        }
    }
}

fn magic_select_worker_error_payload(
    action: &str,
    fallback_image_id: Option<&str>,
    fallback_prepared_image_id: Option<&str>,
    err: MagicSelectWorkerError,
) -> serde_json::Value {
    let resolved_action = if err.action.trim().is_empty() {
        action
    } else {
        err.action.as_str()
    };
    magic_select_error_payload(
        resolved_action,
        &err.code,
        err.image_id.as_deref().or(fallback_image_id),
        err.prepared_image_id
            .as_deref()
            .or(fallback_prepared_image_id),
        err.details,
        Some(err.warnings),
    )
}

fn magic_select_resolve_runtime_config() -> Result<MagicSelectRuntimeConfig, String> {
    let python_bin =
        first_non_empty_env(&["CUE_MAGIC_SELECT_PYTHON", "JUGGERNAUT_MAGIC_SELECT_PYTHON"])
            .unwrap_or_else(|| MAGIC_SELECT_LOCAL_DEFAULT_PYTHON.to_string());

    let helper_path = if let Some((env_key, path)) =
        first_present_env(&["CUE_MAGIC_SELECT_HELPER", "JUGGERNAUT_MAGIC_SELECT_HELPER"])
    {
        let trimmed = path.trim();
        if trimmed.is_empty() {
            return Err(format!(
                "{} is set but empty; point it at the local MobileSAM helper.",
                env_key
            ));
        }
        PathBuf::from(trimmed)
    } else {
        let repo_root = find_repo_root_best_effort().ok_or_else(|| {
            "repo root not found while resolving the Magic Select helper".to_string()
        })?;
        repo_root.join(MAGIC_SELECT_LOCAL_DEFAULT_HELPER_SCRIPT)
    };
    if !helper_path.is_file() {
        return Err(format!(
            "Local Magic Select helper not found at {}. Set CUE_MAGIC_SELECT_HELPER or JUGGERNAUT_MAGIC_SELECT_HELPER to the MobileSAM helper script.",
            helper_path.to_string_lossy()
        ));
    }

    let model_path = if let Some((env_key, raw)) = first_present_env(&[
        "CUE_MAGIC_SELECT_MODEL_PATH",
        "JUGGERNAUT_MAGIC_SELECT_MODEL_PATH",
    ]) {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return Err(format!(
                "{} is set but empty; point it at the local MobileSAM weights file.",
                env_key
            ));
        }
        PathBuf::from(trimmed)
    } else {
        return Err(
            "CUE_MAGIC_SELECT_MODEL_PATH is required for local Magic Select. Install MobileSAM weights locally and set that path. JUGGERNAUT_MAGIC_SELECT_MODEL_PATH still works as a legacy alias."
                .to_string(),
        );
    };
    if !model_path.is_file() {
        return Err(format!(
            "Local Magic Select model weights not found at {}.",
            model_path.to_string_lossy()
        ));
    }

    let model_id = first_non_empty_env(&[
        "CUE_MAGIC_SELECT_MODEL_ID",
        "JUGGERNAUT_MAGIC_SELECT_MODEL_ID",
    ])
    .unwrap_or_else(|| MAGIC_SELECT_LOCAL_DEFAULT_MODEL_ID.to_string());
    let model_revision = first_non_empty_env(&[
        "CUE_MAGIC_SELECT_MODEL_REVISION",
        "JUGGERNAUT_MAGIC_SELECT_MODEL_REVISION",
    ])
    .map(Ok)
    .unwrap_or_else(|| magic_select_default_model_revision(&model_path))?;

    Ok(MagicSelectRuntimeConfig {
        python_bin,
        helper_path,
        model_path,
        model_id,
        model_revision,
        runtime_id: "tauri_mobile_sam_python_worker_cpu".to_string(),
    })
}

fn magic_select_resolve_artifact_root(run_dir: Option<&str>) -> Result<PathBuf, String> {
    if let Some(run_dir) = run_dir.map(str::trim).filter(|value| !value.is_empty()) {
        let path = PathBuf::from(run_dir);
        std::fs::create_dir_all(&path).map_err(|e| format!("{}: {e}", path.to_string_lossy()))?;
        return Ok(path);
    }

    let root = std::env::temp_dir().join("juggernaut_magic_select");
    std::fs::create_dir_all(&root).map_err(|e| format!("{}: {e}", root.to_string_lossy()))?;
    Ok(root)
}

fn magic_select_read_mask_summary(
    path: &Path,
    threshold: u8,
    max_contour_points: usize,
) -> Result<MagicSelectMaskSummary, String> {
    let rgba = read_image_rgba(path)?;
    let (width, height) = rgba.dimensions();
    let pixel_count = usize::try_from(width)
        .ok()
        .and_then(|w| usize::try_from(height).ok().map(|h| w.saturating_mul(h)))
        .ok_or_else(|| "magic select mask dimensions overflow".to_string())?;
    let mut positives = vec![false; pixel_count];
    let mut min_x = width;
    let mut min_y = height;
    let mut max_x = 0u32;
    let mut max_y = 0u32;
    let mut positive_count = 0usize;

    for y in 0..height {
        for x in 0..width {
            let pixel = rgba.get_pixel(x, y);
            let value = pixel[0].max(pixel[1]).max(pixel[2]);
            if value < threshold {
                continue;
            }
            let index = usize::try_from(y)
                .ok()
                .and_then(|row| usize::try_from(width).ok().map(|w| row.saturating_mul(w)))
                .and_then(|base| usize::try_from(x).ok().map(|col| base.saturating_add(col)))
                .ok_or_else(|| "magic select mask index overflow".to_string())?;
            positives[index] = true;
            positive_count += 1;
            min_x = min_x.min(x);
            min_y = min_y.min(y);
            max_x = max_x.max(x);
            max_y = max_y.max(y);
        }
    }

    if positive_count == 0 {
        return Err("Local Magic Select produced an empty mask.".to_string());
    }

    let contour_points =
        magic_select_extract_contour(&positives, width, height, max_contour_points)?;
    Ok(MagicSelectMaskSummary {
        width,
        height,
        bounds_x: min_x,
        bounds_y: min_y,
        bounds_w: max_x.saturating_sub(min_x).saturating_add(1),
        bounds_h: max_y.saturating_sub(min_y).saturating_add(1),
        contour_points,
    })
}

fn magic_select_mask_at(mask: &[bool], width: u32, height: u32, x: i32, y: i32) -> bool {
    if x < 0 || y < 0 {
        return false;
    }
    let Ok(xu) = u32::try_from(x) else {
        return false;
    };
    let Ok(yu) = u32::try_from(y) else {
        return false;
    };
    if xu >= width || yu >= height {
        return false;
    }
    let Some(index) = usize::try_from(yu)
        .ok()
        .and_then(|row| usize::try_from(width).ok().map(|w| row.saturating_mul(w)))
        .and_then(|base| usize::try_from(xu).ok().map(|col| base.saturating_add(col)))
    else {
        return false;
    };
    mask.get(index).copied().unwrap_or(false)
}

fn magic_select_extract_contour(
    mask: &[bool],
    width: u32,
    height: u32,
    max_points: usize,
) -> Result<Vec<MagicSelectContourPoint>, String> {
    let mut outgoing: HashMap<MagicSelectContourPoint, Vec<MagicSelectContourPoint>> =
        HashMap::new();
    for y in 0..i32::try_from(height).unwrap_or(0) {
        for x in 0..i32::try_from(width).unwrap_or(0) {
            if !magic_select_mask_at(mask, width, height, x, y) {
                continue;
            }
            if !magic_select_mask_at(mask, width, height, x, y - 1) {
                outgoing
                    .entry(MagicSelectContourPoint { x, y })
                    .or_default()
                    .push(MagicSelectContourPoint { x: x + 1, y });
            }
            if !magic_select_mask_at(mask, width, height, x + 1, y) {
                outgoing
                    .entry(MagicSelectContourPoint { x: x + 1, y })
                    .or_default()
                    .push(MagicSelectContourPoint { x: x + 1, y: y + 1 });
            }
            if !magic_select_mask_at(mask, width, height, x, y + 1) {
                outgoing
                    .entry(MagicSelectContourPoint { x: x + 1, y: y + 1 })
                    .or_default()
                    .push(MagicSelectContourPoint { x, y: y + 1 });
            }
            if !magic_select_mask_at(mask, width, height, x - 1, y) {
                outgoing
                    .entry(MagicSelectContourPoint { x, y: y + 1 })
                    .or_default()
                    .push(MagicSelectContourPoint { x, y });
            }
        }
    }

    if outgoing.is_empty() {
        return Err("Local Magic Select produced no contour edges.".to_string());
    }
    for targets in outgoing.values_mut() {
        targets.sort_by_key(|point| (point.y, point.x));
    }

    let mut loops: Vec<Vec<MagicSelectContourPoint>> = Vec::new();
    loop {
        let next_start = outgoing
            .iter()
            .filter(|(_, targets)| !targets.is_empty())
            .map(|(point, _)| *point)
            .min_by_key(|point| (point.y, point.x));
        let Some(start) = next_start else {
            break;
        };
        let mut current = start;
        let mut loop_points = vec![start];
        let mut steps = 0usize;
        let max_steps = mask.len().saturating_mul(8).max(8);
        loop {
            let Some(targets) = outgoing.get_mut(&current) else {
                break;
            };
            if targets.is_empty() {
                break;
            }
            let next = targets.remove(0);
            if next == start {
                break;
            }
            loop_points.push(next);
            current = next;
            steps = steps.saturating_add(1);
            if steps > max_steps {
                return Err(
                    "Local Magic Select contour tracing exceeded the safety limit.".to_string(),
                );
            }
        }
        if loop_points.len() >= 3 {
            loops.push(loop_points);
        }
    }

    let mut contour = loops
        .into_iter()
        .max_by_key(|points| magic_select_polygon_area_twice(points).unsigned_abs())
        .ok_or_else(|| "Local Magic Select could not derive an outer contour.".to_string())?;
    contour = magic_select_remove_collinear_points(&contour);
    contour = magic_select_downsample_polygon(&contour, max_points);
    if contour.len() < 3 {
        return Err("Local Magic Select contour is too small to use.".to_string());
    }
    Ok(contour)
}

fn magic_select_polygon_area_twice(points: &[MagicSelectContourPoint]) -> i64 {
    if points.len() < 3 {
        return 0;
    }
    let mut total = 0i64;
    for index in 0..points.len() {
        let current = points[index];
        let next = points[(index + 1) % points.len()];
        total +=
            i64::from(current.x) * i64::from(next.y) - i64::from(next.x) * i64::from(current.y);
    }
    total
}

fn magic_select_remove_collinear_points(
    points: &[MagicSelectContourPoint],
) -> Vec<MagicSelectContourPoint> {
    if points.len() <= 3 {
        return points.to_vec();
    }
    let mut out = Vec::with_capacity(points.len());
    for index in 0..points.len() {
        let prev = points[(index + points.len() - 1) % points.len()];
        let current = points[index];
        let next = points[(index + 1) % points.len()];
        let collinear_x = prev.x == current.x && current.x == next.x;
        let collinear_y = prev.y == current.y && current.y == next.y;
        if collinear_x || collinear_y {
            continue;
        }
        out.push(current);
    }
    if out.len() >= 3 {
        out
    } else {
        points.to_vec()
    }
}

fn magic_select_downsample_polygon(
    points: &[MagicSelectContourPoint],
    max_points: usize,
) -> Vec<MagicSelectContourPoint> {
    if points.len() <= max_points {
        return points.to_vec();
    }
    let mut out = Vec::with_capacity(max_points);
    let last_index = points.len().saturating_sub(1);
    for slot in 0..max_points {
        let index = if slot + 1 >= max_points {
            last_index
        } else {
            slot.saturating_mul(points.len()) / max_points
        };
        let point = points[index];
        if out.last().copied() != Some(point) {
            out.push(point);
        }
    }
    if out.len() >= 3 {
        out
    } else {
        points.to_vec()
    }
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
    let artifacts_dir = export_run_artifacts_dir(run_dir);
    std::fs::create_dir_all(&artifacts_dir)
        .map_err(|e| format!("{}: {e}", artifacts_dir.to_string_lossy()))?;
    let out_path = artifacts_dir.join(format!(
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
    request: ExportRunRequest,
) -> Result<ResolvedExportRunRequest, String> {
    let run_dir_path = PathBuf::from(&request.run_dir);
    if !run_dir_path.exists() {
        return Err(format!("run dir not found: {}", request.run_dir));
    }
    let format = parse_export_format(&request.format)?;

    let flattened_source_path = PathBuf::from(&request.flattened_source_path);
    if !flattened_source_path.exists() {
        return Err(format!(
            "flattened export source not found: {}",
            request.flattened_source_path
        ));
    }

    let requested_out_path = PathBuf::from(&request.out_path);
    let normalized_out_path = normalize_export_out_path(&requested_out_path, &run_dir_path, format);
    let records = collect_run_receipt_records(&run_dir_path)?;
    let edit_receipts = if request.edit_receipts.is_empty() {
        collect_edit_receipts_from_records(&records)
    } else {
        request.edit_receipts.clone()
    };
    let screenshot_polish = normalize_screenshot_polish_export_payload(request.screenshot_polish);

    Ok(ResolvedExportRunRequest {
        schema_version: request.schema_version.unwrap_or(1),
        document_name: request
            .document_name
            .unwrap_or_else(|| default_export_document_name(&run_dir_path)),
        format,
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
        timeline_schema_version: request.timeline_schema_version,
        timeline_head_node_id: request.timeline_head_node_id,
        action_sequence: if request.action_sequence.is_empty() {
            derive_action_sequence(&edit_receipts)
        } else {
            request.action_sequence
        },
        edit_receipts,
        limitations: merge_limitations(&default_export_limitations(format), &request.limitations),
        screenshot_polish,
    })
}

fn normalize_optional_export_string(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn normalize_export_string_list(values: Vec<String>) -> Vec<String> {
    let mut normalized = Vec::new();
    for value in values {
        let trimmed = value.trim();
        if trimmed.is_empty() || normalized.iter().any(|existing| existing == trimmed) {
            continue;
        }
        normalized.push(trimmed.to_string());
    }
    normalized
}

fn normalize_screenshot_polish_export_payload(
    payload: Option<ScreenshotPolishExportPayload>,
) -> Option<ScreenshotPolishExportPayload> {
    let Some(payload) = payload else {
        return None;
    };
    let proposal_id = normalize_optional_export_string(payload.proposal_id);
    let selected_proposal_id = normalize_optional_export_string(payload.selected_proposal_id)
        .or_else(|| proposal_id.clone());
    let preview_image_path = normalize_optional_export_string(payload.preview_image_path);
    let preserve_region_ids = normalize_export_string_list(payload.preserve_region_ids);
    let rationale_codes = normalize_export_string_list(payload.rationale_codes);
    let changed_region_bounds = payload.changed_region_bounds;
    let frame_context = payload.frame_context;
    if proposal_id.is_none()
        && selected_proposal_id.is_none()
        && preview_image_path.is_none()
        && changed_region_bounds.is_none()
        && preserve_region_ids.is_empty()
        && rationale_codes.is_empty()
        && frame_context.is_none()
    {
        return None;
    }
    Some(ScreenshotPolishExportPayload {
        proposal_id,
        selected_proposal_id,
        preview_image_path,
        changed_region_bounds,
        preserve_region_ids,
        rationale_codes,
        frame_context,
    })
}

fn resolve_legacy_export_request(
    run_dir: String,
    out_path: String,
    format: NativeExportFormat,
) -> Result<ResolvedExportRunRequest, String> {
    let run_dir_path = PathBuf::from(&run_dir);
    if !run_dir_path.exists() {
        return Err(format!("run dir not found: {run_dir}"));
    }

    let requested_out_path = PathBuf::from(&out_path);
    let normalized_out_path = normalize_export_out_path(&requested_out_path, &run_dir_path, format);
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
    Ok(ResolvedExportRunRequest {
        schema_version: 1,
        document_name: default_export_document_name(&run_dir_path),
        format,
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
        timeline_schema_version: None,
        timeline_head_node_id: None,
        action_sequence: derive_action_sequence(&edit_receipts),
        edit_receipts,
        limitations: merge_limitations(&default_export_limitations(format), &extra_limits),
        screenshot_polish: None,
    })
}

fn resolve_export_request(
    request: Option<ExportRunRequest>,
    run_dir: Option<String>,
    out_path: Option<String>,
) -> Result<ResolvedExportRunRequest, String> {
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
    let inferred_format = PathBuf::from(&out_path)
        .extension()
        .and_then(|value| value.to_str())
        .and_then(NativeExportFormat::parse)
        .unwrap_or(NativeExportFormat::Psd);
    resolve_legacy_export_request(run_dir, out_path, inferred_format)
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
        "<!doctype html><html><body><h1>Cue PSD Export</h1><p>PSD: {}</p><p>Receipt: {}</p><ul>{}</ul></body></html>",
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

fn build_screenshot_polish_receipt_metadata(
    screenshot_polish: &ScreenshotPolishExportPayload,
) -> Option<serde_json::Value> {
    let mut metadata = serde_json::Map::new();
    if let Some(proposal_id) = screenshot_polish.proposal_id.as_ref() {
        metadata.insert("proposalId".to_string(), serde_json::json!(proposal_id));
    }
    if let Some(selected_proposal_id) = screenshot_polish.selected_proposal_id.as_ref() {
        metadata.insert(
            "selectedProposalId".to_string(),
            serde_json::json!(selected_proposal_id),
        );
        metadata.insert(
            "approvedProposalId".to_string(),
            serde_json::json!(selected_proposal_id),
        );
    }
    if let Some(preview_image_path) = screenshot_polish.preview_image_path.as_ref() {
        metadata.insert(
            "previewImagePath".to_string(),
            serde_json::json!(preview_image_path),
        );
    }
    if let Some(changed_region_bounds) = screenshot_polish.changed_region_bounds.as_ref() {
        metadata.insert(
            "changedRegionBounds".to_string(),
            changed_region_bounds.clone(),
        );
    }
    if !screenshot_polish.preserve_region_ids.is_empty() {
        metadata.insert(
            "preserveRegionIds".to_string(),
            serde_json::json!(screenshot_polish.preserve_region_ids),
        );
    }
    if !screenshot_polish.rationale_codes.is_empty() {
        metadata.insert(
            "rationaleCodes".to_string(),
            serde_json::json!(screenshot_polish.rationale_codes),
        );
    }
    if let Some(frame_context) = screenshot_polish.frame_context.as_ref() {
        metadata.insert("frameContext".to_string(), frame_context.clone());
    }
    if metadata.is_empty() {
        None
    } else {
        Some(serde_json::Value::Object(metadata))
    }
}

fn build_export_receipt_payload(
    request: &ResolvedExportRunRequest,
    receipt_path: &Path,
    artifact_path: &Path,
    handoff_path: &Path,
    width: u32,
    height: u32,
    flattened_source_sha256: &str,
    output_sha256: &str,
) -> serde_json::Value {
    let format_id = request.format.id();
    let operation = request.format.operation();
    let export_contract = request.format.export_contract();
    let writer_id = request.format.writer_id();
    let background = request.format.background();
    let channel_count = if request.format.supports_alpha() {
        4
    } else {
        3
    };
    let run_id = run_id_from_run_dir(Path::new(&request.run_dir));
    let artifact_id = canonical_export_stem(
        Path::new(&request.flattened_source_path),
        handoff_path,
        request.format,
    );
    let artifact_path_text = artifact_path.to_string_lossy().to_string();
    let handoff_path_text = handoff_path.to_string_lossy().to_string();
    let receipt_path_text = receipt_path.to_string_lossy().to_string();
    let source_image_ids: Vec<String> = request
        .source_images
        .iter()
        .map(|image| image.id.clone())
        .collect();

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
    let source_artifacts: Vec<serde_json::Value> = request
        .source_images
        .iter()
        .map(|image| {
            serde_json::json!({
                "artifact_id": serde_json::Value::Null,
                "image_id": image.id,
                "path": image.path,
                "receipt_path": image.receipt_path,
                "role": "source_image",
            })
        })
        .collect();

    let timeline_nodes: Vec<serde_json::Value> = request
        .timeline_nodes
        .iter()
        .map(|node| {
            serde_json::json!({
                "node_id": node.node_id,
                "seq": node.seq,
                "kind": node.kind,
                "image_id": node.image_id,
                "path": node.path,
                "receipt_path": node.receipt_path,
                "label": node.label,
                "action": node.action,
                "parents": node.parents,
                "image_ids": node.image_ids,
                "preview_image_id": node.preview_image_id,
                "preview_path": node.preview_path,
                "receipt_paths": node.receipt_paths,
                "visual_mode": node.visual_mode,
                "detail": node.detail,
                "is_head": node.is_head,
                "created_at": node.created_at,
                "created_at_iso": node.created_at_iso,
            })
        })
        .collect();
    let timeline_parent_node_ids = request
        .timeline_head_node_id
        .as_ref()
        .and_then(|head_node_id| {
            request
                .timeline_nodes
                .iter()
                .find(|node| node.node_id.as_deref() == Some(head_node_id.as_str()))
        })
        .map(|node| normalize_export_string_list(node.parents.clone()))
        .unwrap_or_default();

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
    let screenshot_polish_metadata = if request.format == NativeExportFormat::Psd {
        request
            .screenshot_polish
            .as_ref()
            .and_then(build_screenshot_polish_receipt_metadata)
    } else {
        None
    };
    let include_screenshot_polish_trace = screenshot_polish_metadata.is_some();

    let mut provider_response = serde_json::json!({
        "writer": writer_id,
        "format": format_id,
        "encoded": {
            "version": 1,
            "channels": channel_count,
            "depth": 8,
            "color_mode": "rgb",
            "layer_strategy": "flattened_single_bitmap",
            "alpha_preserved": request.format.supports_alpha(),
        },
        "hashes": {
            "flattened_source_sha256": flattened_source_sha256,
            "output_sha256": output_sha256,
        },
    });
    if let Some(object) = provider_response.as_object_mut() {
        if request.format == NativeExportFormat::Psd {
            object.insert(
                "psd".to_string(),
                serde_json::json!({
                    "version": 1,
                    "channels": channel_count,
                    "depth": 8,
                    "color_mode": "rgb",
                    "layer_strategy": "flattened_single_bitmap",
                }),
            );
        } else {
            object.insert(
                "raster".to_string(),
                serde_json::json!({
                    "format": format_id,
                    "channels": channel_count,
                    "depth": 8,
                    "color_mode": "rgb",
                    "layer_strategy": "flattened_single_bitmap",
                    "alpha_preserved": request.format.supports_alpha(),
                }),
            );
        }
    }

    let mut request_metadata = serde_json::json!({
        "operation": operation,
        "export_contract": export_contract,
        "document_name": request.document_name,
        "canvas_mode": request.canvas_mode,
        "active_image_id": request.active_image_id,
        "timeline_schema_version": request.timeline_schema_version,
        "timeline_head_node_id": request.timeline_head_node_id,
        "artifact_path": artifact_path_text,
        "handoff_path": handoff_path_text,
        "receipt_path": receipt_path_text,
        "action_sequence": request.action_sequence,
        "limitations": limitations.clone(),
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
            "editReceipts": edit_receipts.clone(),
        },
    });
    if include_screenshot_polish_trace {
        if let Some(metadata) = request_metadata.as_object_mut() {
            if let Some(screenshot_polish) = screenshot_polish_metadata.as_ref() {
                metadata.insert("screenshotPolish".to_string(), screenshot_polish.clone());
            }
        }
    }

    let mut provider_request = serde_json::json!({
        "document_name": request.document_name,
        "flattened_source_path": request.flattened_source_path,
        "artifact_path": artifact_path_text,
        "handoff_path": handoff_path_text,
        "receipt_path": receipt_path_text,
        "source_image_count": request.source_images.len(),
        "source_images": source_images,
        "timeline_nodes": timeline_nodes,
        "timeline_schema_version": request.timeline_schema_version,
        "timeline_head_node_id": request.timeline_head_node_id,
        "edit_receipts": edit_receipts.clone(),
    });
    if include_screenshot_polish_trace {
        if let Some(metadata) = provider_request.as_object_mut() {
            if let Some(screenshot_polish) = screenshot_polish_metadata.as_ref() {
                metadata.insert("screenshotPolish".to_string(), screenshot_polish.clone());
            }
        }
    }

    let mut result_metadata = serde_json::json!({
        "operation": operation,
        "created_at": chrono::Utc::now().to_rfc3339(),
        "format": format_id,
        "document_name": request.document_name,
        "source_image_count": request.source_images.len(),
        "timeline_node_count": request.timeline_nodes.len(),
        "timeline_schema_version": request.timeline_schema_version,
        "timeline_head_node_id": request.timeline_head_node_id,
        "editable_layer_count": 0,
        "fidelity": request.format.fidelity(),
        "canvas_mode": request.canvas_mode,
        "active_image_id": request.active_image_id,
        "output_sha256": output_sha256,
        "flattened_source_sha256": flattened_source_sha256,
        "artifact_path": artifact_path_text,
        "handoff_path": handoff_path_text,
        "receipt_path": receipt_path_text,
        "limitations": limitations.clone(),
    });
    if include_screenshot_polish_trace {
        if let Some(metadata) = result_metadata.as_object_mut() {
            if let Some(screenshot_polish) = screenshot_polish_metadata.as_ref() {
                metadata.insert("screenshotPolish".to_string(), screenshot_polish.clone());
            }
        }
    }

    serde_json::json!({
        "schema_version": request.schema_version,
        "receipt_kind": operation,
        "run_id": run_id,
        "artifact": {
            "artifact_id": artifact_id,
            "role": "output",
            "path": artifact_path_text,
            "media_type": request.format.media_type(),
            "width": width,
            "height": height,
            "source_image_ids": source_image_ids,
            "timeline_node_id": request.timeline_head_node_id,
            "receipt_path": receipt_path_text,
            "sha256": output_sha256,
        },
        "request": {
            "prompt": "",
            "mode": "local",
            "size": format!("{width}x{height}"),
            "n": 1,
            "seed": null,
            "output_format": format_id,
            "inputs": {
                "init_image": request.flattened_source_path,
                "mask": null,
                "reference_images": request.source_images.iter().map(|image| image.path.clone()).collect::<Vec<_>>(),
            },
            "provider": "local",
            "model": writer_id,
            "provider_options": {},
            "out_dir": request.run_dir,
            "metadata": request_metadata,
        },
        "resolved": {
            "provider": "local",
            "model": writer_id,
            "size": format!("{width}x{height}"),
            "width": width,
            "height": height,
            "output_format": format_id,
            "background": background,
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
                "channel_count": channel_count,
                "color_mode": "rgb",
                "alpha_preserved": request.format.supports_alpha(),
            },
            "warnings": limitations.clone(),
        },
        "provider_request": provider_request,
        "provider_response": provider_response,
        "warnings": limitations,
        "timeline": {
            "node_id": serde_json::Value::Null,
            "head_node_id": request.timeline_head_node_id,
            "parent_node_ids": timeline_parent_node_ids,
        },
        "source_artifacts": source_artifacts,
        "artifacts": {
            "image_path": artifact_path_text,
            "artifact_path": artifact_path_text,
            "flattened_source_path": request.flattened_source_path,
            "export_path": handoff_path_text,
            "receipt_path": receipt_path_text,
        },
        "result_metadata": result_metadata,
    })
}

#[tauri::command]
fn export_run(
    request: Option<ExportRunRequest>,
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
    let artifact_path = canonical_export_artifact_path(
        &run_dir_path,
        &flattened_source_path,
        &out_path_buf,
        request.format,
    );
    if let Some(parent) = artifact_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let receipt_path = canonical_export_receipt_path(
        &run_dir_path,
        &flattened_source_path,
        &out_path_buf,
        request.format,
    );
    if let Some(parent) = receipt_path.parent() {
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
    let encoded_bytes = encode_flattened_export(request.format, &rgba)?;
    let output_sha256 = sha256_hex(&encoded_bytes);
    std::fs::write(&artifact_path, &encoded_bytes)
        .map_err(|e| format!("{}: {e}", artifact_path.to_string_lossy()))?;
    if artifact_path != out_path_buf {
        std::fs::copy(&artifact_path, &out_path_buf)
            .map_err(|e| format!("{}: {e}", out_path_buf.to_string_lossy()))?;
    }
    let receipt_payload = build_export_receipt_payload(
        &request,
        &receipt_path,
        &artifact_path,
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
    if request.format == NativeExportFormat::Psd && requested_out_path != out_path_buf {
        write_legacy_export_pointer(
            &requested_out_path,
            &out_path_buf,
            &receipt_path,
            &request.limitations,
        )?;
    }

    let mut payload = serde_json::json!({
        "ok": true,
        "exportPath": out_path_buf.to_string_lossy().to_string(),
        "artifactPath": artifact_path.to_string_lossy().to_string(),
        "receiptPath": receipt_path.to_string_lossy().to_string(),
        "format": request.format.id(),
        "limitations": request.limitations,
        "outPath": out_path_buf.to_string_lossy().to_string(),
        "out_path": out_path_buf.to_string_lossy().to_string(),
        "artifact_path": artifact_path.to_string_lossy().to_string(),
        "receipt_path": receipt_path.to_string_lossy().to_string(),
        "flattened_source_path": flattened_source_path.to_string_lossy().to_string(),
        "width": width,
        "height": height,
        "output_sha256": output_sha256,
    });
    if let Some(object) = payload.as_object_mut() {
        let legacy_key = match request.format {
            NativeExportFormat::Psd => "psdPath",
            NativeExportFormat::Png => "pngPath",
            NativeExportFormat::Jpg => "jpgPath",
            NativeExportFormat::Webp => "webpPath",
            NativeExportFormat::Tiff => "tiffPath",
        };
        object.insert(
            legacy_key.to_string(),
            serde_json::json!(out_path_buf.to_string_lossy().to_string()),
        );
    }
    Ok(payload)
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

    let configured_global = env_value(&vars, &["CUE_REALTIME_PROVIDER", "BROOD_REALTIME_PROVIDER"])
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
    let resolve_provider = |keys: &[&str]| -> RealtimeProvider {
        env_value(&vars, keys)
            .and_then(|raw| RealtimeProvider::from_raw(raw))
            .or(configured_global)
            .unwrap_or_else(infer_default)
    };
    let canvas_provider = resolve_provider(&[
        "CUE_CANVAS_CONTEXT_REALTIME_PROVIDER",
        "BROOD_CANVAS_CONTEXT_REALTIME_PROVIDER",
    ]);
    let intent_provider = resolve_provider(&[
        "CUE_INTENT_REALTIME_PROVIDER",
        "BROOD_INTENT_REALTIME_PROVIDER",
    ]);
    let mother_intent_provider = resolve_provider(&[
        "CUE_MOTHER_INTENT_REALTIME_PROVIDER",
        "BROOD_MOTHER_INTENT_REALTIME_PROVIDER",
    ]);
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

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ReviewPlannerRequestErrorKind {
    Transport,
    Remote,
}

#[derive(Clone, Debug)]
struct ReviewPlannerRequestError {
    kind: ReviewPlannerRequestErrorKind,
    message: String,
}

impl ReviewPlannerRequestError {
    fn transport(message: String) -> Self {
        Self {
            kind: ReviewPlannerRequestErrorKind::Transport,
            message,
        }
    }

    fn remote(message: String) -> Self {
        Self {
            kind: ReviewPlannerRequestErrorKind::Remote,
            message,
        }
    }
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
    session.last_response_id = None;
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

fn review_provider_label(provider: &str) -> &'static str {
    match provider {
        "openrouter" => "OpenRouter",
        "openai" => "OpenAI",
        _ => "Planner",
    }
}

fn review_format_planner_http_error_for_transport(
    provider: &str,
    normalized_model: &str,
    transport: &str,
    status: u16,
    body: &str,
) -> String {
    let base = review_format_planner_http_error(provider, normalized_model, status, body);
    let status_tag = format!(", status={status}");
    if let Some((prefix, suffix)) = base.split_once(&status_tag) {
        return format!("{prefix}, transport={transport}{status_tag}{suffix}");
    }
    format!("{base} (transport={transport})")
}

fn review_is_transport_io_error_kind(kind: std::io::ErrorKind) -> bool {
    matches!(
        kind,
        std::io::ErrorKind::WouldBlock
            | std::io::ErrorKind::TimedOut
            | std::io::ErrorKind::ConnectionReset
            | std::io::ErrorKind::ConnectionAborted
            | std::io::ErrorKind::BrokenPipe
            | std::io::ErrorKind::UnexpectedEof
            | std::io::ErrorKind::NotConnected
    )
}

fn review_is_openai_ws_timeout_error(error: &tungstenite::Error) -> bool {
    matches!(
        error,
        tungstenite::Error::Io(io_error)
            if matches!(
                io_error.kind(),
                std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
            )
    )
}

fn review_is_openai_ws_transport_error(error: &tungstenite::Error) -> bool {
    match error {
        tungstenite::Error::ConnectionClosed | tungstenite::Error::AlreadyClosed => true,
        tungstenite::Error::Io(io_error) => review_is_transport_io_error_kind(io_error.kind()),
        tungstenite::Error::Tls(_) => true,
        _ => false,
    }
}

fn review_format_planner_transport_timeout(
    provider: &str,
    normalized_model: &str,
    transport: &str,
    stage: &str,
    timeout: Duration,
    detail: &str,
) -> String {
    let provider_label = review_provider_label(provider);
    let trimmed = detail.trim();
    if trimmed.is_empty() {
        return format!(
            "{provider_label} planner transport timed out (provider={provider}, normalized model={normalized_model}, transport={transport}, stage={stage}, timeout_seconds={}).",
            timeout.as_secs()
        );
    }
    format!(
        "{provider_label} planner transport timed out (provider={provider}, normalized model={normalized_model}, transport={transport}, stage={stage}, timeout_seconds={}): {trimmed}",
        timeout.as_secs()
    )
}

fn review_format_planner_transport_failure(
    provider: &str,
    normalized_model: &str,
    transport: &str,
    stage: &str,
    detail: &str,
) -> String {
    let provider_label = review_provider_label(provider);
    let trimmed = detail.trim();
    if trimmed.is_empty() {
        return format!(
            "{provider_label} planner transport failed (provider={provider}, normalized model={normalized_model}, transport={transport}, stage={stage})."
        );
    }
    format!(
        "{provider_label} planner transport failed (provider={provider}, normalized model={normalized_model}, transport={transport}, stage={stage}): {trimmed}"
    )
}

fn review_format_planner_remote_failure(
    provider: &str,
    normalized_model: &str,
    transport: &str,
    stage: &str,
    detail: &str,
) -> String {
    let provider_label = review_provider_label(provider);
    let trimmed = detail.trim();
    if trimmed.is_empty() {
        return format!(
            "{provider_label} planner request failed (provider={provider}, normalized model={normalized_model}, transport={transport}, stage={stage})."
        );
    }
    format!(
        "{provider_label} planner request failed (provider={provider}, normalized model={normalized_model}, transport={transport}, stage={stage}): {trimmed}"
    )
}

fn review_should_fallback_openai_ws_error(error: &ReviewPlannerRequestError) -> bool {
    error.kind == ReviewPlannerRequestErrorKind::Transport
}

fn review_build_openai_planner_payload(
    prompt: &str,
    image_urls: &[String],
    model: &str,
    reasoning_effort: &str,
    text_verbosity: &str,
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
        "text": {
            "verbosity": text_verbosity,
        },
        "reasoning": {
            "effort": reasoning_effort,
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
    reasoning_effort: &str,
    text_verbosity: &str,
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
        "text": {
            "verbosity": text_verbosity,
        },
        "reasoning": {
            "effort": reasoning_effort,
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
    reasoning_effort: &str,
    text_verbosity: &str,
    transport: &str,
    request_timeout: Duration,
    timeout_detail: &str,
) -> Result<serde_json::Value, String> {
    let payload = review_build_openai_planner_payload(
        prompt,
        image_urls,
        normalized_model,
        reasoning_effort,
        text_verbosity,
    );
    let response = client
        .post("https://api.openai.com/v1/responses")
        .bearer_auth(api_key)
        .header("content-type", "application/json")
        .json(&payload)
        .send()
        .map_err(|error| {
            if error.is_timeout() {
                return review_format_planner_transport_timeout(
                    "openai",
                    normalized_model,
                    transport,
                    "request",
                    request_timeout,
                    timeout_detail,
                );
            }
            review_format_planner_transport_failure(
                "openai",
                normalized_model,
                transport,
                "request",
                &error.to_string(),
            )
        })?;
    let status = response.status();
    let body = response.text().map_err(|e| {
        review_format_planner_transport_failure(
            "openai",
            normalized_model,
            transport,
            "read_body",
            &e.to_string(),
        )
    })?;
    if !status.is_success() {
        return Err(review_format_planner_http_error_for_transport(
            "openai",
            normalized_model,
            transport,
            status.as_u16(),
            &body,
        ));
    }
    let parsed: serde_json::Value =
        serde_json::from_str(&body).unwrap_or_else(|_| serde_json::json!({ "raw": body.clone() }));
    Ok(serde_json::json!({
        "provider": "openai",
        "model": normalized_model,
        "transport": transport,
        "text": review_extract_openai_output_text(&parsed),
        "response_id": review_extract_openai_ws_response_id(&parsed),
        "raw": parsed,
    }))
}

fn review_openai_ws_connect(
    session: &mut ReviewResponsesWsSession,
    api_key: &str,
    normalized_model: &str,
) -> Result<(), ReviewPlannerRequestError> {
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
        .map_err(|e| {
            ReviewPlannerRequestError::transport(review_format_planner_transport_failure(
                "openai",
                normalized_model,
                REVIEW_OPENAI_RESPONSES_WS_TRANSPORT,
                "connect_request",
                &e.to_string(),
            ))
        })?;
    let auth_header = format!("Bearer {api_key}").parse().map_err(|e| {
        ReviewPlannerRequestError::transport(review_format_planner_transport_failure(
            "openai",
            normalized_model,
            REVIEW_OPENAI_RESPONSES_WS_TRANSPORT,
            "connect_auth",
            &format!("invalid websocket auth header: {e}"),
        ))
    })?;
    request.headers_mut().insert("Authorization", auth_header);
    let (mut socket, _) = connect(request).map_err(|e| {
        ReviewPlannerRequestError::transport(review_format_planner_transport_failure(
            "openai",
            normalized_model,
            REVIEW_OPENAI_RESPONSES_WS_TRANSPORT,
            "connect",
            &e.to_string(),
        ))
    })?;
    review_set_stream_timeouts(socket.get_mut(), REVIEW_OPENAI_RESPONSES_WS_IO_TIMEOUT).map_err(
        |e| {
            ReviewPlannerRequestError::transport(review_format_planner_transport_failure(
                "openai",
                normalized_model,
                REVIEW_OPENAI_RESPONSES_WS_TRANSPORT,
                "connect_timeout_setup",
                &e,
            ))
        },
    )?;
    session.connected_at = Some(Instant::now());
    session.socket = Some(socket);
    Ok(())
}

fn review_openai_planner_ws_request_inner(
    socket: &mut WebSocket<MaybeTlsStream<TcpStream>>,
    prompt: &str,
    image_urls: &[String],
    normalized_model: &str,
    reasoning_effort: &str,
    text_verbosity: &str,
    previous_response_id: Option<&str>,
) -> Result<(String, Option<String>, serde_json::Value), ReviewPlannerRequestError> {
    let event = review_build_openai_planner_ws_event(
        prompt,
        image_urls,
        normalized_model,
        reasoning_effort,
        text_verbosity,
        previous_response_id,
    );
    socket
        .send(Message::Text(event.to_string().into()))
        .map_err(|e| {
            ReviewPlannerRequestError::transport(review_format_planner_transport_failure(
                "openai",
                normalized_model,
                REVIEW_OPENAI_RESPONSES_WS_TRANSPORT,
                "send",
                &e.to_string(),
            ))
        })?;

    let mut streamed_text = String::new();
    let started_at = Instant::now();
    let mut last_event_at = started_at;
    let mut saw_any_event = false;
    loop {
        if started_at.elapsed() >= REVIEW_OPENAI_RESPONSES_WS_COMPLETION_TIMEOUT {
            let detail = if streamed_text.trim().is_empty() {
                "OpenAI planner websocket did not reach response.completed within the bounded wait."
            } else {
                "OpenAI planner websocket produced partial planner output but did not reach response.completed within the bounded wait."
            };
            return Err(ReviewPlannerRequestError::transport(
                review_format_planner_transport_timeout(
                    "openai",
                    normalized_model,
                    REVIEW_OPENAI_RESPONSES_WS_TRANSPORT,
                    "completion_wait",
                    REVIEW_OPENAI_RESPONSES_WS_COMPLETION_TIMEOUT,
                    detail,
                ),
            ));
        }

        let message = socket.read().map_err(|e| {
            if review_is_openai_ws_timeout_error(&e) {
                let (stage, timeout, detail) = if saw_any_event {
                    (
                        "read_idle",
                        REVIEW_OPENAI_RESPONSES_WS_IO_TIMEOUT,
                        format!(
                            "OpenAI planner websocket stopped delivering events for {} seconds after planner activity: {e}",
                            last_event_at.elapsed().as_secs()
                        ),
                    )
                } else {
                    (
                        "warmup",
                        REVIEW_OPENAI_RESPONSES_WS_FIRST_EVENT_TIMEOUT,
                        format!(
                            "OpenAI planner websocket delivered no planner events within {} seconds: {e}",
                            started_at.elapsed().as_secs()
                        ),
                    )
                };
                ReviewPlannerRequestError::transport(review_format_planner_transport_timeout(
                    "openai",
                    normalized_model,
                    REVIEW_OPENAI_RESPONSES_WS_TRANSPORT,
                    stage,
                    timeout,
                    &detail,
                ))
            } else if review_is_openai_ws_transport_error(&e) {
                ReviewPlannerRequestError::transport(review_format_planner_transport_failure(
                    "openai",
                    normalized_model,
                    REVIEW_OPENAI_RESPONSES_WS_TRANSPORT,
                    "read",
                    &e.to_string(),
                ))
            } else {
                ReviewPlannerRequestError::remote(review_format_planner_remote_failure(
                    "openai",
                    normalized_model,
                    REVIEW_OPENAI_RESPONSES_WS_TRANSPORT,
                    "read",
                    &e.to_string(),
                ))
            }
        })?;
        saw_any_event = true;
        last_event_at = Instant::now();
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
                        return Err(ReviewPlannerRequestError::remote(
                            review_format_planner_remote_failure(
                                "openai",
                                normalized_model,
                                REVIEW_OPENAI_RESPONSES_WS_TRANSPORT,
                                event_type,
                                &review_extract_openai_ws_error(&parsed),
                            ),
                        ));
                    }
                    _ => {}
                }
            }
            Message::Ping(payload) => {
                socket.send(Message::Pong(payload)).map_err(|e| {
                    ReviewPlannerRequestError::transport(review_format_planner_transport_failure(
                        "openai",
                        normalized_model,
                        REVIEW_OPENAI_RESPONSES_WS_TRANSPORT,
                        "ping_reply",
                        &e.to_string(),
                    ))
                })?;
            }
            Message::Close(frame) => {
                let detail = frame
                    .as_ref()
                    .map(|value| value.reason.to_string())
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| "connection closed".to_string());
                return Err(ReviewPlannerRequestError::transport(
                    review_format_planner_transport_failure(
                        "openai",
                        normalized_model,
                        REVIEW_OPENAI_RESPONSES_WS_TRANSPORT,
                        "closed",
                        &detail,
                    ),
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
    reasoning_effort: &str,
    text_verbosity: &str,
    previous_response_id: Option<&str>,
) -> Result<serde_json::Value, ReviewPlannerRequestError> {
    let result = {
        let Some(socket) = session.socket.as_mut() else {
            return Err(ReviewPlannerRequestError::transport(
                review_format_planner_transport_failure(
                    "openai",
                    normalized_model,
                    REVIEW_OPENAI_RESPONSES_WS_TRANSPORT,
                    "session",
                    "OpenAI planner websocket session is unavailable.",
                ),
            ));
        };
        review_openai_planner_ws_request_inner(
            socket,
            prompt,
            image_urls,
            normalized_model,
            reasoning_effort,
            text_verbosity,
            previous_response_id,
        )
    };
    match result {
        Ok((text, response_id, raw)) => {
            session.last_response_id = response_id.clone();
            Ok(serde_json::json!({
                "provider": "openai",
                "model": normalized_model,
                "transport": REVIEW_OPENAI_RESPONSES_WS_TRANSPORT,
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
        request = request.header("X-Title", "Cue");
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
                .map_err(|e| format!("Google image decode failed: {e}"))?;
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

fn review_apply_image_path(value: Option<&serde_json::Value>) -> Option<String> {
    value
        .and_then(|entry| {
            entry
                .get("path")
                .and_then(|value| value.as_str())
                .map(|value| value.to_string())
                .or_else(|| entry.as_str().map(|value| value.to_string()))
        })
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn review_apply_reference_paths(value: Option<&serde_json::Value>) -> Vec<String> {
    value
        .and_then(|entry| entry.as_array())
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|entry| review_apply_image_path(Some(&entry)))
        .collect()
}

fn review_google_inline_image_part(path: &str) -> Result<serde_json::Value, String> {
    let bytes = std::fs::read(path).map_err(|error| format!("{path}: {error}"))?;
    Ok(serde_json::json!({
        "inlineData": {
            "mimeType": review_mime_type_from_path(Path::new(path)),
            "data": BASE64_STANDARD.encode(bytes),
        }
    }))
}

fn review_build_google_apply_parts(
    prompt: &str,
    target_image_path: &str,
    reference_image_paths: &[String],
) -> Result<Vec<serde_json::Value>, String> {
    let mut parts = vec![
        serde_json::json!({ "text": prompt }),
        serde_json::json!({ "text": "targetImage (editable image to modify)" }),
        review_google_inline_image_part(target_image_path)?,
    ];
    for (index, reference_path) in reference_image_paths.iter().enumerate() {
        parts.push(serde_json::json!({
            "text": format!("referenceImages[{index}] (guidance only; do not edit directly)"),
        }));
        parts.push(review_google_inline_image_part(reference_path)?);
    }
    Ok(parts)
}

fn review_build_openrouter_apply_input(
    prompt: &str,
    target_image_path: &str,
    reference_image_paths: &[String],
) -> Result<Vec<serde_json::Value>, String> {
    let mut content = vec![
        serde_json::json!({ "type": "input_text", "text": prompt }),
        serde_json::json!({ "type": "input_text", "text": "targetImage (editable image to modify)" }),
        serde_json::json!({ "type": "input_image", "image_url": review_image_data_url(target_image_path)? }),
    ];
    for (index, reference_path) in reference_image_paths.iter().enumerate() {
        content.push(serde_json::json!({
            "type": "input_text",
            "text": format!("referenceImages[{index}] (guidance only; do not edit directly)"),
        }));
        content.push(serde_json::json!({
            "type": "input_image",
            "image_url": review_image_data_url(reference_path)?,
        }));
    }
    Ok(content)
}

fn review_normalize_apply_model(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return DESIGN_REVIEW_APPLY_MODEL.to_string();
    }
    let lower = trimmed.to_ascii_lowercase();
    if lower == "gemini nano banana 2"
        || lower == "nano banana 2"
        || lower == "gemini-nano-banana-2"
    {
        return DESIGN_REVIEW_APPLY_MODEL.to_string();
    }
    let without_models = trimmed
        .strip_prefix("models/")
        .map(str::trim)
        .unwrap_or(trimmed);
    let without_google = without_models
        .strip_prefix("google/")
        .map(str::trim)
        .unwrap_or(without_models);
    if without_google.eq_ignore_ascii_case(DESIGN_REVIEW_APPLY_MODEL)
        || without_google.eq_ignore_ascii_case("gemini-nano-banana-2")
    {
        return DESIGN_REVIEW_APPLY_MODEL.to_string();
    }
    without_google.to_string()
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct ReviewApplyImageConfig {
    aspect_ratio: &'static str,
    image_size: &'static str,
}

const REVIEW_APPLY_SUPPORTED_ASPECT_RATIOS: [(&str, f64); 8] = [
    ("1:1", 1.0),
    ("2:3", 2.0 / 3.0),
    ("3:2", 3.0 / 2.0),
    ("3:4", 3.0 / 4.0),
    ("4:3", 4.0 / 3.0),
    ("9:16", 9.0 / 16.0),
    ("16:9", 16.0 / 9.0),
    ("21:9", 21.0 / 9.0),
];

const REVIEW_APPLY_SUPPORTED_IMAGE_SIZES: [(&str, u32); 3] =
    [("1K", 1024), ("2K", 2048), ("4K", 4096)];

fn review_read_image_dimensions(path: &str) -> Option<(u32, u32)> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return None;
    }
    image::image_dimensions(trimmed).ok()
}

fn review_choose_apply_aspect_ratio(target_width: u32, target_height: u32) -> &'static str {
    let width = f64::from(target_width.max(1));
    let height = f64::from(target_height.max(1));
    let target_log_aspect = (width / height).ln();
    let mut best = REVIEW_APPLY_SUPPORTED_ASPECT_RATIOS[0];
    let mut best_score = f64::INFINITY;
    for candidate in REVIEW_APPLY_SUPPORTED_ASPECT_RATIOS {
        let score = (target_log_aspect - candidate.1.ln()).abs();
        if score + f64::EPSILON < best_score {
            best = candidate;
            best_score = score;
        }
    }
    best.0
}

fn review_choose_apply_image_size(target_width: u32, target_height: u32) -> &'static str {
    let target_long_side = target_width.max(target_height);
    let mut best = REVIEW_APPLY_SUPPORTED_IMAGE_SIZES[0];
    let mut best_diff = u32::MAX;
    for candidate in REVIEW_APPLY_SUPPORTED_IMAGE_SIZES {
        let diff = candidate.1.abs_diff(target_long_side);
        if diff < best_diff || (diff == best_diff && candidate.1 > best.1) {
            best = candidate;
            best_diff = diff;
        }
    }
    best.0
}

fn review_resolve_apply_image_config(target_image_path: &str) -> Option<ReviewApplyImageConfig> {
    let (target_width, target_height) = review_read_image_dimensions(target_image_path)?;
    if target_width == 0 || target_height == 0 {
        return None;
    }
    Some(ReviewApplyImageConfig {
        aspect_ratio: review_choose_apply_aspect_ratio(target_width, target_height),
        image_size: review_choose_apply_image_size(target_width, target_height),
    })
}

fn review_apply_debug_payload(
    provider: &str,
    requested_model: &str,
    normalized_model: &str,
    transport: &str,
    prompt: &str,
    target_image_path: &str,
    reference_image_paths: &[String],
    output_path: &str,
) -> serde_json::Value {
    serde_json::json!({
        "provider": provider,
        "requestedModel": requested_model,
        "normalizedModel": normalized_model,
        "transport": transport,
        "prompt": prompt,
        "targetImagePath": target_image_path,
        "referenceImagePaths": reference_image_paths,
        "outputPath": output_path,
        "route": {
            "kind": "apply",
            "provider": provider,
            "requestedModel": requested_model,
            "normalizedModel": normalized_model,
            "model": requested_model,
            "apiPlan": {
                "primaryTransport": transport,
            },
        },
    })
}

fn review_apply_error(
    message: &str,
    provider: &str,
    requested_model: &str,
    normalized_model: &str,
    transport: &str,
    prompt: &str,
    target_image_path: &str,
    reference_image_paths: &[String],
    output_path: &str,
) -> String {
    serde_json::json!({
        "message": message,
        "debugInfo": review_apply_debug_payload(
            provider,
            requested_model,
            normalized_model,
            transport,
            prompt,
            target_image_path,
            reference_image_paths,
            output_path,
        ),
        "failure": {
            "message": message,
        },
    })
    .to_string()
}

fn review_format_apply_http_error(
    provider: &str,
    normalized_model: &str,
    transport: &str,
    status: u16,
    body: &str,
) -> String {
    let provider_label = if provider.eq_ignore_ascii_case("openrouter") {
        "OpenRouter"
    } else {
        "Google"
    };
    let detail = review_extract_error_detail(body);
    if detail.is_empty() {
        return format!(
            "{provider_label} final apply request failed (provider={provider}, normalized model={normalized_model}, transport={transport}, status={status})."
        );
    }
    format!(
        "{provider_label} final apply request failed (provider={provider}, normalized model={normalized_model}, transport={transport}, status={status}): {detail}"
    )
}

fn run_design_review_apply_request(
    request: &serde_json::Value,
    vars: &HashMap<String, String>,
) -> Result<serde_json::Value, String> {
    let provider_pref = request
        .get("provider")
        .and_then(|value| value.as_str())
        .unwrap_or("google")
        .trim()
        .to_ascii_lowercase();
    let requested_model = request
        .get("requestedModel")
        .and_then(|value| value.as_str())
        .or_else(|| request.get("model").and_then(|value| value.as_str()))
        .unwrap_or(DESIGN_REVIEW_APPLY_MODEL)
        .trim()
        .to_string();
    let normalized_model = review_normalize_apply_model(&requested_model);
    let prompt = request
        .get("prompt")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .trim()
        .to_string();
    let target_image_path = review_apply_image_path(request.get("targetImage")).unwrap_or_default();
    let mut reference_image_paths = review_apply_reference_paths(request.get("referenceImages"));
    let output_path = request
        .get("outputPath")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .trim()
        .to_string();
    reference_image_paths.retain(|path| path != &target_image_path);
    let mut deduped_reference_image_paths = Vec::new();
    for path in reference_image_paths {
        if deduped_reference_image_paths
            .iter()
            .any(|existing| existing == &path)
        {
            continue;
        }
        deduped_reference_image_paths.push(path);
    }
    let reference_image_paths = deduped_reference_image_paths;

    let gemini_api_key = review_first_non_empty(vars, &["GEMINI_API_KEY", "GOOGLE_API_KEY"]);
    let openrouter_api_key = review_first_non_empty(vars, &["OPENROUTER_API_KEY"]);
    let resolved_provider = match provider_pref.as_str() {
        "google" => {
            if gemini_api_key.is_some() {
                "google"
            } else {
                return Err(review_apply_error(
                    "No Google Gemini credentials are configured for design review final apply. Set GEMINI_API_KEY or GOOGLE_API_KEY.",
                    "google",
                    &requested_model,
                    &normalized_model,
                    REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT,
                    &prompt,
                    &target_image_path,
                    &reference_image_paths,
                    &output_path,
                ));
            }
        }
        "openrouter" => {
            if openrouter_api_key.is_some() {
                "openrouter"
            } else {
                return Err(review_apply_error(
                    "No OpenRouter credentials are configured for design review final apply. Set OPENROUTER_API_KEY.",
                    "openrouter",
                    &requested_model,
                    &normalized_model,
                    REVIEW_OPENROUTER_RESPONSES_TRANSPORT,
                    &prompt,
                    &target_image_path,
                    &reference_image_paths,
                    &output_path,
                ));
            }
        }
        "auto" => {
            if gemini_api_key.is_some() {
                "google"
            } else if openrouter_api_key.is_some() {
                "openrouter"
            } else {
                return Err(review_apply_error(
                    "No final apply credentials are configured for design review. Set GEMINI_API_KEY or GOOGLE_API_KEY or OPENROUTER_API_KEY.",
                    "auto",
                    &requested_model,
                    &normalized_model,
                    REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT,
                    &prompt,
                    &target_image_path,
                    &reference_image_paths,
                    &output_path,
                ));
            }
        }
        other => {
            return Err(review_apply_error(
                &format!(
                    "Edit proposal apply only supports provider=google or provider=openrouter (requested provider={other})."
                ),
                other,
                &requested_model,
                &normalized_model,
                REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT,
                &prompt,
                &target_image_path,
                &reference_image_paths,
                &output_path,
            ));
        }
    };
    let resolved_transport = if resolved_provider == "openrouter" {
        REVIEW_OPENROUTER_RESPONSES_TRANSPORT
    } else {
        REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT
    };
    if prompt.is_empty() {
        return Err(review_apply_error(
            "design review apply prompt missing",
            resolved_provider,
            &requested_model,
            &normalized_model,
            resolved_transport,
            &prompt,
            &target_image_path,
            &reference_image_paths,
            &output_path,
        ));
    }
    if target_image_path.is_empty() {
        return Err(review_apply_error(
            "design review apply targetImage path missing",
            resolved_provider,
            &requested_model,
            &normalized_model,
            resolved_transport,
            &prompt,
            &target_image_path,
            &reference_image_paths,
            &output_path,
        ));
    }
    if output_path.is_empty() {
        return Err(review_apply_error(
            "design review apply outputPath missing",
            resolved_provider,
            &requested_model,
            &normalized_model,
            resolved_transport,
            &prompt,
            &target_image_path,
            &reference_image_paths,
            &output_path,
        ));
    }
    let target_image_config = review_resolve_apply_image_config(&target_image_path);

    if resolved_provider == "google" {
        let api_key = gemini_api_key.as_deref().ok_or_else(|| {
            review_apply_error(
                "No Google Gemini credentials are configured for design review final apply. Set GEMINI_API_KEY or GOOGLE_API_KEY.",
                "google",
                &requested_model,
                &normalized_model,
                REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT,
                &prompt,
                &target_image_path,
                &reference_image_paths,
                &output_path,
            )
        })?;
        let parts =
            review_build_google_apply_parts(&prompt, &target_image_path, &reference_image_paths)
                .map_err(|error| {
                    review_apply_error(
                        &format!("design review apply could not stage image inputs: {error}"),
                        "google",
                        &requested_model,
                        &normalized_model,
                        REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT,
                        &prompt,
                        &target_image_path,
                        &reference_image_paths,
                        &output_path,
                    )
                })?;
        let endpoint_base = review_first_non_empty(vars, &["GEMINI_API_BASE"])
            .unwrap_or_else(|| "https://generativelanguage.googleapis.com/v1beta".to_string());
        let endpoint = format!("{endpoint_base}/models/{normalized_model}:generateContent");
        let image_config = if let Some(config) = target_image_config {
            serde_json::json!({
                "imageSize": config.image_size,
                "aspectRatio": config.aspect_ratio,
            })
        } else {
            serde_json::json!({
                "imageSize": "2K",
            })
        };
        let payload = serde_json::json!({
            "contents": [{
                "role": "user",
                "parts": parts,
            }],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
                "imageConfig": image_config,
            }
        });
        let client = Client::builder()
            .timeout(Duration::from_secs(150))
            .build()
            .map_err(|error| {
                review_apply_error(
                    &format!("design review apply client setup failed: {error}"),
                    "google",
                    &requested_model,
                    &normalized_model,
                    REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT,
                    &prompt,
                    &target_image_path,
                    &reference_image_paths,
                    &output_path,
                )
            })?;
        let response = client
            .post(endpoint)
            .query(&[("key", api_key)])
            .header("content-type", "application/json")
            .json(&payload)
            .send()
            .map_err(|error| {
                review_apply_error(
                    &format!("Google final apply request failed: {error}"),
                    "google",
                    &requested_model,
                    &normalized_model,
                    REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT,
                    &prompt,
                    &target_image_path,
                    &reference_image_paths,
                    &output_path,
                )
            })?;
        let status = response.status();
        let body = response.text().map_err(|error| {
            review_apply_error(
                &format!("Google final apply response read failed: {error}"),
                "google",
                &requested_model,
                &normalized_model,
                REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT,
                &prompt,
                &target_image_path,
                &reference_image_paths,
                &output_path,
            )
        })?;
        if !status.is_success() {
            return Err(review_apply_error(
                &review_format_apply_http_error(
                    "google",
                    &normalized_model,
                    REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT,
                    status.as_u16(),
                    &body,
                ),
                "google",
                &requested_model,
                &normalized_model,
                REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT,
                &prompt,
                &target_image_path,
                &reference_image_paths,
                &output_path,
            ));
        }

        let parsed: serde_json::Value = serde_json::from_str(&body)
            .unwrap_or_else(|_| serde_json::json!({ "raw": body.clone() }));
        let images = review_google_extract_images(&parsed).map_err(|error| {
            review_apply_error(
                &format!("Google final apply image decode failed: {error}"),
                "google",
                &requested_model,
                &normalized_model,
                REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT,
                &prompt,
                &target_image_path,
                &reference_image_paths,
                &output_path,
            )
        })?;
        if images.len() != 1 {
            return Err(review_apply_error(
                &format!(
                    "Google final apply must return exactly one image for targetImage, but returned {}.",
                    images.len()
                ),
                "google",
                &requested_model,
                &normalized_model,
                REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT,
                &prompt,
                &target_image_path,
                &reference_image_paths,
                &output_path,
            ));
        }
        let (bytes, mime_type) = images.into_iter().next().unwrap_or_default();
        if let Some(parent) = Path::new(&output_path).parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent).map_err(|error| {
                    review_apply_error(
                        &format!("design review apply could not create output directory: {error}"),
                        "google",
                        &requested_model,
                        &normalized_model,
                        REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT,
                        &prompt,
                        &target_image_path,
                        &reference_image_paths,
                        &output_path,
                    )
                })?;
            }
        }
        std::fs::write(&output_path, bytes).map_err(|error| {
            review_apply_error(
                &format!("design review apply could not write output image: {error}"),
                "google",
                &requested_model,
                &normalized_model,
                REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT,
                &prompt,
                &target_image_path,
                &reference_image_paths,
                &output_path,
            )
        })?;

        return Ok(serde_json::json!({
            "ok": true,
            "provider": "google",
            "requestedModel": requested_model,
            "normalizedModel": normalized_model,
            "model": normalized_model,
            "transport": REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT,
            "prompt": prompt,
            "targetImagePath": target_image_path,
            "referenceImagePaths": reference_image_paths,
            "outputPath": output_path,
            "mimeType": mime_type,
            "targetOutputConfig": target_image_config.map(|config| serde_json::json!({
                "imageSize": config.image_size,
                "aspectRatio": config.aspect_ratio,
            })),
            "raw": parsed,
        }));
    }

    let api_key = openrouter_api_key.as_deref().ok_or_else(|| {
        review_apply_error(
            "No OpenRouter credentials are configured for design review final apply. Set OPENROUTER_API_KEY.",
            "openrouter",
            &requested_model,
            &normalized_model,
            REVIEW_OPENROUTER_RESPONSES_TRANSPORT,
            &prompt,
            &target_image_path,
            &reference_image_paths,
            &output_path,
        )
    })?;
    let openrouter_model = review_normalize_openrouter_model(
        &normalized_model,
        "google/gemini-3.1-flash-image-preview",
    );
    let content =
        review_build_openrouter_apply_input(&prompt, &target_image_path, &reference_image_paths)
            .map_err(|error| {
                review_apply_error(
                    &format!("design review apply could not stage image inputs: {error}"),
                    "openrouter",
                    &requested_model,
                    &openrouter_model,
                    REVIEW_OPENROUTER_RESPONSES_TRANSPORT,
                    &prompt,
                    &target_image_path,
                    &reference_image_paths,
                    &output_path,
                )
            })?;
    let payload = serde_json::json!({
        "model": openrouter_model,
        "input": [{
            "role": "user",
            "content": content,
        }],
        "modalities": ["text", "image"],
        "stream": false,
        "image_config": if let Some(config) = target_image_config {
            serde_json::json!({
                "image_size": config.image_size,
                "aspect_ratio": config.aspect_ratio,
            })
        } else {
            serde_json::json!({
                "image_size": "2K",
            })
        }
    });
    let endpoint = format!(
        "{}/responses",
        review_first_non_empty(vars, &["OPENROUTER_API_BASE"])
            .unwrap_or_else(|| "https://openrouter.ai/api/v1".to_string())
    );
    let client = Client::builder()
        .timeout(Duration::from_secs(150))
        .build()
        .map_err(|error| {
            review_apply_error(
                &format!("design review apply client setup failed: {error}"),
                "openrouter",
                &requested_model,
                &openrouter_model,
                REVIEW_OPENROUTER_RESPONSES_TRANSPORT,
                &prompt,
                &target_image_path,
                &reference_image_paths,
                &output_path,
            )
        })?;
    let request = client
        .post(endpoint)
        .bearer_auth(api_key)
        .header("content-type", "application/json");
    let response = review_apply_openrouter_headers(request, vars)
        .json(&payload)
        .send()
        .map_err(|error| {
            review_apply_error(
                &format!("OpenRouter final apply request failed: {error}"),
                "openrouter",
                &requested_model,
                &openrouter_model,
                REVIEW_OPENROUTER_RESPONSES_TRANSPORT,
                &prompt,
                &target_image_path,
                &reference_image_paths,
                &output_path,
            )
        })?;
    let status = response.status();
    let body = response.text().map_err(|error| {
        review_apply_error(
            &format!("OpenRouter final apply response read failed: {error}"),
            "openrouter",
            &requested_model,
            &openrouter_model,
            REVIEW_OPENROUTER_RESPONSES_TRANSPORT,
            &prompt,
            &target_image_path,
            &reference_image_paths,
            &output_path,
        )
    })?;
    if !status.is_success() {
        return Err(review_apply_error(
            &review_format_apply_http_error(
                "openrouter",
                &openrouter_model,
                REVIEW_OPENROUTER_RESPONSES_TRANSPORT,
                status.as_u16(),
                &body,
            ),
            "openrouter",
            &requested_model,
            &openrouter_model,
            REVIEW_OPENROUTER_RESPONSES_TRANSPORT,
            &prompt,
            &target_image_path,
            &reference_image_paths,
            &output_path,
        ));
    }
    let parsed: serde_json::Value =
        serde_json::from_str(&body).unwrap_or_else(|_| serde_json::json!({ "raw": body.clone() }));
    let images = review_extract_openrouter_images(&parsed).map_err(|error| {
        review_apply_error(
            &format!("OpenRouter final apply image decode failed: {error}"),
            "openrouter",
            &requested_model,
            &openrouter_model,
            REVIEW_OPENROUTER_RESPONSES_TRANSPORT,
            &prompt,
            &target_image_path,
            &reference_image_paths,
            &output_path,
        )
    })?;
    if images.len() != 1 {
        return Err(review_apply_error(
            &format!(
                "OpenRouter final apply must return exactly one image for targetImage, but returned {}.",
                images.len()
            ),
            "openrouter",
            &requested_model,
            &openrouter_model,
            REVIEW_OPENROUTER_RESPONSES_TRANSPORT,
            &prompt,
            &target_image_path,
            &reference_image_paths,
            &output_path,
        ));
    }
    let (bytes, mime_type) = images.into_iter().next().unwrap_or_default();
    if let Some(parent) = Path::new(&output_path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|error| {
                review_apply_error(
                    &format!("design review apply could not create output directory: {error}"),
                    "openrouter",
                    &requested_model,
                    &openrouter_model,
                    REVIEW_OPENROUTER_RESPONSES_TRANSPORT,
                    &prompt,
                    &target_image_path,
                    &reference_image_paths,
                    &output_path,
                )
            })?;
        }
    }
    std::fs::write(&output_path, bytes).map_err(|error| {
        review_apply_error(
            &format!("design review apply could not write output image: {error}"),
            "openrouter",
            &requested_model,
            &openrouter_model,
            REVIEW_OPENROUTER_RESPONSES_TRANSPORT,
            &prompt,
            &target_image_path,
            &reference_image_paths,
            &output_path,
        )
    })?;

    Ok(serde_json::json!({
        "ok": true,
        "provider": "openrouter",
        "requestedModel": requested_model,
        "normalizedModel": openrouter_model,
        "model": openrouter_model,
        "transport": REVIEW_OPENROUTER_RESPONSES_TRANSPORT,
        "prompt": prompt,
        "targetImagePath": target_image_path,
        "referenceImagePaths": reference_image_paths,
        "outputPath": output_path,
        "mimeType": mime_type,
        "targetOutputConfig": target_image_config.map(|config| serde_json::json!({
            "imageSize": config.image_size,
            "aspectRatio": config.aspect_ratio,
        })),
        "raw": parsed,
    }))
}

fn run_design_review_planner_request(
    request: &serde_json::Value,
    vars: &HashMap<String, String>,
) -> Result<serde_json::Value, String> {
    let kind = request
        .get("kind")
        .and_then(|value| value.as_str())
        .unwrap_or("planner")
        .trim()
        .to_ascii_lowercase();
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
    let http_only_openai = kind == "goal_contract" || kind == "goal_check";
    let (planner_reasoning_effort, planner_text_verbosity) = if kind == "planner" {
        ("high", "medium")
    } else {
        ("medium", "low")
    };
    let planner_http_timeout = if http_only_openai {
        REVIEW_FAST_PLANNER_HTTP_TIMEOUT
    } else {
        REVIEW_STANDARD_PLANNER_HTTP_TIMEOUT
    };
    let client = Client::builder()
        .timeout(planner_http_timeout)
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
            if http_only_openai {
                return review_openai_planner_http_fallback(
                    &client,
                    &api_key,
                    &prompt,
                    &image_urls,
                    &normalized_model,
                    planner_reasoning_effort,
                    planner_text_verbosity,
                    REVIEW_OPENAI_RESPONSES_HTTP_TRANSPORT,
                    planner_http_timeout,
                    "OpenAI planner HTTP request exceeded the bounded wait.",
                );
            }
            let session_lock = review_responses_ws_session()
                .lock()
                .map_err(|_| "OpenAI planner websocket session lock is poisoned.".to_string())?;
            let mut session = session_lock;
            match review_openai_ws_connect(&mut session, &api_key, &normalized_model).and_then(
                |_| {
                    review_openai_planner_ws_request(
                        &mut session,
                        &prompt,
                        &image_urls,
                        &normalized_model,
                        planner_reasoning_effort,
                        planner_text_verbosity,
                        previous_response_id,
                    )
                },
            ) {
                Ok(result) => return Ok(result),
                Err(ws_error) if review_should_fallback_openai_ws_error(&ws_error) => {
                    let mut fallback = review_openai_planner_http_fallback(
                        &client,
                        &api_key,
                        &prompt,
                        &image_urls,
                        &normalized_model,
                        planner_reasoning_effort,
                        planner_text_verbosity,
                        REVIEW_OPENAI_RESPONSES_HTTP_FALLBACK_TRANSPORT,
                        planner_http_timeout,
                        "OpenAI planner HTTP fallback request exceeded the bounded wait.",
                    )
                    .map_err(|http_error| {
                        format!(
                            "{} HTTP fallback also failed: {http_error}",
                            ws_error.message
                        )
                    })?;
                    if let Some(object) = fallback.as_object_mut() {
                        object.insert(
                            "fallback_reason".to_string(),
                            serde_json::json!(ws_error.message),
                        );
                        object.insert(
                            "fallback_from_transport".to_string(),
                            serde_json::json!(REVIEW_OPENAI_RESPONSES_WS_TRANSPORT),
                        );
                    }
                    return Ok(fallback);
                }
                Err(ws_error) => return Err(ws_error.message),
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
                .map_err(|e| {
                    review_format_planner_transport_failure(
                        "openrouter",
                        &normalized_model,
                        REVIEW_OPENROUTER_CHAT_COMPLETIONS_TRANSPORT,
                        "request",
                        &e.to_string(),
                    )
                })?;
            let status = response.status();
            let body = response.text().map_err(|e| {
                review_format_planner_transport_failure(
                    "openrouter",
                    &normalized_model,
                    REVIEW_OPENROUTER_CHAT_COMPLETIONS_TRANSPORT,
                    "read_body",
                    &e.to_string(),
                )
            })?;
            if !status.is_success() {
                return Err(review_format_planner_http_error_for_transport(
                    "openrouter",
                    &normalized_model,
                    REVIEW_OPENROUTER_CHAT_COMPLETIONS_TRANSPORT,
                    status.as_u16(),
                    &body,
                ));
            }
            let parsed: serde_json::Value = serde_json::from_str(&body)
                .unwrap_or_else(|_| serde_json::json!({ "raw": body.clone() }));
            return Ok(serde_json::json!({
                "provider": "openrouter",
                "model": normalized_model,
                "transport": REVIEW_OPENROUTER_CHAT_COMPLETIONS_TRANSPORT,
                "text": review_extract_openrouter_text(&parsed),
                "raw": parsed,
            }));
        }
    }

    Err("No planner provider credentials are configured for design review. Set OPENAI_API_KEY or OPENROUTER_API_KEY.".to_string())
}

fn run_design_review_provider_request_sync(
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
        "planner" | "upload_analysis" | "goal_contract" | "goal_check" => {
            run_design_review_planner_request(&request, &vars)
        }
        "apply" => run_design_review_apply_request(&request, &vars),
        other => Err(format!(
            "unsupported design review provider request kind: {other}"
        )),
    }
}

#[tauri::command]
async fn run_design_review_provider_request(
    request: serde_json::Value,
) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || run_design_review_provider_request_sync(request))
        .await
        .map_err(|error| format!("design review provider task join failed: {error}"))?
}

fn runtime_channel_label() -> &'static str {
    if find_repo_root_best_effort().is_some() {
        "source_cloner"
    } else {
        "dmg_installer"
    }
}

fn install_telemetry_log_path_from_env() -> Result<PathBuf, String> {
    preferred_home_config_dir()
        .map(|dir| dir.join("install_events.jsonl"))
        .ok_or("HOME env is unavailable".to_string())
}

#[tauri::command]
fn get_install_telemetry_defaults() -> Result<serde_json::Value, String> {
    let vars = collect_brood_env_snapshot();
    let disk_config = home_config_dir_candidates()
        .into_iter()
        .map(|dir| dir.join("install_telemetry_config.json"))
        .find_map(|path| std::fs::read_to_string(path).ok())
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

    let opt_in = env_flag(env_value(
        &vars,
        &["CUE_INSTALL_TELEMETRY", "BROOD_INSTALL_TELEMETRY"],
    ))
    .or_else(|| env_flag(env_value(&vars, &["CUE_TELEMETRY", "BROOD_TELEMETRY"])))
    .or(disk_opt_in)
    .unwrap_or(false);
    let force_opt_in = env_flag(env_value(
        &vars,
        &[
            "CUE_INSTALL_TELEMETRY_FORCE",
            "BROOD_INSTALL_TELEMETRY_FORCE",
        ],
    ))
    .or(disk_force_opt_in)
    .unwrap_or(false);
    let endpoint = env_value(
        &vars,
        &[
            "CUE_INSTALL_TELEMETRY_ENDPOINT",
            "BROOD_INSTALL_TELEMETRY_ENDPOINT",
        ],
    )
    .map(|v| v.trim().to_string())
    .filter(|v| !v.is_empty())
    .or(disk_endpoint);
    let install_id = env_value(
        &vars,
        &[
            "CUE_INSTALL_TELEMETRY_INSTALL_ID",
            "BROOD_INSTALL_TELEMETRY_INSTALL_ID",
        ],
    )
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

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSessionRef {
    run_dir: String,
}

#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSessionLaunchPayload {
    text_model: Option<String>,
    image_model: Option<String>,
    active_image_path: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSessionDispatchPayload {
    kind: String,
    command: Option<String>,
    args_text: Option<String>,
    prompt: Option<String>,
    raw: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSessionCommandRequest {
    contract: String,
    request_id: String,
    action: String,
    session: DesktopSessionRef,
    launch: Option<DesktopSessionLaunchPayload>,
    command: Option<DesktopSessionDispatchPayload>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopModelPackRef {
    pack_id: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopModelPackInstallOptions {
    source: Option<String>,
    allow_existing: Option<bool>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopModelPackInstallRequest {
    contract: String,
    request_id: String,
    action: String,
    pack: DesktopModelPackRef,
    options: Option<DesktopModelPackInstallOptions>,
}

fn validate_desktop_session_request(
    request: &DesktopSessionCommandRequest,
    expected_action: &str,
) -> Result<String, String> {
    if request.contract.trim() != DESKTOP_SESSION_COMMAND_CONTRACT {
        return Err(format!(
            "unsupported desktop session contract: {}",
            request.contract.trim()
        ));
    }
    if request.action.trim() != expected_action {
        return Err(format!(
            "unexpected desktop session action: {}",
            request.action.trim()
        ));
    }
    if request.request_id.trim().is_empty() {
        return Err("desktop session request_id is required".to_string());
    }
    let run_dir = request.session.run_dir.trim();
    if run_dir.is_empty() {
        return Err("desktop session runDir is required".to_string());
    }
    Ok(run_dir.to_string())
}

fn desktop_session_run_is_active(active_run_dir: Option<&str>, requested_run_dir: &str) -> bool {
    active_run_dir
        .map(str::trim)
        .filter(|value| !value.is_empty())
        == Some(requested_run_dir)
}

fn desktop_session_phase_from_status(status: &serde_json::Value) -> &'static str {
    if status
        .get("running")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false)
    {
        DESKTOP_SESSION_PHASE_READY
    } else if status
        .get("last_error")
        .and_then(serde_json::Value::as_str)
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
    {
        DESKTOP_SESSION_PHASE_ERROR
    } else {
        DESKTOP_SESSION_PHASE_STOPPED
    }
}

fn desktop_session_response(
    request: &DesktopSessionCommandRequest,
    status: serde_json::Value,
    run_dir: &str,
) -> serde_json::Value {
    let launch_mode = status
        .get("launch_mode")
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    let launch_label = status
        .get("launch_label")
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    let detail = status
        .get("last_error")
        .cloned()
        .filter(|value| !value.is_null())
        .or_else(|| status.get("last_exit_detail").cloned())
        .unwrap_or(serde_json::Value::Null);
    serde_json::json!({
        "ok": true,
        "contract": DESKTOP_SESSION_COMMAND_CONTRACT,
        "requestId": request.request_id,
        "action": request.action,
        "session": {
            "runDir": run_dir,
        },
        "runtime": {
            "phase": desktop_session_phase_from_status(&status),
            "running": status.get("running").cloned().unwrap_or(serde_json::Value::Bool(false)),
            "pid": status.get("pid").cloned().unwrap_or(serde_json::Value::Null),
        },
        "launch": {
            "mode": launch_mode,
            "label": launch_label,
        },
        "detail": detail,
    })
}

fn validate_desktop_model_pack_request(
    request: &DesktopModelPackInstallRequest,
    expected_action: &str,
) -> Result<String, String> {
    if request.contract.trim() != DESKTOP_MODEL_PACK_INSTALL_CONTRACT {
        return Err(format!(
            "unsupported desktop model-pack contract: {}",
            request.contract.trim()
        ));
    }
    if request.action.trim() != expected_action {
        return Err(format!(
            "unexpected desktop model-pack action: {}",
            request.action.trim()
        ));
    }
    if request.request_id.trim().is_empty() {
        return Err("desktop model-pack requestId is required".to_string());
    }
    let pack_id = request.pack.pack_id.trim();
    if pack_id.is_empty() {
        return Err("desktop model-pack packId is required".to_string());
    }
    Ok(pack_id.to_string())
}

fn magic_select_pack_resolution_order() -> Vec<String> {
    vec![
        "installed_pack_manifest".to_string(),
        "cue_home_env".to_string(),
        "cue_env".to_string(),
        "legacy_env".to_string(),
    ]
}

fn magic_select_pack_install_root() -> Result<PathBuf, String> {
    Ok(preferred_model_pack_root()?.join(MAGIC_SELECT_LOCAL_PACK_ID))
}

fn build_magic_select_pack_manifest(
    runtime: &MagicSelectRuntimeConfig,
    manifest_path: &Path,
    source: &str,
) -> Result<serde_json::Value, String> {
    let model_asset_sha256 = sha256_file(&runtime.model_path)?;
    Ok(serde_json::json!({
        "schema": MAGIC_SELECT_LOCAL_PACK_MANIFEST_SCHEMA,
        "packId": MAGIC_SELECT_LOCAL_PACK_ID,
        "packVersion": MAGIC_SELECT_LOCAL_PACK_VERSION,
        "installedAt": chrono::Utc::now().to_rfc3339(),
        "source": source,
        "manifestPath": manifest_path.to_string_lossy().to_string(),
        "resolution": {
            "resolutionOrder": magic_select_pack_resolution_order(),
            "resolutionSource": "installed_pack_manifest",
            "runtime": "magic_select_local",
            "runtimeId": runtime.runtime_id,
            "packId": MAGIC_SELECT_LOCAL_PACK_ID,
            "packVersion": MAGIC_SELECT_LOCAL_PACK_VERSION,
            "manifestPath": manifest_path.to_string_lossy().to_string(),
            "modelId": runtime.model_id,
            "modelRevision": runtime.model_revision,
            "modelPath": runtime.model_path.to_string_lossy().to_string(),
            "modelAssetSha256": model_asset_sha256,
            "helperPath": runtime.helper_path.to_string_lossy().to_string(),
            "pythonBin": runtime.python_bin,
            "modelInstallSource": "host_install",
            "entitlementMode": "local_only",
        },
        "model": {
            "id": runtime.model_id,
            "revision": runtime.model_revision,
            "path": runtime.model_path.to_string_lossy().to_string(),
            "sha256": model_asset_sha256,
        },
        "helper": {
            "path": runtime.helper_path.to_string_lossy().to_string(),
            "pythonBin": runtime.python_bin,
        },
    }))
}

fn magic_select_pack_manifest_path() -> Result<PathBuf, String> {
    Ok(magic_select_pack_install_root()?.join(MAGIC_SELECT_LOCAL_PACK_MANIFEST_FILENAME))
}

fn read_magic_select_pack_manifest() -> Result<Option<serde_json::Value>, String> {
    let manifest_path = magic_select_pack_manifest_path()?;
    if !manifest_path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&manifest_path)
        .map_err(|e| format!("{}: {e}", manifest_path.to_string_lossy()))?;
    let manifest = serde_json::from_str::<serde_json::Value>(&content)
        .map_err(|e| format!("{}: {e}", manifest_path.to_string_lossy()))?;
    Ok(Some(manifest))
}

fn model_pack_total_bytes_for_path(path: Option<&Path>) -> Option<u64> {
    path.and_then(|value| std::fs::metadata(value).ok().map(|metadata| metadata.len()))
}

fn model_pack_ids_from_manifest(manifest: &serde_json::Value) -> Vec<String> {
    let mut model_ids = Vec::new();
    if let Some(model_id) = manifest
        .get("model")
        .and_then(|value| value.get("id"))
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        model_ids.push(model_id.to_string());
    }
    if let Some(model_id) = manifest
        .get("resolution")
        .and_then(|value| value.get("modelId"))
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if !model_ids.iter().any(|existing| existing == model_id) {
            model_ids.push(model_id.to_string());
        }
    }
    model_ids
}

fn base_magic_select_model_pack_record() -> DesktopModelPackRecord {
    match read_magic_select_pack_manifest() {
        Ok(Some(manifest)) => {
            let manifest_path = manifest
                .get("manifestPath")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
                .or_else(|| {
                    magic_select_pack_manifest_path()
                        .ok()
                        .map(|path| path.to_string_lossy().to_string())
                });
            let model_path = manifest
                .get("resolution")
                .and_then(|value| value.get("modelPath"))
                .and_then(serde_json::Value::as_str)
                .map(PathBuf::from)
                .or_else(|| {
                    manifest
                        .get("model")
                        .and_then(|value| value.get("path"))
                        .and_then(serde_json::Value::as_str)
                        .map(PathBuf::from)
                });
            DesktopModelPackRecord {
                status: Some(DESKTOP_MODEL_PACK_STATUS_INSTALLED.to_string()),
                phase: Some(DESKTOP_MODEL_PACK_PHASE_INSTALLED.to_string()),
                completed_bytes: model_pack_total_bytes_for_path(model_path.as_deref()),
                total_bytes: model_pack_total_bytes_for_path(model_path.as_deref()),
                pack_version: manifest
                    .get("packVersion")
                    .and_then(serde_json::Value::as_str)
                    .map(str::to_string)
                    .or_else(|| Some(MAGIC_SELECT_LOCAL_PACK_VERSION.to_string())),
                manifest_path,
                model_ids: model_pack_ids_from_manifest(&manifest),
                warnings: Vec::new(),
                ..DesktopModelPackRecord::default()
            }
        }
        Ok(None) => match magic_select_resolve_runtime_config() {
            Ok(runtime) => DesktopModelPackRecord {
                status: Some(DESKTOP_MODEL_PACK_STATUS_AVAILABLE.to_string()),
                phase: Some(DESKTOP_MODEL_PACK_PHASE_INSTALL.to_string()),
                completed_bytes: Some(0),
                total_bytes: model_pack_total_bytes_for_path(Some(runtime.model_path.as_path())),
                pack_version: Some(MAGIC_SELECT_LOCAL_PACK_VERSION.to_string()),
                model_ids: vec![runtime.model_id],
                warnings: Vec::new(),
                ..DesktopModelPackRecord::default()
            },
            Err(detail) => DesktopModelPackRecord {
                status: Some(DESKTOP_MODEL_PACK_STATUS_LOCKED.to_string()),
                phase: Some(DESKTOP_MODEL_PACK_PHASE_ENTITLEMENT_CHECK.to_string()),
                pack_version: Some(MAGIC_SELECT_LOCAL_PACK_VERSION.to_string()),
                detail: Some(detail.clone()),
                warnings: vec![detail],
                ..DesktopModelPackRecord::default()
            },
        },
        Err(detail) => DesktopModelPackRecord {
            status: Some(DESKTOP_MODEL_PACK_STATUS_INSTALL_FAILED.to_string()),
            phase: Some(DESKTOP_MODEL_PACK_PHASE_INSTALL.to_string()),
            pack_version: Some(MAGIC_SELECT_LOCAL_PACK_VERSION.to_string()),
            detail: Some(detail.clone()),
            warnings: vec![detail],
            ..DesktopModelPackRecord::default()
        },
    }
}

fn desktop_model_pack_record_for(pack_id: &str) -> Result<DesktopModelPackRecord, String> {
    match pack_id {
        MAGIC_SELECT_LOCAL_PACK_ID => Ok(base_magic_select_model_pack_record()),
        other => Err(format!("unsupported desktop model-pack packId: {other}")),
    }
}

fn resolve_desktop_model_pack_record(
    state: &SharedDesktopModelPackState,
    pack_id: &str,
    request_id: Option<&str>,
) -> Result<DesktopModelPackRecord, String> {
    let mut record = desktop_model_pack_record_for(pack_id)?;
    if let Some(in_memory) = read_desktop_model_pack_record(state, pack_id)? {
        let effective_status = in_memory.status.as_deref().unwrap_or_default();
        if matches!(
            effective_status,
            DESKTOP_MODEL_PACK_STATUS_INSTALLING
                | DESKTOP_MODEL_PACK_STATUS_INSTALL_FAILED
                | DESKTOP_MODEL_PACK_STATUS_INSTALLED
        ) {
            record = in_memory;
        } else {
            record.request_id = in_memory.request_id.or(record.request_id);
            if !in_memory.warnings.is_empty() {
                record.warnings = merge_model_pack_warnings(&in_memory.warnings, &record.warnings);
            }
            if in_memory.detail.is_some() {
                record.detail = in_memory.detail;
            }
        }
    }
    if let Some(request_id) = request_id {
        record.request_id = Some(request_id.to_string());
    }
    Ok(record)
}

fn install_magic_select_model_pack(
    source: &str,
    allow_existing: bool,
) -> Result<serde_json::Value, String> {
    let runtime = magic_select_resolve_runtime_config()?;
    let install_root = magic_select_pack_install_root()?;
    std::fs::create_dir_all(&install_root)
        .map_err(|e| format!("{}: {e}", install_root.to_string_lossy()))?;
    let manifest_path = install_root.join(MAGIC_SELECT_LOCAL_PACK_MANIFEST_FILENAME);
    let manifest = build_magic_select_pack_manifest(&runtime, &manifest_path, source)?;
    if allow_existing || !manifest_path.exists() {
        std::fs::write(
            &manifest_path,
            serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?,
        )
        .map_err(|e| format!("{}: {e}", manifest_path.to_string_lossy()))?;
    }
    Ok(serde_json::json!({
        "pack": {
            "packId": MAGIC_SELECT_LOCAL_PACK_ID,
            "packVersion": MAGIC_SELECT_LOCAL_PACK_VERSION,
            "installRoot": install_root.to_string_lossy().to_string(),
            "manifestPath": manifest_path.to_string_lossy().to_string(),
        },
        "resolution": manifest["resolution"].clone(),
        "warnings": [],
    }))
}

#[tauri::command]
fn install_desktop_model_pack(
    state: State<'_, SharedDesktopModelPackState>,
    app: tauri::AppHandle,
    request: DesktopModelPackInstallRequest,
) -> Result<serde_json::Value, String> {
    let pack_id = validate_desktop_model_pack_request(&request, DESKTOP_MODEL_PACK_INSTALL_ACTION)?;
    let options = request
        .options
        .clone()
        .unwrap_or(DesktopModelPackInstallOptions {
            source: None,
            allow_existing: None,
        });
    let source = options
        .source
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("desktop_runtime");
    let allow_existing = options.allow_existing.unwrap_or(true);
    let mut installing_record = resolve_desktop_model_pack_record(
        state.inner(),
        &pack_id,
        Some(request.request_id.as_str()),
    )?;
    installing_record.status = Some(DESKTOP_MODEL_PACK_STATUS_INSTALLING.to_string());
    installing_record.phase = Some(DESKTOP_MODEL_PACK_PHASE_ENTITLEMENT_CHECK.to_string());
    installing_record.completed_bytes = Some(0);
    set_desktop_model_pack_record(state.inner(), &pack_id, installing_record.clone())?;
    emit_desktop_model_pack_update(&app, &pack_id, &installing_record);
    let result = match pack_id.as_str() {
        MAGIC_SELECT_LOCAL_PACK_ID => {
            let verify_record = DesktopModelPackRecord {
                request_id: Some(request.request_id.clone()),
                status: Some(DESKTOP_MODEL_PACK_STATUS_INSTALLING.to_string()),
                phase: Some(DESKTOP_MODEL_PACK_PHASE_VERIFY.to_string()),
                completed_bytes: installing_record.total_bytes,
                total_bytes: installing_record.total_bytes,
                pack_version: Some(MAGIC_SELECT_LOCAL_PACK_VERSION.to_string()),
                model_ids: installing_record.model_ids.clone(),
                warnings: installing_record.warnings.clone(),
                ..DesktopModelPackRecord::default()
            };
            set_desktop_model_pack_record(state.inner(), &pack_id, verify_record.clone())?;
            emit_desktop_model_pack_update(&app, &pack_id, &verify_record);
            let install_record = DesktopModelPackRecord {
                request_id: Some(request.request_id.clone()),
                status: Some(DESKTOP_MODEL_PACK_STATUS_INSTALLING.to_string()),
                phase: Some(DESKTOP_MODEL_PACK_PHASE_INSTALL.to_string()),
                completed_bytes: verify_record.total_bytes,
                total_bytes: verify_record.total_bytes,
                pack_version: Some(MAGIC_SELECT_LOCAL_PACK_VERSION.to_string()),
                model_ids: verify_record.model_ids.clone(),
                warnings: verify_record.warnings.clone(),
                ..DesktopModelPackRecord::default()
            };
            set_desktop_model_pack_record(state.inner(), &pack_id, install_record.clone())?;
            emit_desktop_model_pack_update(&app, &pack_id, &install_record);
            install_magic_select_model_pack(source, allow_existing)?
        }
        other => {
            let detail = format!("unsupported desktop model-pack install packId: {other}");
            let failed_record = DesktopModelPackRecord {
                request_id: Some(request.request_id.clone()),
                status: Some(DESKTOP_MODEL_PACK_STATUS_INSTALL_FAILED.to_string()),
                phase: Some(DESKTOP_MODEL_PACK_PHASE_INSTALL.to_string()),
                detail: Some(detail.clone()),
                pack_version: Some(MAGIC_SELECT_LOCAL_PACK_VERSION.to_string()),
                warnings: vec![detail.clone()],
                ..DesktopModelPackRecord::default()
            };
            set_desktop_model_pack_record(state.inner(), &pack_id, failed_record.clone())?;
            emit_desktop_model_pack_update(&app, &pack_id, &failed_record);
            return Err(format!(
                "unsupported desktop model-pack install packId: {other}"
            ));
        }
    };
    let mut installed_record = resolve_desktop_model_pack_record(
        state.inner(),
        &pack_id,
        Some(request.request_id.as_str()),
    )?;
    installed_record.status = Some(DESKTOP_MODEL_PACK_STATUS_INSTALLED.to_string());
    installed_record.phase = Some(DESKTOP_MODEL_PACK_PHASE_INSTALLED.to_string());
    installed_record.pack_version = result
        .get("pack")
        .and_then(|value| value.get("packVersion"))
        .and_then(serde_json::Value::as_str)
        .map(str::to_string)
        .or_else(|| Some(MAGIC_SELECT_LOCAL_PACK_VERSION.to_string()));
    installed_record.manifest_path = result
        .get("pack")
        .and_then(|value| value.get("manifestPath"))
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    installed_record.model_ids = result
        .get("resolution")
        .and_then(|value| value.get("modelId"))
        .and_then(serde_json::Value::as_str)
        .map(|model_id| vec![model_id.to_string()])
        .unwrap_or_else(|| installed_record.model_ids.clone());
    installed_record.warnings = merge_model_pack_warnings(
        &result
            .get("warnings")
            .and_then(serde_json::Value::as_array)
            .map(|values| {
                values
                    .iter()
                    .filter_map(serde_json::Value::as_str)
                    .map(str::to_string)
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default(),
        &installed_record.warnings,
    );
    set_desktop_model_pack_record(state.inner(), &pack_id, installed_record.clone())?;
    emit_desktop_model_pack_update(&app, &pack_id, &installed_record);
    Ok(serde_json::json!({
        "ok": true,
        "contract": DESKTOP_MODEL_PACK_INSTALL_CONTRACT,
        "requestId": request.request_id,
        "action": request.action,
        "pack": result.get("pack").cloned().unwrap_or(serde_json::Value::Null),
        "resolution": result
            .get("resolution")
            .cloned()
            .unwrap_or(serde_json::Value::Null),
        "warnings": result
            .get("warnings")
            .cloned()
            .unwrap_or_else(|| serde_json::json!([])),
    }))
}

#[tauri::command]
fn desktop_model_pack_status(
    state: State<'_, SharedDesktopModelPackState>,
    request: DesktopModelPackInstallRequest,
) -> Result<serde_json::Value, String> {
    let pack_id = validate_desktop_model_pack_request(&request, DESKTOP_MODEL_PACK_ACTION_STATUS)?;
    let record = resolve_desktop_model_pack_record(
        state.inner(),
        &pack_id,
        Some(request.request_id.as_str()),
    )?;
    Ok(build_desktop_model_pack_update_payload(&pack_id, &record))
}

fn build_desktop_session_dispatch_line(
    command: &DesktopSessionDispatchPayload,
) -> Result<String, String> {
    match command.kind.trim() {
        "legacy_command" => {
            let name = command
                .command
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| "legacy_command requires command".to_string())?;
            let args_text = command.args_text.as_deref().map(str::trim).unwrap_or("");
            if args_text.is_empty() {
                Ok(format!("{name}\n"))
            } else {
                Ok(format!("{name} {args_text}\n"))
            }
        }
        "legacy_prompt" => {
            let prompt = command
                .prompt
                .as_deref()
                .or(command.raw.as_deref())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| "legacy_prompt requires prompt".to_string())?;
            Ok(format!("{prompt}\n"))
        }
        other => Err(format!("unsupported desktop session command kind: {other}")),
    }
}

fn start_desktop_session_runtime(
    app: &tauri::AppHandle,
    run_dir: &str,
    _launch: &DesktopSessionLaunchPayload,
) -> Result<SpawnedRuntimeSession, String> {
    let events_path = default_events_path_for_run_dir(run_dir);
    let brood_args = vec![
        "chat".to_string(),
        "--out".to_string(),
        run_dir.to_string(),
        "--events".to_string(),
        events_path.clone(),
    ];

    let mut launch_errors: Vec<String> = Vec::new();
    if let Some(repo_root) = find_repo_root_best_effort() {
        let cargo_args = {
            let mut args = vec![
                "run".to_string(),
                "-q".to_string(),
                "-p".to_string(),
                "brood-cli".to_string(),
                "--".to_string(),
            ];
            args.extend(brood_args.clone());
            args
        };
        match spawn_runtime_process(
            app,
            "cargo".to_string(),
            cargo_args,
            Some(repo_root.join("rust_engine").to_string_lossy().to_string()),
            None,
        ) {
            Ok(mut spawned) => {
                spawned.launch_label = "cargo run -p brood-cli".to_string();
                return Ok(spawned);
            }
            Err(err) => launch_errors.push(err),
        }
    }

    match spawn_runtime_process(
        app,
        "brood-rs".to_string(),
        brood_args,
        Some(run_dir.to_string()),
        None,
    ) {
        Ok(mut spawned) => {
            spawned.launch_label = "brood-rs".to_string();
            Ok(spawned)
        }
        Err(err) => {
            launch_errors.push(err);
            Err(launch_errors.join(" | "))
        }
    }
}

fn seed_desktop_session_runtime(
    state: &SharedPtyState,
    launch: &DesktopSessionLaunchPayload,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|_| "lock_poisoned")?;
    if let Some(text_model) = launch
        .text_model
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        write_to_pty(&mut guard, &format!("/text_model {text_model}\n"))?;
    }
    if let Some(image_model) = launch
        .image_model
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        write_to_pty(&mut guard, &format!("/image_model {image_model}\n"))?;
    }
    if let Some(active_image_path) = launch
        .active_image_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        write_to_pty(
            &mut guard,
            &format!("/use {}\n", quote_cli_arg(active_image_path)),
        )?;
    }
    Ok(())
}

#[tauri::command]
fn desktop_session_start(
    state: State<'_, SharedPtyState>,
    app: tauri::AppHandle,
    request: DesktopSessionCommandRequest,
) -> Result<serde_json::Value, String> {
    let run_dir = validate_desktop_session_request(&request, DESKTOP_SESSION_ACTION_START)?;
    let launch = request.launch.clone().unwrap_or_default();
    emit_desktop_session_status_update(
        &app,
        &run_dir,
        DESKTOP_SESSION_PHASE_STARTING,
        None,
        None,
        None,
    );

    let spawned = start_desktop_session_runtime(&app, &run_dir, &launch).map_err(|err| {
        emit_desktop_session_status_update(
            &app,
            &run_dir,
            DESKTOP_SESSION_PHASE_ERROR,
            None,
            None,
            Some(&err),
        );
        err
    })?;
    let events_path = spawned.events_path.clone();
    let launch_mode = spawned.launch_mode.clone();
    let launch_label = spawned.launch_label.clone();
    let state_handle = state.inner().clone();
    let session_seq = {
        let mut guard = state_handle.lock().map_err(|_| "lock_poisoned")?;
        clear_runtime_session(&mut guard);
        guard.session_seq = guard.session_seq.saturating_add(1);
        let session_seq = guard.session_seq;
        guard.writer = Some(spawned.writer);
        guard.child = Some(spawned.child);
        guard.run_dir = Some(run_dir.clone());
        guard.events_path = Some(events_path.clone());
        guard.launch_mode = Some(launch_mode.clone());
        guard.launch_label = Some(launch_label.clone());
        session_seq
    };
    start_runtime_monitor(
        state_handle.clone(),
        app.clone(),
        session_seq,
        run_dir.clone(),
        events_path,
    );
    seed_desktop_session_runtime(&state_handle, &launch)?;
    emit_desktop_session_status_update(
        &app,
        &run_dir,
        DESKTOP_SESSION_PHASE_READY,
        Some(&launch_mode),
        Some(&launch_label),
        None,
    );
    let status = {
        let mut guard = state_handle.lock().map_err(|_| "lock_poisoned")?;
        pty_status_value(&mut guard)
    };
    Ok(desktop_session_response(&request, status, &run_dir))
}

#[tauri::command]
fn desktop_session_dispatch(
    state: State<'_, SharedPtyState>,
    request: DesktopSessionCommandRequest,
) -> Result<serde_json::Value, String> {
    let run_dir = validate_desktop_session_request(&request, DESKTOP_SESSION_ACTION_DISPATCH)?;
    let command = request
        .command
        .as_ref()
        .ok_or_else(|| "desktop session dispatch requires command payload".to_string())?;
    let line = build_desktop_session_dispatch_line(command)?;
    let status = {
        let mut guard = state.lock().map_err(|_| "lock_poisoned")?;
        if !desktop_session_run_is_active(guard.run_dir.as_deref(), &run_dir) {
            return Err("desktop session runDir is not the active runtime".to_string());
        }
        write_to_pty(&mut guard, &line)?;
        pty_status_value(&mut guard)
    };
    Ok(desktop_session_response(&request, status, &run_dir))
}

#[tauri::command]
fn desktop_session_status(
    state: State<'_, SharedPtyState>,
    request: DesktopSessionCommandRequest,
) -> Result<serde_json::Value, String> {
    let run_dir = validate_desktop_session_request(&request, DESKTOP_SESSION_ACTION_STATUS)?;
    let status = {
        let mut guard = state.lock().map_err(|_| "lock_poisoned")?;
        if !desktop_session_run_is_active(guard.run_dir.as_deref(), &run_dir) {
            return Err("desktop session runDir is not the active runtime".to_string());
        }
        pty_status_value(&mut guard)
    };
    Ok(desktop_session_response(&request, status, &run_dir))
}

#[tauri::command]
fn desktop_session_stop(
    state: State<'_, SharedPtyState>,
    app: tauri::AppHandle,
    request: DesktopSessionCommandRequest,
) -> Result<serde_json::Value, String> {
    let run_dir = validate_desktop_session_request(&request, DESKTOP_SESSION_ACTION_STOP)?;
    let status = {
        let mut guard = state.lock().map_err(|_| "lock_poisoned")?;
        if guard.run_dir.as_deref() == Some(run_dir.as_str()) {
            clear_runtime_session(&mut guard);
        }
        pty_status_value(&mut guard)
    };
    emit_desktop_session_status_update(
        &app,
        &run_dir,
        DESKTOP_SESSION_PHASE_STOPPED,
        None,
        None,
        None,
    );
    Ok(desktop_session_response(&request, status, &run_dir))
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
        let socket = first_non_empty_env(&[
            "CUE_DESKTOP_BRIDGE_SOCKET",
            "BROOD_DESKTOP_BRIDGE_SOCKET",
            "BROOD_BRIDGE_SOCKET",
        ])
        .unwrap_or_else(|| "/tmp/cue_desktop_bridge.sock".to_string());
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
    let model_pack_state: SharedDesktopModelPackState =
        Arc::new(Mutex::new(DesktopModelPackState::default()));
    let context = tauri::generate_context!();
    let menu = build_app_menu(&context.package_info().name);
    tauri::Builder::default()
        .menu(menu)
        .on_menu_event(|event| {
            let menu_id = event.menu_item_id();
            match menu_id {
                MENU_FILE_NEW_SESSION => emit_native_menu_action(&event.window(), "new_session"),
                MENU_FILE_OPEN_SESSION => emit_native_menu_action(&event.window(), "open_session"),
                MENU_FILE_SAVE_SESSION => emit_native_menu_action(&event.window(), "save_session"),
                MENU_FILE_CLOSE_SESSION => {
                    emit_native_menu_action(&event.window(), "close_session")
                }
                MENU_FILE_IMPORT_PHOTOS => {
                    emit_native_menu_action(&event.window(), "import_photos")
                }
                MENU_FILE_EXPORT_SESSION => {
                    emit_native_menu_action(&event.window(), "export_session")
                }
                MENU_FILE_SETTINGS => emit_native_menu_action(&event.window(), "open_settings"),
                MENU_SETTINGS_ICON_PACK_DEFAULT_CLASSIC => {
                    emit_native_menu_action(&event.window(), "settings_icon_pack:default_classic")
                }
                MENU_SETTINGS_ICON_PACK_OSCILLO_INK => {
                    emit_native_menu_action(&event.window(), "settings_icon_pack:oscillo_ink")
                }
                MENU_SETTINGS_ICON_PACK_INDUSTRIAL_MONO => {
                    emit_native_menu_action(&event.window(), "settings_icon_pack:industrial_mono")
                }
                MENU_SETTINGS_ICON_PACK_PAINTERLY_FOLK => {
                    emit_native_menu_action(&event.window(), "settings_icon_pack:painterly_folk")
                }
                MENU_SETTINGS_ICON_PACK_KINETIC_MARKER => {
                    emit_native_menu_action(&event.window(), "settings_icon_pack:kinetic_marker")
                }
                MENU_TOOLS_CREATE_TOOL => {
                    emit_native_menu_action(&event.window(), "open_create_tool")
                }
                _ => {
                    if let Some(index) = menu_id.strip_prefix(MENU_TOOLS_SLOT_PREFIX) {
                        emit_native_menu_action(&event.window(), &format!("tools_slot_{index}"));
                    } else if let Some(index) = menu_id.strip_prefix(MENU_SHORTCUTS_SLOT_PREFIX) {
                        emit_native_menu_action(
                            &event.window(),
                            &format!("shortcuts_slot_{index}"),
                        );
                    }
                }
            }
        })
        .manage(pty_state)
        .manage(model_pack_state)
        .invoke_handler(tauri::generate_handler![
            sync_native_menu_state,
            sync_native_iconography_menu,
            report_automation_result,
            report_automation_frontend_ready,
            spawn_pty,
            write_pty,
            resize_pty,
            desktop_session_start,
            desktop_session_dispatch,
            desktop_session_status,
            desktop_session_stop,
            install_desktop_model_pack,
            desktop_model_pack_status,
            create_run_dir,
            get_repo_root,
            prepare_local_magic_select_image,
            run_local_magic_select_warm_click,
            release_local_magic_select_image,
            run_local_magic_select_click,
            export_run,
            get_key_status,
            get_install_telemetry_defaults,
            append_install_telemetry_event,
            save_openrouter_api_key,
            clear_openrouter_api_key,
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
    use std::collections::HashMap;
    #[cfg(target_family = "unix")]
    use std::os::unix::fs::PermissionsExt;
    use std::path::{Path, PathBuf};
    use std::sync::mpsc;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    use super::{
        build_export_receipt_payload, desktop_session_run_is_active, encode_flattened_export,
        encode_flattened_psd_rgba, flatten_rgba_for_opaque_export, is_native_engine_placeholder,
        magic_select_prepare_worker_image, magic_select_read_mask_summary,
        magic_select_release_worker_image, magic_select_run_worker_warm_click,
        magic_select_sha256_file_cached, normalize_export_out_path, parse_export_format,
        push_native_path_candidate, resolve_existing_env_binary_path,
        review_build_google_apply_parts, review_build_openai_planner_payload,
        review_build_openai_planner_ws_event, review_choose_apply_aspect_ratio,
        review_choose_apply_image_size, review_format_planner_http_error,
        review_format_planner_http_error_for_transport, review_format_planner_remote_failure,
        review_format_planner_transport_timeout, review_normalize_apply_model,
        review_normalize_planner_model, review_resolve_apply_image_config,
        review_should_fallback_openai_ws_error, run_design_review_apply_request, sha256_file,
        spawn_magic_select_warm_click_receipt_persistence, EngineProgramCandidate,
        MagicSelectCandidateBounds, MagicSelectContourPoint, MagicSelectPointPayload,
        MagicSelectPreparedImageState, MagicSelectRuntimeConfig,
        MagicSelectWarmClickReceiptPersistence, MagicSelectWorkerSession, NativeExportFormat,
        NormalizedMagicSelectSettings, ResolvedExportRunRequest, ReviewPlannerRequestError,
        ScreenshotPolishExportPayload, DESIGN_REVIEW_APPLY_MODEL,
        DESIGN_REVIEW_OPENROUTER_PLANNER_MODEL, DESIGN_REVIEW_PLANNER_MODEL,
        MAGIC_SELECT_LOCAL_CONTRACT, MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION,
        REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT, REVIEW_OPENAI_RESPONSES_WS_COMPLETION_TIMEOUT,
        REVIEW_OPENAI_RESPONSES_WS_TRANSPORT, REVIEW_OPENROUTER_CHAT_COMPLETIONS_TRANSPORT,
    };

    #[test]
    fn desktop_session_active_run_requires_exact_run_dir_match() {
        assert!(desktop_session_run_is_active(
            Some("/tmp/cue-run-1"),
            "/tmp/cue-run-1"
        ));
        assert!(!desktop_session_run_is_active(
            Some("/tmp/cue-run-1"),
            "/tmp/cue-run-2"
        ));
        assert!(!desktop_session_run_is_active(None, "/tmp/cue-run-1"));
    }

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

    #[test]
    fn export_format_parser_accepts_low_effort_aliases() {
        assert_eq!(parse_export_format("psd").unwrap(), NativeExportFormat::Psd);
        assert_eq!(
            parse_export_format("jpeg").unwrap(),
            NativeExportFormat::Jpg
        );
        assert_eq!(
            parse_export_format("tif").unwrap(),
            NativeExportFormat::Tiff
        );
        assert!(parse_export_format("pdf").is_err());
    }

    #[test]
    fn export_path_normalizer_preserves_supported_aliases() {
        let run_dir = PathBuf::from("/tmp/cue-export-test");
        assert_eq!(
            normalize_export_out_path(
                Path::new("/tmp/output.jpeg"),
                &run_dir,
                NativeExportFormat::Jpg
            ),
            PathBuf::from("/tmp/output.jpeg")
        );
        assert_eq!(
            normalize_export_out_path(
                Path::new("/tmp/output.tif"),
                &run_dir,
                NativeExportFormat::Tiff
            ),
            PathBuf::from("/tmp/output.tif")
        );
        assert_eq!(
            normalize_export_out_path(Path::new("/tmp/output"), &run_dir, NativeExportFormat::Webp),
            PathBuf::from("/tmp/output.webp")
        );
    }

    #[test]
    fn opaque_export_blends_transparent_pixels_on_white() {
        let rgba =
            image::RgbaImage::from_raw(2, 1, vec![10, 20, 30, 0, 4, 5, 6, 255]).expect("rgba");
        let rgb = flatten_rgba_for_opaque_export(&rgba);
        assert_eq!(rgb.as_raw(), &[255, 255, 255, 4, 5, 6]);
    }

    #[test]
    fn raster_export_encoder_writes_expected_signatures() {
        let rgba = image::RgbaImage::from_raw(1, 1, vec![12, 34, 56, 255]).expect("rgba");

        let png = encode_flattened_export(NativeExportFormat::Png, &rgba).unwrap();
        assert_eq!(&png[0..8], b"\x89PNG\r\n\x1a\n");

        let jpg = encode_flattened_export(NativeExportFormat::Jpg, &rgba).unwrap();
        assert_eq!(&jpg[0..3], &[0xff, 0xd8, 0xff]);

        let webp = encode_flattened_export(NativeExportFormat::Webp, &rgba).unwrap();
        assert_eq!(&webp[0..4], b"RIFF");
        assert_eq!(&webp[8..12], b"WEBP");

        let tiff = encode_flattened_export(NativeExportFormat::Tiff, &rgba).unwrap();
        let little_endian = &tiff[0..4] == b"II*\0";
        let big_endian = &tiff[0..4] == b"MM\0*";
        assert!(little_endian || big_endian);
    }

    #[test]
    fn psd_export_receipt_includes_screenshot_polish_trace_when_present() {
        let request = ResolvedExportRunRequest {
            schema_version: 1,
            document_name: "Compare Export".to_string(),
            format: NativeExportFormat::Psd,
            run_dir: "/tmp/run".to_string(),
            requested_out_path: "/tmp/run/export.psd".to_string(),
            out_path: "/tmp/run/export.psd".to_string(),
            flattened_source_path: "/tmp/run/export.flattened.png".to_string(),
            canvas_mode: Some("multi".to_string()),
            active_image_id: Some("img-1".to_string()),
            export_bounds_css: None,
            flattened_size_px: None,
            source_images: Vec::new(),
            timeline_nodes: vec![crate::ExportTimelineNodePayload {
                node_id: Some("tl-2".to_string()),
                seq: Some(2),
                kind: Some("image_result".to_string()),
                image_id: Some("img-1".to_string()),
                path: None,
                receipt_path: None,
                label: Some("Compare Export".to_string()),
                action: Some("Export PSD".to_string()),
                parents: vec!["tl-1".to_string()],
                image_ids: vec!["img-1".to_string()],
                preview_image_id: Some("img-1".to_string()),
                preview_path: Some("/tmp/run/preview.png".to_string()),
                receipt_paths: Vec::new(),
                visual_mode: Some("thumbnail".to_string()),
                detail: None,
                is_head: Some(true),
                created_at: Some(1_710_000_000),
                created_at_iso: Some("2024-03-09T16:00:00Z".to_string()),
            }],
            timeline_schema_version: Some(1),
            timeline_head_node_id: Some("tl-2".to_string()),
            action_sequence: Vec::new(),
            edit_receipts: Vec::new(),
            limitations: vec!["flattened".to_string()],
            screenshot_polish: Some(ScreenshotPolishExportPayload {
                proposal_id: Some("proposal-1".to_string()),
                selected_proposal_id: Some("proposal-1".to_string()),
                preview_image_path: Some("/tmp/run/preview.png".to_string()),
                changed_region_bounds: Some(serde_json::json!({
                    "x": 4,
                    "y": 8,
                    "w": 64,
                    "h": 48
                })),
                preserve_region_ids: vec!["subject".to_string()],
                rationale_codes: vec!["preserve_subject".to_string()],
                frame_context: Some(serde_json::json!({
                    "targetImageId": "img-1",
                    "originalFrame": { "path": "/tmp/run/original.png" },
                    "approvedFrame": { "path": "/tmp/run/approved.png" }
                })),
            }),
        };

        let receipt = build_export_receipt_payload(
            &request,
            Path::new("/tmp/run/receipts/receipt-export.json"),
            Path::new("/tmp/run/artifacts/export.psd"),
            Path::new("/Users/tester/Desktop/export.psd"),
            1920,
            1080,
            "flat-sha",
            "out-sha",
        );

        assert_eq!(
            receipt["request"]["metadata"]["screenshotPolish"]["approvedProposalId"],
            serde_json::json!("proposal-1")
        );
        assert_eq!(
            receipt["provider_request"]["screenshotPolish"]["frameContext"]["targetImageId"],
            serde_json::json!("img-1")
        );
        assert_eq!(
            receipt["result_metadata"]["screenshotPolish"]["approvedProposalId"],
            serde_json::json!("proposal-1")
        );
        assert_eq!(receipt["receipt_kind"], serde_json::json!("export_psd"));
        assert_eq!(
            receipt["artifact"]["path"],
            serde_json::json!("/tmp/run/artifacts/export.psd")
        );
        assert_eq!(
            receipt["artifacts"]["export_path"],
            serde_json::json!("/Users/tester/Desktop/export.psd")
        );
        assert_eq!(
            receipt["artifacts"]["flattened_source_path"],
            serde_json::json!("/tmp/run/export.flattened.png")
        );
        assert_eq!(
            receipt["timeline"]["head_node_id"],
            serde_json::json!("tl-2")
        );
        assert_eq!(
            receipt["timeline"]["parent_node_ids"],
            serde_json::json!(["tl-1"])
        );
    }

    #[test]
    fn raster_export_receipt_omits_screenshot_polish_trace_even_if_request_carries_it() {
        let request = ResolvedExportRunRequest {
            schema_version: 1,
            document_name: "Raster Export".to_string(),
            format: NativeExportFormat::Png,
            run_dir: "/tmp/run".to_string(),
            requested_out_path: "/tmp/run/export.png".to_string(),
            out_path: "/tmp/run/export.png".to_string(),
            flattened_source_path: "/tmp/run/export.flattened.png".to_string(),
            canvas_mode: Some("multi".to_string()),
            active_image_id: Some("img-1".to_string()),
            export_bounds_css: None,
            flattened_size_px: None,
            source_images: Vec::new(),
            timeline_nodes: Vec::new(),
            timeline_schema_version: Some(1),
            timeline_head_node_id: Some("tl-2".to_string()),
            action_sequence: Vec::new(),
            edit_receipts: Vec::new(),
            limitations: vec!["flattened".to_string()],
            screenshot_polish: Some(ScreenshotPolishExportPayload {
                proposal_id: Some("proposal-1".to_string()),
                selected_proposal_id: Some("proposal-1".to_string()),
                preview_image_path: None,
                changed_region_bounds: None,
                preserve_region_ids: Vec::new(),
                rationale_codes: Vec::new(),
                frame_context: Some(serde_json::json!({ "targetImageId": "img-1" })),
            }),
        };

        let receipt = build_export_receipt_payload(
            &request,
            Path::new("/tmp/run/receipts/receipt-export.json"),
            Path::new("/tmp/run/artifacts/export.png"),
            Path::new("/Users/tester/Desktop/export.png"),
            1920,
            1080,
            "flat-sha",
            "out-sha",
        );

        assert!(receipt["request"]["metadata"]
            .get("screenshotPolish")
            .is_none());
        assert!(receipt["provider_request"]
            .get("screenshotPolish")
            .is_none());
        assert!(receipt["result_metadata"].get("screenshotPolish").is_none());
        assert_eq!(receipt["receipt_kind"], serde_json::json!("export_png"));
        assert_eq!(
            receipt["artifact"]["media_type"],
            serde_json::json!("image/png")
        );
        assert_eq!(
            receipt["artifacts"]["image_path"],
            serde_json::json!("/tmp/run/artifacts/export.png")
        );
    }

    #[test]
    fn magic_select_mask_summary_extracts_bounds_and_rectangle_contour() {
        let mask_path = temp_file_path("magic-select-mask.png");
        let _ = std::fs::remove_file(&mask_path);
        let mut image = image::GrayImage::from_pixel(12, 12, image::Luma([0]));
        for y in 3..9 {
            for x in 2..8 {
                image.put_pixel(x, y, image::Luma([255]));
            }
        }
        image
            .save_with_format(&mask_path, image::ImageFormat::Png)
            .expect("write mask png");

        let summary = magic_select_read_mask_summary(&mask_path, 127, 64).expect("mask summary");
        assert_eq!(summary.bounds_x, 2);
        assert_eq!(summary.bounds_y, 3);
        assert_eq!(summary.bounds_w, 6);
        assert_eq!(summary.bounds_h, 6);
        assert_eq!(
            summary.contour_points,
            vec![
                MagicSelectContourPoint { x: 2, y: 3 },
                MagicSelectContourPoint { x: 8, y: 3 },
                MagicSelectContourPoint { x: 8, y: 9 },
                MagicSelectContourPoint { x: 2, y: 9 },
            ]
        );

        let _ = std::fs::remove_file(mask_path);
    }

    #[test]
    fn magic_select_sha256_file_cache_reuses_and_invalidates() {
        let path = temp_file_path("magic-select-cache.txt");
        let _ = std::fs::remove_file(&path);
        std::fs::write(&path, b"alpha").expect("write initial file");

        let mut session = MagicSelectWorkerSession::default();
        let first = magic_select_sha256_file_cached(&mut session, &path).expect("first hash");
        let second = magic_select_sha256_file_cached(&mut session, &path).expect("cached hash");
        assert_eq!(first, second);

        std::fs::write(&path, b"beta-updated").expect("rewrite file");
        let third = magic_select_sha256_file_cached(&mut session, &path).expect("updated hash");
        assert_ne!(first, third);

        let _ = std::fs::remove_file(path);
    }

    #[cfg(target_family = "unix")]
    #[test]
    fn magic_select_worker_session_reuses_process_and_prepare_cache() {
        let helper_path = temp_file_path("magic-select-worker.sh");
        let log_path = temp_file_path("magic-select-worker.log");
        let image_path = temp_file_path("magic-select-image.bin");
        let model_path = temp_file_path("magic-select-model.bin");
        let artifact_root = temp_file_path("magic-select-artifacts");
        let output_mask_one = temp_file_path("magic-select-mask-one.png");
        let output_mask_two = temp_file_path("magic-select-mask-two.png");
        let _ = std::fs::remove_file(&helper_path);
        let _ = std::fs::remove_file(&log_path);
        let _ = std::fs::remove_file(&image_path);
        let _ = std::fs::remove_file(&model_path);
        let _ = std::fs::remove_dir_all(&artifact_root);
        let _ = std::fs::remove_file(&output_mask_one);
        let _ = std::fs::remove_file(&output_mask_two);

        std::fs::write(&image_path, b"image-bytes").expect("write image");
        std::fs::write(&model_path, b"model-bytes").expect("write model");
        std::fs::create_dir_all(&artifact_root).expect("create artifact root");

        let quoted_log_path = log_path.to_string_lossy().replace('\'', "'\"'\"'");
        let helper_script = format!(
            r#"#!/bin/sh
set -eu
log_file='{quoted_log_path}'
printf 'spawn\n' >>"$log_file"
while IFS= read -r line; do
  action=$(printf '%s\n' "$line" | sed -n 's/.*"action":"\([^"]*\)".*/\1/p')
  prepared_id=$(printf '%s\n' "$line" | sed -n 's/.*"preparedImageId":"\([^"]*\)".*/\1/p')
  image_id=$(printf '%s\n' "$line" | sed -n 's/.*"imageId":"\([^"]*\)".*/\1/p')
  mask_path=$(printf '%s\n' "$line" | sed -n 's/.*"outputMaskPath":"\([^"]*\)".*/\1/p')
  case "$action" in
    magic_select_prepare)
      printf 'prepare:%s\n' "$prepared_id" >>"$log_file"
      printf '{{"ok":true,"contract":"juggernaut.magic_select.local.prepared.v1","action":"magic_select_prepare","imageId":"%s","preparedImageId":"%s","runtime":"stub_worker","warnings":[]}}\n' "$image_id" "$prepared_id"
      ;;
    magic_select_warm_click)
      printf 'warm_click:%s\n' "$prepared_id" >>"$log_file"
      if [ -n "$mask_path" ]; then
        : > "$mask_path"
      fi
      printf '{{"ok":true,"contract":"juggernaut.magic_select.local.prepared.v1","action":"magic_select_warm_click","imageId":"%s","preparedImageId":"%s","maskPath":"%s","confidence":1.0,"runtime":"stub_worker","warnings":[]}}\n' "$image_id" "$prepared_id" "$mask_path"
      ;;
    magic_select_release)
      printf 'release:%s\n' "$prepared_id" >>"$log_file"
      printf '{{"ok":true,"contract":"juggernaut.magic_select.local.prepared.v1","action":"magic_select_release","imageId":"%s","preparedImageId":"%s","warnings":[]}}\n' "$image_id" "$prepared_id"
      ;;
    *)
      printf '{{"ok":false,"code":"unknown_action","nonDestructive":true,"contract":"juggernaut.magic_select.local.prepared.v1","action":"%s","imageId":"%s","preparedImageId":"%s","details":{{"message":"unknown action"}}}}\n' "$action" "$image_id" "$prepared_id"
      ;;
  esac
done
"#
        );
        std::fs::write(&helper_path, helper_script).expect("write helper");
        let mut permissions = std::fs::metadata(&helper_path)
            .expect("helper metadata")
            .permissions();
        permissions.set_mode(0o755);
        std::fs::set_permissions(&helper_path, permissions).expect("chmod helper");

        let runtime = MagicSelectRuntimeConfig {
            python_bin: "/bin/sh".to_string(),
            helper_path: helper_path.clone(),
            model_path: model_path.clone(),
            model_id: "mobile_sam_vit_t".to_string(),
            model_revision: "sha256:test-model".to_string(),
            runtime_id: "tauri_mobile_sam_python_worker_cpu".to_string(),
        };
        let state = MagicSelectPreparedImageState {
            prepared_image_id: "prepared-1".to_string(),
            image_cache_key: "image-cache-1".to_string(),
            image_id: "img-1".to_string(),
            image_path: image_path.clone(),
            artifact_root: artifact_root.clone(),
            stable_source_ref: "stable-ref".to_string(),
            source: "canvas_magic_select".to_string(),
            settings: NormalizedMagicSelectSettings {
                mask_threshold: 127,
                max_contour_points: 256,
            },
            image_sha256: "sha256-image".to_string(),
            runtime_id: runtime.runtime_id.clone(),
            model_id: runtime.model_id.clone(),
            model_revision: runtime.model_revision.clone(),
            prepared_at_millis: 123,
        };

        let mut session = MagicSelectWorkerSession::default();
        let prepared =
            magic_select_prepare_worker_image(&mut session, &runtime, &state).expect("prepare");
        let first = magic_select_run_worker_warm_click(
            &mut session,
            &runtime,
            &state,
            &MagicSelectPointPayload { x: 24.0, y: 32.0 },
            "canvas_magic_select",
            &output_mask_one,
        )
        .expect("first warm click");
        let second = magic_select_run_worker_warm_click(
            &mut session,
            &runtime,
            &state,
            &MagicSelectPointPayload { x: 40.0, y: 48.0 },
            "canvas_magic_select",
            &output_mask_two,
        )
        .expect("second warm click");
        magic_select_release_worker_image(
            &mut session,
            &state.image_id,
            &state.prepared_image_id,
            "done",
        )
        .expect("release");

        assert_eq!(
            prepared.prepared_image_id.as_deref(),
            Some(state.prepared_image_id.as_str())
        );
        assert_eq!(
            first.prepared_image_id.as_deref(),
            Some(state.prepared_image_id.as_str())
        );
        assert_eq!(
            second.prepared_image_id.as_deref(),
            Some(state.prepared_image_id.as_str())
        );

        let log = std::fs::read_to_string(&log_path).expect("read worker log");
        let lines: Vec<&str> = log.lines().collect();
        assert_eq!(
            lines.iter().filter(|line| **line == "spawn").count(),
            1,
            "worker should spawn once: {lines:?}"
        );
        assert_eq!(
            lines
                .iter()
                .filter(|line| line.starts_with("prepare:"))
                .count(),
            1,
            "prepare should run once: {lines:?}"
        );
        assert_eq!(
            lines
                .iter()
                .filter(|line| line.starts_with("warm_click:"))
                .count(),
            2,
            "warm click should run twice: {lines:?}"
        );
        assert_eq!(
            lines
                .iter()
                .filter(|line| line.starts_with("release:"))
                .count(),
            1,
            "release should run once: {lines:?}"
        );

        session.client = None;
        let _ = std::fs::remove_file(helper_path);
        let _ = std::fs::remove_file(log_path);
        let _ = std::fs::remove_file(image_path);
        let _ = std::fs::remove_file(model_path);
        let _ = std::fs::remove_dir_all(artifact_root);
        let _ = std::fs::remove_file(output_mask_one);
        let _ = std::fs::remove_file(output_mask_two);
    }

    #[test]
    fn magic_select_receipt_persistence_stays_off_the_return_path() {
        let mask_path = temp_file_path("magic-select-artifact.png");
        let receipt_path = temp_file_path("magic-select-receipt.json");
        let _ = std::fs::remove_file(&mask_path);
        let _ = std::fs::remove_file(&receipt_path);

        image::GrayImage::from_pixel(4, 4, image::Luma([255]))
            .save_with_format(&mask_path, image::ImageFormat::Png)
            .expect("write mask image");

        let persistence = MagicSelectWarmClickReceiptPersistence {
            contract: MAGIC_SELECT_LOCAL_CONTRACT.to_string(),
            action: MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION.to_string(),
            image_id: "img-hero".to_string(),
            prepared_image_id: "prepared-hero".to_string(),
            source: "canvas_magic_select".to_string(),
            click_anchor: MagicSelectPointPayload { x: 8.0, y: 9.0 },
            prepared_image: serde_json::json!({
                "preparedImageId": "prepared-hero",
                "imageId": "img-hero",
            }),
            mask_path: mask_path.clone(),
            mask_sha256: sha256_file(&mask_path).expect("mask sha"),
            receipt_path: receipt_path.clone(),
            reproducibility: serde_json::json!({
                "runtime": "stub_worker",
                "modelId": "mobile_sam_vit_t",
                "modelRevision": "sha256:abcd1234",
                "imageHash": "image-sha",
                "preparedImageId": "prepared-hero",
            }),
            candidate_id: "magic-select-a1b2c3d4".to_string(),
            candidate_bounds: MagicSelectCandidateBounds {
                x: 1,
                y: 2,
                w: 3,
                h: 4,
            },
            confidence: 0.91,
            contour_point_count: 4,
            created_at: "2026-03-26T12:34:56Z".to_string(),
            warnings: vec!["helper-warning".to_string()],
        };

        let (started_tx, started_rx) = mpsc::channel();
        let (release_tx, release_rx) = mpsc::channel();
        let handle = spawn_magic_select_warm_click_receipt_persistence(persistence, move || {
            started_tx.send(()).expect("started signal");
            release_rx.recv().expect("release signal");
        })
        .expect("spawn persistence thread");

        started_rx
            .recv_timeout(Duration::from_secs(2))
            .expect("persistence thread started");
        assert!(
            !receipt_path.exists(),
            "receipt should still be pending while the selection result can return"
        );

        release_tx.send(()).expect("release persistence");
        handle.join().expect("join persistence thread");

        let receipt_text = std::fs::read_to_string(&receipt_path).expect("read persisted receipt");
        let receipt: serde_json::Value =
            serde_json::from_str(&receipt_text).expect("parse persisted receipt");
        assert_eq!(
            receipt["request"]["prepared_image_id"],
            serde_json::json!("prepared-hero")
        );
        assert_eq!(
            receipt["artifacts"]["mask_sha256"],
            serde_json::json!(sha256_file(&mask_path).expect("mask sha"))
        );
        assert_eq!(
            receipt["reproducibility"]["imageHash"],
            serde_json::json!("image-sha")
        );
        assert_eq!(
            receipt["prepared_image"]["preparedImageId"],
            serde_json::json!("prepared-hero")
        );

        let _ = std::fs::remove_file(mask_path);
        let _ = std::fs::remove_file(receipt_path);
    }

    #[test]
    fn magic_select_receipt_persistence_failure_does_not_delete_the_mask_artifact() {
        let mask_path = temp_file_path("magic-select-persisted-mask.png");
        let receipt_dir = temp_file_path("magic-select-missing-receipt-dir");
        let receipt_path = receipt_dir.join("receipt-magic-select-warm-click.json");
        let _ = std::fs::remove_file(&mask_path);
        let _ = std::fs::remove_dir_all(&receipt_dir);

        image::GrayImage::from_pixel(3, 3, image::Luma([255]))
            .save_with_format(&mask_path, image::ImageFormat::Png)
            .expect("write mask image");

        let handle = spawn_magic_select_warm_click_receipt_persistence(
            MagicSelectWarmClickReceiptPersistence {
                contract: MAGIC_SELECT_LOCAL_CONTRACT.to_string(),
                action: MAGIC_SELECT_LOCAL_WARM_CLICK_ACTION.to_string(),
                image_id: "img-missing".to_string(),
                prepared_image_id: "prepared-missing".to_string(),
                source: "canvas_magic_select".to_string(),
                click_anchor: MagicSelectPointPayload { x: 2.0, y: 3.0 },
                prepared_image: serde_json::json!({
                    "preparedImageId": "prepared-missing",
                    "imageId": "img-missing",
                }),
                mask_path: mask_path.clone(),
                mask_sha256: sha256_file(&mask_path).expect("mask sha"),
                receipt_path: receipt_path.clone(),
                reproducibility: serde_json::json!({
                    "runtime": "stub_worker",
                    "preparedImageId": "prepared-missing",
                }),
                candidate_id: "magic-select-missing".to_string(),
                candidate_bounds: MagicSelectCandidateBounds {
                    x: 0,
                    y: 0,
                    w: 3,
                    h: 3,
                },
                confidence: 1.0,
                contour_point_count: 4,
                created_at: "2026-03-26T12:34:56Z".to_string(),
                warnings: Vec::new(),
            },
            || {},
        )
        .expect("spawn persistence thread");

        handle.join().expect("join persistence thread");
        assert!(mask_path.is_file(), "mask artifact should remain available");
        assert!(
            !receipt_path.exists(),
            "receipt file should not be created when persistence fails"
        );

        let _ = std::fs::remove_file(mask_path);
        let _ = std::fs::remove_dir_all(receipt_dir);
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
    fn openai_planner_payload_uses_medium_text_verbosity_high_reasoning_and_high_detail_images() {
        let payload = review_build_openai_planner_payload(
            "Plan the next edit.",
            &[
                "data:image/png;base64,AAAA".to_string(),
                "https://example.com/ref.png".to_string(),
            ],
            DESIGN_REVIEW_PLANNER_MODEL,
            "high",
            "medium",
        );

        assert_eq!(
            payload.get("model").and_then(|value| value.as_str()),
            Some("gpt-5.4")
        );
        assert_eq!(
            payload
                .pointer("/text/verbosity")
                .and_then(|value| value.as_str()),
            Some("medium")
        );
        assert_eq!(
            payload
                .pointer("/reasoning/effort")
                .and_then(|value| value.as_str()),
            Some("high")
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
    fn openai_planner_ws_event_uses_response_create_high_reasoning_and_previous_response_id() {
        let event = review_build_openai_planner_ws_event(
            "Plan the next edit.",
            &["data:image/png;base64,AAAA".to_string()],
            DESIGN_REVIEW_PLANNER_MODEL,
            "high",
            "medium",
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
                .pointer("/text/verbosity")
                .and_then(|value| value.as_str()),
            Some("medium")
        );
        assert_eq!(
            event
                .pointer("/reasoning/effort")
                .and_then(|value| value.as_str()),
            Some("high")
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
    fn openai_goal_contract_payload_keeps_low_verbosity_and_medium_reasoning_effort() {
        let payload = review_build_openai_planner_payload(
            "Compile a goal contract.",
            &[],
            DESIGN_REVIEW_PLANNER_MODEL,
            "medium",
            "low",
        );

        assert_eq!(
            payload
                .pointer("/text/verbosity")
                .and_then(|value| value.as_str()),
            Some("low")
        );
        assert_eq!(
            payload
                .pointer("/reasoning/effort")
                .and_then(|value| value.as_str()),
            Some("medium")
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

    #[test]
    fn planner_ws_timeout_shape_includes_provider_model_transport_and_stage() {
        let message = review_format_planner_transport_timeout(
            "openai",
            DESIGN_REVIEW_PLANNER_MODEL,
            REVIEW_OPENAI_RESPONSES_WS_TRANSPORT,
            "completion_wait",
            REVIEW_OPENAI_RESPONSES_WS_COMPLETION_TIMEOUT,
            "OpenAI planner websocket did not reach response.completed within the bounded wait.",
        );

        assert!(message.contains("provider=openai"));
        assert!(message.contains("normalized model=gpt-5.4"));
        assert!(message.contains("transport=responses_websocket"));
        assert!(message.contains("stage=completion_wait"));
        assert!(message.contains("timeout_seconds=90"));
    }

    #[test]
    fn planner_ws_fallback_is_retained_only_for_transport_errors() {
        let transport_error = ReviewPlannerRequestError::transport("transport".to_string());
        let remote_error = ReviewPlannerRequestError::remote("remote".to_string());

        assert!(review_should_fallback_openai_ws_error(&transport_error));
        assert!(!review_should_fallback_openai_ws_error(&remote_error));
    }

    #[test]
    fn planner_transport_messages_preserve_provider_model_and_transport_details() {
        let http_message = review_format_planner_http_error_for_transport(
            "openrouter",
            DESIGN_REVIEW_OPENROUTER_PLANNER_MODEL,
            REVIEW_OPENROUTER_CHAT_COMPLETIONS_TRANSPORT,
            401,
            r#"{"error":{"message":"User not found"}}"#,
        );
        let ws_message = review_format_planner_remote_failure(
            "openai",
            DESIGN_REVIEW_PLANNER_MODEL,
            REVIEW_OPENAI_RESPONSES_WS_TRANSPORT,
            "response.failed",
            "planner rejected request",
        );

        assert!(http_message.contains("provider=openrouter"));
        assert!(http_message.contains("normalized model=openai/gpt-5.4"));
        assert!(http_message.contains("transport=chat_completions"));

        assert!(ws_message.contains("provider=openai"));
        assert!(ws_message.contains("normalized model=gpt-5.4"));
        assert!(ws_message.contains("transport=responses_websocket"));
        assert!(ws_message.contains("stage=response.failed"));
    }

    #[test]
    fn apply_model_normalization_maps_nano_banana_alias_to_provider_id() {
        assert_eq!(
            review_normalize_apply_model("Gemini Nano Banana 2"),
            DESIGN_REVIEW_APPLY_MODEL
        );
        assert_eq!(
            review_normalize_apply_model("models/gemini-nano-banana-2"),
            DESIGN_REVIEW_APPLY_MODEL
        );
        assert_eq!(
            review_normalize_apply_model("google/gemini-nano-banana-2"),
            DESIGN_REVIEW_APPLY_MODEL
        );
        assert_eq!(
            review_normalize_apply_model("models/gemini-3.1-flash-image-preview"),
            DESIGN_REVIEW_APPLY_MODEL
        );
        assert_eq!(
            review_normalize_apply_model("google/gemini-3.1-flash-image-preview"),
            DESIGN_REVIEW_APPLY_MODEL
        );
    }

    #[test]
    fn apply_image_config_prefers_supported_aspect_ratio_and_closest_size_bucket() {
        assert_eq!(review_choose_apply_aspect_ratio(1600, 900), "16:9");
        assert_eq!(review_choose_apply_image_size(1600, 900), "2K");
        assert_eq!(review_choose_apply_aspect_ratio(900, 1600), "9:16");
        assert_eq!(review_choose_apply_image_size(900, 1600), "2K");
        assert_eq!(review_choose_apply_aspect_ratio(1080, 1080), "1:1");
        assert_eq!(review_choose_apply_image_size(1080, 1080), "1K");
    }

    #[test]
    fn apply_image_config_reads_target_dimensions_from_disk() {
        let target_path = temp_file_path("review-apply-target-dimensions.png");
        let _ = std::fs::remove_file(&target_path);
        let image = image::RgbaImage::from_pixel(1600, 900, image::Rgba([18, 24, 36, 255]));
        image
            .save_with_format(&target_path, image::ImageFormat::Png)
            .expect("write target png");

        let config = review_resolve_apply_image_config(&target_path.to_string_lossy())
            .expect("resolve apply config");
        assert_eq!(config.aspect_ratio, "16:9");
        assert_eq!(config.image_size, "2K");

        let _ = std::fs::remove_file(target_path);
    }

    #[test]
    fn google_apply_parts_label_target_and_reference_images() {
        let target_path = temp_file_path("review-apply-target.png");
        let reference_path = temp_file_path("review-apply-reference.png");
        let _ = std::fs::remove_file(&target_path);
        let _ = std::fs::remove_file(&reference_path);
        std::fs::write(&target_path, [137, 80, 78, 71]).expect("write target png bytes");
        std::fs::write(&reference_path, [137, 80, 78, 71]).expect("write reference png bytes");

        let parts = review_build_google_apply_parts(
            "Edit only targetImage. Use referenceImages[] as guidance only.",
            &target_path.to_string_lossy(),
            &[reference_path.to_string_lossy().to_string()],
        )
        .expect("build apply parts");

        assert_eq!(
            parts[0].get("text").and_then(|value| value.as_str()),
            Some("Edit only targetImage. Use referenceImages[] as guidance only.")
        );
        assert_eq!(
            parts[1].get("text").and_then(|value| value.as_str()),
            Some("targetImage (editable image to modify)")
        );
        assert_eq!(
            parts[3].get("text").and_then(|value| value.as_str()),
            Some("referenceImages[0] (guidance only; do not edit directly)")
        );
        assert_eq!(
            parts[2]
                .pointer("/inlineData/mimeType")
                .and_then(|value| value.as_str()),
            Some("image/png")
        );
        assert_eq!(
            parts[4]
                .pointer("/inlineData/mimeType")
                .and_then(|value| value.as_str()),
            Some("image/png")
        );

        let _ = std::fs::remove_file(target_path);
        let _ = std::fs::remove_file(reference_path);
    }

    #[test]
    fn apply_request_rejects_unsupported_provider_with_shaped_debug_payload() {
        let request = serde_json::json!({
            "kind": "apply",
            "provider": "anthropic",
            "model": "Gemini Nano Banana 2",
            "prompt": "Edit only targetImage.",
            "targetImage": {
                "path": "/tmp/review-apply-target.png"
            },
            "referenceImages": [{
                "path": "/tmp/review-apply-ref.png"
            }],
            "outputPath": "/tmp/review-apply-output.png"
        });
        let error = run_design_review_apply_request(&request, &HashMap::new()).unwrap_err();
        let parsed: serde_json::Value =
            serde_json::from_str(&error).expect("parse apply error envelope");

        assert_eq!(
            parsed
                .pointer("/debugInfo/provider")
                .and_then(|value| value.as_str()),
            Some("anthropic")
        );
        assert_eq!(
            parsed
                .pointer("/debugInfo/requestedModel")
                .and_then(|value| value.as_str()),
            Some("Gemini Nano Banana 2")
        );
        assert_eq!(
            parsed
                .pointer("/debugInfo/normalizedModel")
                .and_then(|value| value.as_str()),
            Some(DESIGN_REVIEW_APPLY_MODEL)
        );
        assert_eq!(
            parsed
                .pointer("/debugInfo/transport")
                .and_then(|value| value.as_str()),
            Some(REVIEW_GOOGLE_GENERATE_CONTENT_TRANSPORT)
        );
        assert_eq!(
            parsed
                .pointer("/debugInfo/targetImagePath")
                .and_then(|value| value.as_str()),
            Some("/tmp/review-apply-target.png")
        );
        assert_eq!(
            parsed
                .pointer("/debugInfo/referenceImagePaths/0")
                .and_then(|value| value.as_str()),
            Some("/tmp/review-apply-ref.png")
        );
        assert_eq!(
            parsed
                .pointer("/debugInfo/outputPath")
                .and_then(|value| value.as_str()),
            Some("/tmp/review-apply-output.png")
        );
    }
}
