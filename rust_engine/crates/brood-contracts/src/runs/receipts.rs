use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use super::artifacts::ArtifactRecord;

pub const RECEIPT_SCHEMA_VERSION: u64 = 1;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct ImageInputs {
    pub init_image: Option<String>,
    pub mask: Option<String>,
    #[serde(default)]
    pub reference_images: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ImageRequest {
    pub prompt: String,
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default = "default_size")]
    pub size: String,
    #[serde(default = "default_n")]
    pub n: u64,
    pub seed: Option<i64>,
    pub output_format: Option<String>,
    pub background: Option<String>,
    #[serde(default)]
    pub inputs: ImageInputs,
    pub provider: Option<String>,
    #[serde(default)]
    pub provider_options: Map<String, Value>,
    pub user: Option<String>,
    pub out_dir: Option<String>,
    #[serde(default)]
    pub stream: bool,
    pub partial_images: Option<u64>,
    pub model: Option<String>,
    #[serde(default)]
    pub metadata: Map<String, Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResolvedRequest {
    pub provider: String,
    pub model: Option<String>,
    pub size: String,
    pub width: Option<u64>,
    pub height: Option<u64>,
    pub output_format: String,
    pub background: Option<String>,
    pub seed: Option<i64>,
    pub n: u64,
    pub user: Option<String>,
    pub prompt: String,
    #[serde(default)]
    pub inputs: ImageInputs,
    #[serde(default)]
    pub stream: bool,
    pub partial_images: Option<u64>,
    #[serde(default)]
    pub provider_params: Map<String, Value>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReceiptDocument {
    pub schema_version: u64,
    pub receipt_kind: String,
    pub run_id: Option<String>,
    pub artifact: ArtifactRecord,
    pub request: ImageRequest,
    pub resolved: ResolvedRequest,
    #[serde(default)]
    pub provider_request: Map<String, Value>,
    #[serde(default)]
    pub provider_response: Map<String, Value>,
    #[serde(default)]
    pub warnings: Vec<String>,
    #[serde(default)]
    pub result_metadata: Map<String, Value>,
    pub timeline: Option<ReceiptTimelineLineage>,
    #[serde(default)]
    pub source_artifacts: Vec<ReceiptSourceArtifact>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct ReceiptTimelineLineage {
    pub node_id: Option<String>,
    pub head_node_id: Option<String>,
    #[serde(default)]
    pub parent_node_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct ReceiptSourceArtifact {
    pub artifact_id: Option<String>,
    pub image_id: Option<String>,
    pub path: Option<String>,
    pub receipt_path: Option<String>,
    pub role: Option<String>,
}

pub fn build_receipt_document(
    request: &ImageRequest,
    resolved: &ResolvedRequest,
    provider_request: &Map<String, Value>,
    provider_response: &Map<String, Value>,
    warnings: &[String],
    image_path: &Path,
    receipt_path: &Path,
    result_metadata: &Map<String, Value>,
) -> ReceiptDocument {
    ReceiptDocument {
        schema_version: RECEIPT_SCHEMA_VERSION,
        receipt_kind: infer_receipt_kind(request),
        run_id: None,
        artifact: ArtifactRecord {
            artifact_id: infer_artifact_id_from_receipt_path(receipt_path)
                .or_else(|| infer_artifact_id(image_path))
                .unwrap_or_else(|| "artifact".to_string()),
            role: "output".to_string(),
            path: image_path.to_string_lossy().to_string(),
            media_type: media_type_for_output(
                resolved
                    .output_format
                    .as_str()
                    .trim()
                    .trim_start_matches('.'),
            ),
            width: resolved.width.and_then(|value| u32::try_from(value).ok()),
            height: resolved.height.and_then(|value| u32::try_from(value).ok()),
            source_image_ids: Vec::new(),
            timeline_node_id: None,
            receipt_path: Some(receipt_path.to_string_lossy().to_string()),
            sha256: None,
        },
        request: request.clone(),
        resolved: resolved.clone(),
        provider_request: provider_request.clone(),
        provider_response: provider_response.clone(),
        warnings: warnings.to_vec(),
        result_metadata: result_metadata.clone(),
        timeline: None,
        source_artifacts: source_artifacts_from_inputs(&request.inputs),
    }
}

pub fn build_receipt(
    request: &ImageRequest,
    resolved: &ResolvedRequest,
    provider_request: &Map<String, Value>,
    provider_response: &Map<String, Value>,
    warnings: &[String],
    image_path: &Path,
    receipt_path: &Path,
    result_metadata: &Map<String, Value>,
) -> Value {
    let document = build_receipt_document(
        request,
        resolved,
        provider_request,
        provider_response,
        warnings,
        image_path,
        receipt_path,
        result_metadata,
    );
    let mut root = Map::new();
    root.insert(
        "schema_version".to_string(),
        Value::Number(RECEIPT_SCHEMA_VERSION.into()),
    );
    root.insert(
        "receipt_kind".to_string(),
        Value::String(document.receipt_kind.clone()),
    );
    root.insert(
        "run_id".to_string(),
        document
            .run_id
            .clone()
            .map(Value::String)
            .unwrap_or(Value::Null),
    );
    root.insert(
        "artifact".to_string(),
        sanitize_payload(&serde_json::to_value(&document.artifact).unwrap_or(Value::Null)),
    );
    root.insert(
        "request".to_string(),
        sanitize_payload(&serde_json::to_value(request).unwrap_or(Value::Null)),
    );
    root.insert(
        "resolved".to_string(),
        sanitize_payload(&serde_json::to_value(resolved).unwrap_or(Value::Null)),
    );
    root.insert(
        "provider_request".to_string(),
        sanitize_payload(&Value::Object(provider_request.clone())),
    );
    root.insert(
        "provider_response".to_string(),
        sanitize_payload(&Value::Object(provider_response.clone())),
    );
    root.insert(
        "warnings".to_string(),
        Value::Array(warnings.iter().cloned().map(Value::String).collect()),
    );
    root.insert(
        "timeline".to_string(),
        document
            .timeline
            .as_ref()
            .map(|value| serde_json::to_value(value).unwrap_or(Value::Null))
            .unwrap_or(Value::Null),
    );
    root.insert(
        "source_artifacts".to_string(),
        Value::Array(
            document
                .source_artifacts
                .iter()
                .map(|value| sanitize_payload(&serde_json::to_value(value).unwrap_or(Value::Null)))
                .collect(),
        ),
    );

    let mut artifacts = Map::new();
    artifacts.insert(
        "image_path".to_string(),
        Value::String(image_path.to_string_lossy().to_string()),
    );
    artifacts.insert(
        "receipt_path".to_string(),
        Value::String(receipt_path.to_string_lossy().to_string()),
    );
    root.insert("artifacts".to_string(), Value::Object(artifacts));
    root.insert(
        "result_metadata".to_string(),
        sanitize_payload(&Value::Object(result_metadata.clone())),
    );
    Value::Object(root)
}

pub fn receipt_document_from_value(payload: &Value) -> anyhow::Result<ReceiptDocument> {
    let root = payload
        .as_object()
        .ok_or_else(|| anyhow::anyhow!("receipt payload must be an object"))?;
    let request: ImageRequest = serde_json::from_value(
        root.get("request")
            .cloned()
            .unwrap_or(Value::Object(Map::new())),
    )?;
    let resolved: ResolvedRequest = serde_json::from_value(
        root.get("resolved")
            .cloned()
            .unwrap_or(Value::Object(Map::new())),
    )?;
    let artifact = if let Some(value) = root.get("artifact") {
        serde_json::from_value(value.clone())?
    } else {
        legacy_artifact_from_payload(root)?
    };
    let fallback_source_artifacts = source_artifacts_from_inputs(&request.inputs);

    Ok(ReceiptDocument {
        schema_version: root
            .get("schema_version")
            .and_then(Value::as_u64)
            .unwrap_or(RECEIPT_SCHEMA_VERSION),
        receipt_kind: root
            .get("receipt_kind")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| infer_receipt_kind(&request)),
        run_id: root
            .get("run_id")
            .and_then(Value::as_str)
            .map(str::to_string),
        artifact,
        request,
        resolved,
        provider_request: root
            .get("provider_request")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default(),
        provider_response: root
            .get("provider_response")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default(),
        warnings: root
            .get("warnings")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default(),
        result_metadata: root
            .get("result_metadata")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default(),
        timeline: root
            .get("timeline")
            .and_then(|value| serde_json::from_value(value.clone()).ok()),
        source_artifacts: root
            .get("source_artifacts")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|value| serde_json::from_value(value.clone()).ok())
                    .collect()
            })
            .unwrap_or(fallback_source_artifacts),
    })
}

pub fn write_receipt(path: &Path, payload: &Value) -> anyhow::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_string_pretty(payload)?)?;
    Ok(())
}

fn sanitize_payload(value: &Value) -> Value {
    match value {
        Value::Null => Value::Null,
        Value::Bool(_) | Value::Number(_) | Value::String(_) => value.clone(),
        Value::Array(rows) => Value::Array(rows.iter().map(sanitize_payload).collect()),
        Value::Object(map) => {
            let mut out = Map::new();
            for (key, row) in map {
                let lowered = key.to_ascii_lowercase();
                if matches!(
                    lowered.as_str(),
                    "b64_json" | "image" | "image_bytes" | "data"
                ) {
                    out.insert(key.clone(), Value::String("<omitted>".to_string()));
                    continue;
                }
                out.insert(key.clone(), sanitize_payload(row));
            }
            Value::Object(out)
        }
    }
}

fn infer_receipt_kind(request: &ImageRequest) -> String {
    let mode = request.mode.trim();
    if mode.is_empty() {
        "image_generation".to_string()
    } else {
        mode.to_string()
    }
}

fn infer_artifact_id(path: &Path) -> Option<String> {
    path.file_stem()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn infer_artifact_id_from_receipt_path(path: &Path) -> Option<String> {
    infer_artifact_id(path).map(|stem| {
        let trimmed = stem.trim();
        match trimmed.strip_prefix("receipt-").map(str::trim) {
            Some(stripped) if !stripped.is_empty() => stripped.to_string(),
            _ => stem,
        }
    })
}

fn media_type_for_output(output_format: &str) -> String {
    match output_format.to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => "image/jpeg".to_string(),
        "webp" => "image/webp".to_string(),
        "tif" | "tiff" => "image/tiff".to_string(),
        "psd" => "image/vnd.adobe.photoshop".to_string(),
        "png" => "image/png".to_string(),
        _ => "application/octet-stream".to_string(),
    }
}

fn source_artifacts_from_inputs(inputs: &ImageInputs) -> Vec<ReceiptSourceArtifact> {
    let mut out = Vec::new();
    if let Some(path) = inputs
        .init_image
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        out.push(ReceiptSourceArtifact {
            artifact_id: None,
            image_id: None,
            path: Some(path.clone()),
            receipt_path: None,
            role: Some("init_image".to_string()),
        });
    }
    if let Some(path) = inputs
        .mask
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        out.push(ReceiptSourceArtifact {
            artifact_id: None,
            image_id: None,
            path: Some(path.clone()),
            receipt_path: None,
            role: Some("mask".to_string()),
        });
    }
    for path in &inputs.reference_images {
        if path.trim().is_empty() {
            continue;
        }
        out.push(ReceiptSourceArtifact {
            artifact_id: None,
            image_id: None,
            path: Some(path.clone()),
            receipt_path: None,
            role: Some("reference_image".to_string()),
        });
    }
    out
}

fn legacy_artifact_from_payload(root: &Map<String, Value>) -> anyhow::Result<ArtifactRecord> {
    let artifacts = root
        .get("artifacts")
        .and_then(Value::as_object)
        .ok_or_else(|| anyhow::anyhow!("receipt payload is missing artifact data"))?;
    let artifact_path = artifacts
        .get("export_path")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or_else(|| {
            artifacts
                .get("image_path")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
        })
        .unwrap_or_default()
        .to_string();
    let receipt_path = artifacts
        .get("receipt_path")
        .and_then(Value::as_str)
        .map(str::to_string);
    let artifact_id = receipt_path
        .as_deref()
        .and_then(|value| infer_artifact_id_from_receipt_path(Path::new(value)))
        .or_else(|| infer_artifact_id(Path::new(&artifact_path)))
        .unwrap_or_else(|| "artifact".to_string());

    Ok(ArtifactRecord {
        artifact_id,
        role: "output".to_string(),
        media_type: root
            .get("resolved")
            .and_then(Value::as_object)
            .and_then(|resolved| resolved.get("output_format"))
            .and_then(Value::as_str)
            .map(media_type_for_output)
            .unwrap_or_else(|| "application/octet-stream".to_string()),
        path: artifact_path,
        width: root
            .get("resolved")
            .and_then(Value::as_object)
            .and_then(|resolved| resolved.get("width"))
            .and_then(Value::as_u64)
            .and_then(|value| u32::try_from(value).ok()),
        height: root
            .get("resolved")
            .and_then(Value::as_object)
            .and_then(|resolved| resolved.get("height"))
            .and_then(Value::as_u64)
            .and_then(|value| u32::try_from(value).ok()),
        source_image_ids: Vec::new(),
        timeline_node_id: None,
        receipt_path,
        sha256: None,
    })
}

fn default_mode() -> String {
    "generate".to_string()
}

fn default_size() -> String {
    "1024x1024".to_string()
}

fn default_n() -> u64 {
    1
}

#[cfg(test)]
mod tests {
    use serde_json::{json, Map, Value};

    use super::{
        build_receipt, receipt_document_from_value, write_receipt, ImageInputs, ImageRequest,
        ResolvedRequest, RECEIPT_SCHEMA_VERSION,
    };

    #[test]
    fn receipt_builder_writes_expected_shape() -> anyhow::Result<()> {
        let temp = tempfile::tempdir()?;
        let receipt_path = temp.path().join("receipt-artifact-1.json");
        let image_path = temp.path().join("image.png");
        std::fs::write(&image_path, b"png")?;

        let request = ImageRequest {
            prompt: "hello".to_string(),
            mode: "generate".to_string(),
            size: "1024x1024".to_string(),
            n: 1,
            seed: Some(7),
            output_format: Some("png".to_string()),
            background: None,
            inputs: ImageInputs::default(),
            provider: Some("dryrun".to_string()),
            provider_options: Map::new(),
            user: None,
            out_dir: Some(temp.path().to_string_lossy().to_string()),
            stream: false,
            partial_images: None,
            model: Some("dryrun-image-1".to_string()),
            metadata: Map::new(),
        };
        let resolved = ResolvedRequest {
            provider: "dryrun".to_string(),
            model: Some("dryrun-image-1".to_string()),
            size: "1024x1024".to_string(),
            width: Some(1024),
            height: Some(1024),
            output_format: "png".to_string(),
            background: None,
            seed: Some(7),
            n: 1,
            user: None,
            prompt: "hello".to_string(),
            inputs: ImageInputs::default(),
            stream: false,
            partial_images: None,
            provider_params: Map::new(),
            warnings: Vec::new(),
        };
        let mut provider_request = Map::new();
        provider_request.insert("endpoint".to_string(), json!("dryrun"));
        let mut provider_response = Map::new();
        provider_response.insert("status".to_string(), json!("ok"));
        let warnings = vec!["note".to_string()];
        let mut result_metadata = Map::new();
        result_metadata.insert("cost_total_usd".to_string(), Value::Null);
        result_metadata.insert("latency_per_image_s".to_string(), json!(0.01));

        let payload = build_receipt(
            &request,
            &resolved,
            &provider_request,
            &provider_response,
            &warnings,
            &image_path,
            &receipt_path,
            &result_metadata,
        );
        write_receipt(&receipt_path, &payload)?;

        let raw = std::fs::read_to_string(&receipt_path)?;
        let parsed: Value = serde_json::from_str(&raw)?;
        assert_eq!(parsed["schema_version"], json!(RECEIPT_SCHEMA_VERSION));
        assert_eq!(parsed["receipt_kind"], json!("generate"));
        assert_eq!(parsed["artifact"]["artifact_id"], json!("artifact-1"));
        assert_eq!(
            parsed["artifact"]["path"],
            json!(image_path.to_string_lossy())
        );
        assert_eq!(parsed["request"]["prompt"], json!("hello"));
        assert_eq!(parsed["resolved"]["provider"], json!("dryrun"));
        assert_eq!(
            parsed["artifacts"]["image_path"],
            json!(image_path.to_string_lossy())
        );
        assert_eq!(
            parsed["result_metadata"]["latency_per_image_s"],
            json!(0.01)
        );
        Ok(())
    }

    #[test]
    fn receipt_document_reader_accepts_legacy_artifacts_shape() -> anyhow::Result<()> {
        let payload = json!({
            "schema_version": 1,
            "request": {
                "prompt": "",
                "mode": "design_review_apply",
                "size": "1024x1024",
                "n": 1,
                "seed": null,
                "output_format": "png",
                "background": null,
                "inputs": {
                    "init_image": "/tmp/run/source.png",
                    "mask": null,
                    "reference_images": ["/tmp/run/ref.png"]
                },
                "provider": "google",
                "provider_options": {},
                "user": null,
                "out_dir": "/tmp/run",
                "stream": false,
                "partial_images": null,
                "model": "gemini",
                "metadata": {}
            },
            "resolved": {
                "provider": "google",
                "model": "gemini",
                "size": "1024x1024",
                "width": 1024,
                "height": 1024,
                "output_format": "png",
                "background": null,
                "seed": null,
                "n": 1,
                "user": null,
                "prompt": "",
                "inputs": {
                    "init_image": "/tmp/run/source.png",
                    "mask": null,
                    "reference_images": ["/tmp/run/ref.png"]
                },
                "stream": false,
                "partial_images": null,
                "provider_params": {},
                "warnings": []
            },
            "provider_request": {},
            "provider_response": {},
            "warnings": [],
            "artifacts": {
                "image_path": "/tmp/run/out.png",
                "receipt_path": "/tmp/run/receipt-review-apply-1.json"
            },
            "result_metadata": {
                "operation": "design_review_apply"
            }
        });

        let document = receipt_document_from_value(&payload)?;
        assert_eq!(document.receipt_kind, "design_review_apply");
        assert_eq!(document.artifact.path, "/tmp/run/out.png");
        assert_eq!(
            document.artifact.receipt_path.as_deref(),
            Some("/tmp/run/receipt-review-apply-1.json")
        );
        assert_eq!(document.source_artifacts.len(), 2);
        Ok(())
    }

    #[test]
    fn receipt_document_reader_prefers_export_path_for_legacy_export_receipts(
    ) -> anyhow::Result<()> {
        let payload = json!({
            "schema_version": 1,
            "request": {
                "prompt": "",
                "mode": "local",
                "size": "1024x1024",
                "n": 1,
                "seed": null,
                "output_format": "psd",
                "background": null,
                "inputs": {
                    "init_image": "/tmp/run/export.flattened.png",
                    "mask": null,
                    "reference_images": []
                },
                "provider": "local",
                "provider_options": {},
                "user": null,
                "out_dir": "/tmp/run",
                "stream": false,
                "partial_images": null,
                "model": "juggernaut-psd-export-v1",
                "metadata": {
                    "operation": "export_psd"
                }
            },
            "resolved": {
                "provider": "local",
                "model": "juggernaut-psd-export-v1",
                "size": "1024x1024",
                "width": 1024,
                "height": 1024,
                "output_format": "psd",
                "background": "transparent",
                "seed": null,
                "n": 1,
                "user": null,
                "prompt": "",
                "inputs": {
                    "init_image": "/tmp/run/export.flattened.png",
                    "mask": null,
                    "reference_images": []
                },
                "stream": false,
                "partial_images": null,
                "provider_params": {},
                "warnings": []
            },
            "provider_request": {},
            "provider_response": {},
            "warnings": [],
            "artifacts": {
                "image_path": "/tmp/run/export.flattened.png",
                "export_path": "/tmp/run/exported.psd",
                "receipt_path": "/tmp/run/receipt-export-20260401T120000.json"
            },
            "result_metadata": {
                "operation": "export_psd"
            }
        });

        let document = receipt_document_from_value(&payload)?;
        assert_eq!(document.artifact.path, "/tmp/run/exported.psd");
        assert_eq!(document.artifact.artifact_id, "export-20260401T120000");
        Ok(())
    }
}
