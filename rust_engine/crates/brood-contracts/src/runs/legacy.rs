use chrono::{SecondsFormat, TimeZone, Utc};
use serde_json::{Map, Value};

use super::session::{
    CanvasViewport, SessionCanvasState, SessionDocument, SessionImageRecord, SessionSnapshot,
    SessionTimelinePointers,
};
use super::timeline::{SessionSnapshotRef, TimelineDocument, TimelineNode};

pub const LEGACY_SESSION_DOCUMENT_SCHEMA: &str = "juggernaut.session_snapshot.v1";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LegacySessionAdapter;

impl LegacySessionAdapter {
    pub fn adapt_session_document(
        run_id: impl Into<String>,
        payload: &Value,
    ) -> anyhow::Result<SessionDocument> {
        let run_id = run_id.into();
        let root = payload
            .as_object()
            .ok_or_else(|| anyhow::anyhow!("legacy session payload must be an object"))?;
        let session_value = legacy_deserialize_value(root.get("session").unwrap_or(&Value::Null));
        let session = session_value.as_object().cloned().unwrap_or_default();

        let mut document = SessionDocument::new(run_id);
        document.saved_at = read_string(root, "savedAt").unwrap_or_else(now_utc_iso);
        document.tab_label = read_string(root, "label");
        document.state = adapt_snapshot_from_legacy_object(&session);
        document.timeline = SessionTimelinePointers {
            head_node_id: read_string(&session, "timelineHeadNodeId"),
            latest_node_id: read_string(&session, "timelineLatestNodeId"),
            next_seq: read_u64(&session, "timelineNextSeq").unwrap_or(1),
        };
        Ok(document)
    }

    pub fn adapt_timeline_document(
        run_id: impl Into<String>,
        payload: &Value,
    ) -> anyhow::Result<TimelineDocument> {
        let run_id = run_id.into();
        let root = payload
            .as_object()
            .ok_or_else(|| anyhow::anyhow!("legacy timeline payload must be an object"))?;

        let mut document = TimelineDocument::new(run_id);
        document.head_node_id = read_string(root, "headNodeId");
        document.latest_node_id = read_string(root, "latestNodeId");
        document.next_seq = read_u64(root, "nextSeq").unwrap_or(1);
        document.updated_at = read_string(root, "updatedAt").unwrap_or_else(now_utc_iso);
        document.nodes = root
            .get("nodes")
            .and_then(Value::as_array)
            .map(|nodes| {
                nodes
                    .iter()
                    .map(adapt_timeline_node)
                    .collect::<Vec<TimelineNode>>()
            })
            .unwrap_or_default();
        Ok(document)
    }
}

fn adapt_timeline_node(value: &Value) -> TimelineNode {
    let current = value.as_object().cloned().unwrap_or_default();
    let snapshot = legacy_deserialize_value(current.get("snapshot").unwrap_or(&Value::Null));
    let snapshot = adapt_snapshot_from_legacy_value(&snapshot);

    TimelineNode {
        node_id: read_string(&current, "nodeId").unwrap_or_else(|| "tl-000001".to_string()),
        seq: read_u64(&current, "seq").unwrap_or(1),
        created_at: iso_from_legacy_value(current.get("createdAt")),
        kind: read_string(&current, "kind"),
        action: read_string(&current, "action"),
        label: read_string(&current, "label"),
        detail: read_string(&current, "detail"),
        parents: read_string_list(current.get("parents")),
        image_ids: read_string_list(current.get("imageIds")),
        preview_image_id: read_string(&current, "previewImageId")
            .or_else(|| read_string(&current, "imageId")),
        preview_path: read_string(&current, "previewPath")
            .or_else(|| read_string(&current, "path")),
        receipt_paths: read_string_list(current.get("receiptPaths"))
            .into_iter()
            .chain(read_string(&current, "receiptPath").into_iter())
            .collect(),
        snapshot_ref: SessionSnapshotRef::Inline { snapshot },
    }
}

fn adapt_snapshot_from_legacy_value(value: &Value) -> SessionSnapshot {
    let current = value.as_object().cloned().unwrap_or_default();
    adapt_snapshot_from_legacy_object(&current)
}

fn adapt_snapshot_from_legacy_object(current: &Map<String, Value>) -> SessionSnapshot {
    SessionSnapshot {
        active_image_id: read_string(current, "activeId"),
        selected_image_ids: read_string_list(current.get("selectedIds")),
        images: current
            .get("images")
            .and_then(Value::as_array)
            .map(|rows| rows.iter().map(adapt_session_image).collect())
            .unwrap_or_default(),
        canvas: SessionCanvasState {
            mode: read_string(current, "canvasMode").unwrap_or_else(|| "multi".to_string()),
            view: adapt_viewport(current.get("view")),
            multi_view: adapt_viewport(current.get("multiView")),
        },
        overlays: crate::runs::session::SessionRestoreState {
            communication: sanitize_legacy_communication(current.get("communication")),
            selection: current.get("selection").cloned(),
        },
    }
}

fn adapt_session_image(value: &Value) -> SessionImageRecord {
    let current = value.as_object().cloned().unwrap_or_default();
    SessionImageRecord {
        image_id: read_string(&current, "id").unwrap_or_default(),
        artifact_id: read_string(&current, "artifactId"),
        path: read_string(&current, "path").unwrap_or_default(),
        kind: read_string(&current, "kind"),
        label: read_string(&current, "label"),
        width: read_u64(&current, "width").and_then(|value| u32::try_from(value).ok()),
        height: read_u64(&current, "height").and_then(|value| u32::try_from(value).ok()),
        timeline_node_id: read_string(&current, "timelineNodeId"),
        source_receipt_path: read_string(&current, "receiptPath"),
    }
}

fn sanitize_legacy_communication(value: Option<&Value>) -> Map<String, Value> {
    let Some(current) = value else {
        return Map::new();
    };
    let Value::Object(mut out) = legacy_deserialize_value(current) else {
        return Map::new();
    };
    out.remove("markDraft");
    out.remove("eraseDraft");
    out.remove("proposalTray");
    out
}

fn adapt_viewport(value: Option<&Value>) -> CanvasViewport {
    let current = value.and_then(Value::as_object);
    CanvasViewport {
        scale: current
            .and_then(|row| row.get("scale"))
            .and_then(Value::as_f64)
            .unwrap_or(1.0),
        offset_x: current
            .and_then(|row| row.get("offsetX"))
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
        offset_y: current
            .and_then(|row| row.get("offsetY"))
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
    }
}

fn legacy_deserialize_value(value: &Value) -> Value {
    match value {
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => value.clone(),
        Value::Array(rows) => Value::Array(rows.iter().map(legacy_deserialize_value).collect()),
        Value::Object(map) => {
            let serialized_type = map
                .get("__juggernautSerializedType")
                .and_then(Value::as_str)
                .unwrap_or("");
            match serialized_type {
                "map" => {
                    let mut out = Map::new();
                    let entries = map.get("entries").and_then(Value::as_array);
                    for entry in entries.into_iter().flatten() {
                        let Some(pair) = entry.as_array() else {
                            continue;
                        };
                        if pair.len() < 2 {
                            continue;
                        }
                        let key = legacy_map_key_to_string(&legacy_deserialize_value(&pair[0]));
                        out.insert(key, legacy_deserialize_value(&pair[1]));
                    }
                    Value::Object(out)
                }
                "set" => Value::Array(
                    map.get("values")
                        .and_then(Value::as_array)
                        .map(|rows| rows.iter().map(legacy_deserialize_value).collect())
                        .unwrap_or_default(),
                ),
                "date" => map.get("value").cloned().unwrap_or(Value::Null),
                _ => {
                    let mut out = Map::new();
                    for (key, row) in map {
                        if key == "__juggernautSerializedType" {
                            continue;
                        }
                        out.insert(key.clone(), legacy_deserialize_value(row));
                    }
                    Value::Object(out)
                }
            }
        }
    }
}

fn legacy_map_key_to_string(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Null => String::new(),
        _ => serde_json::to_string(value).unwrap_or_default(),
    }
}

fn read_string(map: &Map<String, Value>, key: &str) -> Option<String> {
    map.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn read_u64(map: &Map<String, Value>, key: &str) -> Option<u64> {
    map.get(key).and_then(Value::as_u64)
}

fn read_string_list(value: Option<&Value>) -> Vec<String> {
    let mut out = Vec::new();
    for item in value.and_then(Value::as_array).into_iter().flatten() {
        let text = match item {
            Value::String(value) => value.trim().to_string(),
            _ => String::new(),
        };
        if text.is_empty() || out.contains(&text) {
            continue;
        }
        out.push(text);
    }
    out
}

fn iso_from_legacy_value(value: Option<&Value>) -> String {
    match value {
        Some(Value::String(text)) if !text.trim().is_empty() => text.trim().to_string(),
        Some(Value::Number(number)) => {
            if let Some(ms) = number.as_i64() {
                if let Some(ts) = Utc.timestamp_millis_opt(ms).single() {
                    return ts.to_rfc3339_opts(SecondsFormat::Micros, false);
                }
            }
            now_utc_iso()
        }
        _ => now_utc_iso(),
    }
}

fn now_utc_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Micros, false)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{LegacySessionAdapter, LEGACY_SESSION_DOCUMENT_SCHEMA};

    #[test]
    fn adapter_maps_legacy_session_snapshot_into_canonical_document() -> anyhow::Result<()> {
        let payload = json!({
            "schema": LEGACY_SESSION_DOCUMENT_SCHEMA,
            "savedAt": "2026-03-31T18:10:00Z",
            "label": "Run A",
            "session": {
                "activeId": "img-a",
                "selectedIds": ["img-a", "img-a"],
                "canvasMode": "multi",
                "view": { "scale": 2.0, "offsetX": 10.0, "offsetY": 20.0 },
                "multiView": { "scale": 1.0, "offsetX": 0.0, "offsetY": 0.0 },
                "images": [
                    {
                        "id": "img-a",
                        "path": "/tmp/run/artifact-a.png",
                        "label": "Hero",
                        "receiptPath": "/tmp/run/receipt-a.json",
                        "timelineNodeId": "tl-000001",
                        "width": 1440,
                        "height": 900
                    }
                ],
                "communication": {
                    "__juggernautSerializedType": "map",
                    "entries": [
                        ["marksByImageId", { "__juggernautSerializedType": "map", "entries": [["img-a", [{"id": "mark-1"}]]] }],
                        ["markDraft", {"id": "draft"}]
                    ]
                },
                "selection": { "points": [{ "x": 1, "y": 2 }] },
                "timelineHeadNodeId": "tl-000001",
                "timelineLatestNodeId": "tl-000002",
                "timelineNextSeq": 3
            }
        });

        let document = LegacySessionAdapter::adapt_session_document("run-123", &payload)?;
        assert_eq!(document.schema, "cue.session.v1");
        assert_eq!(document.run_id, "run-123");
        assert_eq!(document.tab_label.as_deref(), Some("Run A"));
        assert_eq!(document.state.active_image_id.as_deref(), Some("img-a"));
        assert_eq!(document.state.selected_image_ids, vec!["img-a".to_string()]);
        assert_eq!(document.state.images.len(), 1);
        assert_eq!(
            document.state.images[0].source_receipt_path.as_deref(),
            Some("/tmp/run/receipt-a.json")
        );
        assert!(document
            .state
            .overlays
            .communication
            .get("markDraft")
            .is_none());
        assert!(document
            .state
            .overlays
            .communication
            .get("marksByImageId")
            .is_some());
        assert_eq!(document.timeline.head_node_id.as_deref(), Some("tl-000001"));
        assert_eq!(
            document.timeline.latest_node_id.as_deref(),
            Some("tl-000002")
        );
        assert_eq!(document.timeline.next_seq, 3);
        Ok(())
    }

    #[test]
    fn adapter_maps_legacy_timeline_into_canonical_document() -> anyhow::Result<()> {
        let payload = json!({
            "headNodeId": "tl-000002",
            "latestNodeId": "tl-000003",
            "nextSeq": 4,
            "updatedAt": "2026-03-31T18:12:00Z",
            "nodes": [
                {
                    "nodeId": "tl-000002",
                    "seq": 2,
                    "createdAt": 1711900000000i64,
                    "kind": "apply",
                    "action": "Swap background",
                    "label": "hero-v2.png",
                    "parents": ["tl-000001"],
                    "imageIds": ["img-a"],
                    "previewImageId": "img-a",
                    "previewPath": "/tmp/run/artifact-a.png",
                    "receiptPaths": ["/tmp/run/receipt-a.json"],
                    "snapshot": {
                        "activeId": "img-a",
                        "selectedIds": ["img-a"],
                        "images": [{ "id": "img-a", "path": "/tmp/run/artifact-a.png" }]
                    }
                }
            ]
        });

        let document = LegacySessionAdapter::adapt_timeline_document("run-123", &payload)?;
        assert_eq!(document.schema, "cue.timeline.v1");
        assert_eq!(document.run_id, "run-123");
        assert_eq!(document.head_node_id.as_deref(), Some("tl-000002"));
        assert_eq!(document.latest_node_id.as_deref(), Some("tl-000003"));
        assert_eq!(document.next_seq, 4);
        assert_eq!(document.nodes.len(), 1);
        assert_eq!(document.nodes[0].node_id, "tl-000002");
        assert_eq!(document.nodes[0].parents, vec!["tl-000001".to_string()]);
        assert_eq!(
            document.nodes[0].receipt_paths,
            vec!["/tmp/run/receipt-a.json".to_string()]
        );
        Ok(())
    }
}
