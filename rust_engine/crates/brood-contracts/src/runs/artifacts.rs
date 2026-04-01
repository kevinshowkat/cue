use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct ArtifactRecord {
    pub artifact_id: String,
    pub role: String,
    pub path: String,
    pub media_type: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    #[serde(default)]
    pub source_image_ids: Vec<String>,
    pub timeline_node_id: Option<String>,
    pub receipt_path: Option<String>,
    pub sha256: Option<String>,
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::ArtifactRecord;

    #[test]
    fn artifact_record_roundtrips() -> anyhow::Result<()> {
        let record = ArtifactRecord {
            artifact_id: "artifact-1".to_string(),
            role: "output".to_string(),
            path: "/tmp/run/artifacts/out.png".to_string(),
            media_type: "image/png".to_string(),
            width: Some(512),
            height: Some(256),
            source_image_ids: vec!["img-a".to_string()],
            timeline_node_id: Some("tl-000001".to_string()),
            receipt_path: Some("/tmp/run/receipts/receipt-1.json".to_string()),
            sha256: Some("abc123".to_string()),
        };

        let value = serde_json::to_value(&record)?;
        assert_eq!(value["artifact_id"], json!("artifact-1"));
        assert_eq!(value["media_type"], json!("image/png"));

        let roundtrip: ArtifactRecord = serde_json::from_value(value)?;
        assert_eq!(roundtrip, record);
        Ok(())
    }
}
