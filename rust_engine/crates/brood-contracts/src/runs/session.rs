use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

pub const SESSION_DOCUMENT_SCHEMA: &str = "cue.session.v1";
pub const SESSION_DOCUMENT_VERSION: u64 = 1;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SessionDocument {
    pub schema: String,
    pub version: u64,
    pub run_id: String,
    pub saved_at: String,
    pub tab_label: Option<String>,
    pub forked_from_run_id: Option<String>,
    #[serde(default)]
    pub state: SessionSnapshot,
    #[serde(default)]
    pub timeline: SessionTimelinePointers,
    #[serde(default)]
    pub save_state: SessionSaveState,
}

impl SessionDocument {
    pub fn new(run_id: impl Into<String>) -> Self {
        Self {
            schema: SESSION_DOCUMENT_SCHEMA.to_string(),
            version: SESSION_DOCUMENT_VERSION,
            run_id: run_id.into(),
            saved_at: now_utc_iso(),
            tab_label: None,
            forked_from_run_id: None,
            state: SessionSnapshot::default(),
            timeline: SessionTimelinePointers::default(),
            save_state: SessionSaveState::default(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct SessionSnapshot {
    pub active_image_id: Option<String>,
    #[serde(default)]
    pub selected_image_ids: Vec<String>,
    #[serde(default)]
    pub images: Vec<SessionImageRecord>,
    #[serde(default)]
    pub canvas: SessionCanvasState,
    #[serde(default)]
    pub overlays: SessionRestoreState,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct SessionImageRecord {
    pub image_id: String,
    pub artifact_id: Option<String>,
    pub path: String,
    pub kind: Option<String>,
    pub label: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub timeline_node_id: Option<String>,
    pub source_receipt_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SessionCanvasState {
    #[serde(default = "default_canvas_mode")]
    pub mode: String,
    #[serde(default)]
    pub view: CanvasViewport,
    #[serde(default)]
    pub multi_view: CanvasViewport,
}

impl Default for SessionCanvasState {
    fn default() -> Self {
        Self {
            mode: default_canvas_mode(),
            view: CanvasViewport::default(),
            multi_view: CanvasViewport::default(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CanvasViewport {
    pub scale: f64,
    pub offset_x: f64,
    pub offset_y: f64,
}

impl Default for CanvasViewport {
    fn default() -> Self {
        Self {
            scale: 1.0,
            offset_x: 0.0,
            offset_y: 0.0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct SessionRestoreState {
    #[serde(default)]
    pub communication: Map<String, Value>,
    pub selection: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SessionTimelinePointers {
    pub head_node_id: Option<String>,
    pub latest_node_id: Option<String>,
    pub next_seq: u64,
}

impl Default for SessionTimelinePointers {
    fn default() -> Self {
        Self {
            head_node_id: None,
            latest_node_id: None,
            next_seq: 1,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct SessionSaveState {
    #[serde(default)]
    pub dirty: bool,
}

fn default_canvas_mode() -> String {
    "multi".to_string()
}

fn now_utc_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Micros, false)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{SessionDocument, SESSION_DOCUMENT_SCHEMA, SESSION_DOCUMENT_VERSION};

    #[test]
    fn session_document_defaults_to_canonical_schema() -> anyhow::Result<()> {
        let mut session = SessionDocument::new("run-123");
        session.tab_label = Some("Run 3".to_string());
        session.state.active_image_id = Some("img-a".to_string());
        session.state.selected_image_ids = vec!["img-a".to_string()];
        session.timeline.head_node_id = Some("tl-000001".to_string());

        let value = serde_json::to_value(&session)?;
        assert_eq!(value["schema"], json!(SESSION_DOCUMENT_SCHEMA));
        assert_eq!(value["version"], json!(SESSION_DOCUMENT_VERSION));
        assert_eq!(value["run_id"], json!("run-123"));
        assert_eq!(value["state"]["active_image_id"], json!("img-a"));
        assert_eq!(value["timeline"]["head_node_id"], json!("tl-000001"));

        let roundtrip: SessionDocument = serde_json::from_value(value)?;
        assert_eq!(roundtrip, session);
        Ok(())
    }
}
