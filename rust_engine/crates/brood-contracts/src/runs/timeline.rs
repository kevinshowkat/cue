use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};

use super::session::SessionSnapshot;

pub const TIMELINE_DOCUMENT_SCHEMA: &str = "cue.timeline.v1";
pub const TIMELINE_DOCUMENT_VERSION: u64 = 1;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TimelineDocument {
    pub schema: String,
    pub version: u64,
    pub run_id: String,
    pub head_node_id: Option<String>,
    pub latest_node_id: Option<String>,
    pub next_seq: u64,
    pub updated_at: String,
    #[serde(default)]
    pub nodes: Vec<TimelineNode>,
}

impl TimelineDocument {
    pub fn new(run_id: impl Into<String>) -> Self {
        Self {
            schema: TIMELINE_DOCUMENT_SCHEMA.to_string(),
            version: TIMELINE_DOCUMENT_VERSION,
            run_id: run_id.into(),
            head_node_id: None,
            latest_node_id: None,
            next_seq: 1,
            updated_at: now_utc_iso(),
            nodes: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TimelineNode {
    pub node_id: String,
    pub seq: u64,
    pub created_at: String,
    pub kind: Option<String>,
    pub action: Option<String>,
    pub label: Option<String>,
    pub detail: Option<String>,
    #[serde(default)]
    pub parents: Vec<String>,
    #[serde(default)]
    pub image_ids: Vec<String>,
    pub preview_image_id: Option<String>,
    pub preview_path: Option<String>,
    #[serde(default)]
    pub receipt_paths: Vec<String>,
    #[serde(default)]
    pub snapshot_ref: SessionSnapshotRef,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum SessionSnapshotRef {
    Inline { snapshot: SessionSnapshot },
}

impl Default for SessionSnapshotRef {
    fn default() -> Self {
        Self::Inline {
            snapshot: SessionSnapshot::default(),
        }
    }
}

fn now_utc_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Micros, false)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{
        SessionSnapshotRef, TimelineDocument, TimelineNode, TIMELINE_DOCUMENT_SCHEMA,
        TIMELINE_DOCUMENT_VERSION,
    };
    use crate::runs::session::SessionSnapshot;

    #[test]
    fn timeline_document_roundtrips_with_inline_snapshot() -> anyhow::Result<()> {
        let mut timeline = TimelineDocument::new("run-123");
        timeline.head_node_id = Some("tl-000001".to_string());
        timeline.latest_node_id = Some("tl-000001".to_string());
        timeline.next_seq = 2;
        timeline.nodes.push(TimelineNode {
            node_id: "tl-000001".to_string(),
            seq: 1,
            created_at: "2026-03-31T10:00:00Z".to_string(),
            kind: Some("import".to_string()),
            action: Some("Import".to_string()),
            label: Some("hero.png".to_string()),
            detail: None,
            parents: Vec::new(),
            image_ids: vec!["img-a".to_string()],
            preview_image_id: Some("img-a".to_string()),
            preview_path: Some("/tmp/run/artifacts/hero.png".to_string()),
            receipt_paths: vec!["/tmp/run/receipts/receipt-1.json".to_string()],
            snapshot_ref: SessionSnapshotRef::Inline {
                snapshot: SessionSnapshot::default(),
            },
        });

        let value = serde_json::to_value(&timeline)?;
        assert_eq!(value["schema"], json!(TIMELINE_DOCUMENT_SCHEMA));
        assert_eq!(value["version"], json!(TIMELINE_DOCUMENT_VERSION));
        assert_eq!(value["run_id"], json!("run-123"));
        assert_eq!(value["nodes"][0]["snapshot_ref"]["kind"], json!("inline"));

        let roundtrip: TimelineDocument = serde_json::from_value(value)?;
        assert_eq!(roundtrip, timeline);
        Ok(())
    }
}
