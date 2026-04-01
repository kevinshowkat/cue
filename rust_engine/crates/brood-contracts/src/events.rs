use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

pub type EventPayload = Map<String, Value>;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EventRecord {
    #[serde(rename = "type")]
    pub event_type: String,
    pub run_id: String,
    pub ts: String,
    #[serde(flatten)]
    pub payload: EventPayload,
}

/// Append-only writer for `events.jsonl`.
///
/// This mirrors the current Python behavior:
/// - default fields are `type`, `run_id`, `ts`
/// - caller payload is merged last and can override defaults
/// - one compact JSON object per line
#[derive(Debug, Clone)]
pub struct EventWriter {
    inner: Arc<EventWriterInner>,
}

#[derive(Debug)]
struct EventWriterInner {
    path: PathBuf,
    run_id: String,
    lock: Mutex<()>,
}

impl EventWriter {
    pub fn new(path: impl Into<PathBuf>, run_id: impl Into<String>) -> Self {
        Self {
            inner: Arc::new(EventWriterInner {
                path: path.into(),
                run_id: run_id.into(),
                lock: Mutex::new(()),
            }),
        }
    }

    pub fn path(&self) -> &Path {
        &self.inner.path
    }

    pub fn run_id(&self) -> &str {
        &self.inner.run_id
    }

    pub fn emit_record(
        &self,
        event_type: &str,
        payload: EventPayload,
    ) -> anyhow::Result<EventRecord> {
        let mut record = EventRecord {
            event_type: event_type.to_string(),
            run_id: self.inner.run_id.clone(),
            ts: now_utc_iso(),
            payload: EventPayload::new(),
        };
        for (key, value) in payload {
            record.payload.insert(key, value);
        }
        self.write_record(&record)?;
        Ok(record)
    }

    pub fn emit(&self, event_type: &str, payload: EventPayload) -> anyhow::Result<Value> {
        let record = self.emit_record(event_type, payload)?;
        let mut event = serde_json::to_value(&record)?
            .as_object()
            .cloned()
            .unwrap_or_default();
        if let Some(value) = event.remove("event_type") {
            event.insert("type".to_string(), value);
        }
        Ok(Value::Object(event))
    }

    fn write_record(&self, record: &EventRecord) -> anyhow::Result<()> {
        if let Some(parent) = self.inner.path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let line = serde_json::to_string(record)?;
        let _guard = self
            .inner
            .lock
            .lock()
            .map_err(|_| anyhow::anyhow!("event writer lock poisoned"))?;
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.inner.path)?;
        file.write_all(line.as_bytes())?;
        file.write_all(b"\n")?;
        Ok(())
    }
}

fn now_utc_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Micros, false)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use chrono::DateTime;

    use super::*;

    #[test]
    fn emit_writes_compact_jsonl_line() -> anyhow::Result<()> {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("events.jsonl");
        let writer = EventWriter::new(&path, "run-123");

        let mut payload = EventPayload::new();
        payload.insert("out_dir".to_string(), Value::String("/tmp/run".to_string()));
        let emitted = writer.emit("run_started", payload)?;

        let content = fs::read_to_string(&path)?;
        let line = content.lines().next().unwrap_or("");
        let parsed: Value = serde_json::from_str(line)?;

        assert_eq!(parsed, emitted);
        assert_eq!(parsed["type"], Value::String("run_started".to_string()));
        assert_eq!(parsed["run_id"], Value::String("run-123".to_string()));
        assert_eq!(parsed["out_dir"], Value::String("/tmp/run".to_string()));

        let ts = parsed["ts"].as_str().unwrap_or("");
        DateTime::parse_from_rfc3339(ts)?;
        Ok(())
    }

    #[test]
    fn payload_can_override_default_keys() -> anyhow::Result<()> {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("events.jsonl");
        let writer = EventWriter::new(&path, "run-123");

        let mut payload = EventPayload::new();
        payload.insert("type".to_string(), Value::String("override".to_string()));
        payload.insert(
            "run_id".to_string(),
            Value::String("override-run".to_string()),
        );
        let emitted = writer.emit("run_started", payload)?;

        assert_eq!(emitted["type"], Value::String("override".to_string()));
        assert_eq!(emitted["run_id"], Value::String("override-run".to_string()));
        Ok(())
    }

    #[test]
    fn emit_appends_lines() -> anyhow::Result<()> {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("events.jsonl");
        let writer = EventWriter::new(&path, "run-123");

        writer.emit("one", EventPayload::new())?;
        writer.emit("two", EventPayload::new())?;

        let content = fs::read_to_string(&path)?;
        let lines: Vec<&str> = content.lines().collect();
        assert_eq!(lines.len(), 2);

        let first: Value = serde_json::from_str(lines[0])?;
        let second: Value = serde_json::from_str(lines[1])?;
        assert_eq!(first["type"], Value::String("one".to_string()));
        assert_eq!(second["type"], Value::String("two".to_string()));
        Ok(())
    }

    #[test]
    fn emit_record_returns_typed_event_record() -> anyhow::Result<()> {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("events.jsonl");
        let writer = EventWriter::new(&path, "run-123");

        let mut payload = EventPayload::new();
        payload.insert("phase".to_string(), Value::String("ready".to_string()));
        let record = writer.emit_record("session_ready", payload)?;

        assert_eq!(record.event_type, "session_ready");
        assert_eq!(record.run_id, "run-123");
        assert_eq!(
            record.payload.get("phase"),
            Some(&Value::String("ready".to_string()))
        );

        let raw = fs::read_to_string(path)?;
        let parsed: Value = serde_json::from_str(raw.lines().next().unwrap_or(""))?;
        assert_eq!(parsed["type"], Value::String("session_ready".to_string()));
        Ok(())
    }
}
