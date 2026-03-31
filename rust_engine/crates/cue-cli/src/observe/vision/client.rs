use std::path::Path;
use std::time::Duration;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::{DynamicImage, Rgba, RgbaImage};
use reqwest::blocking::Client as HttpClient;
use reqwest::header::CONTENT_TYPE;
use serde_json::{json, Map, Value};

use super::prompts::{OPENAI_VISION_FALLBACK_MODEL, OPENROUTER_OPENAI_VISION_FALLBACK_MODEL};

pub(crate) fn sanitize_openai_responses_model(raw: &str, default_model: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return default_model.to_string();
    }
    if trimmed.to_ascii_lowercase().contains("realtime") {
        return default_model.to_string();
    }
    trimmed.to_string()
}

pub(crate) fn openai_vision_request(
    model: &str,
    content: Vec<Value>,
    max_output_tokens: u64,
    timeout: Duration,
) -> Option<(String, Option<i64>, Option<i64>, String)> {
    let request_model = sanitize_openai_responses_model(model, OPENAI_VISION_FALLBACK_MODEL);
    let client = HttpClient::builder().timeout(timeout).build().ok()?;
    if let Some(api_key) = crate::lib_impl::openai_api_key() {
        let endpoint = format!("{}/responses", crate::lib_impl::openai_api_base());
        let payload = json!({
            "model": request_model,
            "input": [{
                "role": "user",
                "content": content.clone(),
            }],
            "max_output_tokens": max_output_tokens,
        });
        let response = client
            .post(endpoint)
            .bearer_auth(api_key)
            .header(CONTENT_TYPE, "application/json")
            .json(&payload)
            .send();
        if let Ok(response) = response {
            if response.status().is_success() {
                if let Ok(parsed) = response.json::<Value>() {
                    let text = extract_openai_output_text(&parsed);
                    if !text.trim().is_empty() {
                        let (input_tokens, output_tokens) = extract_token_usage_pair(&parsed);
                        return Some((text, input_tokens, output_tokens, request_model.clone()));
                    }
                }
            }
        }
    }

    let openrouter_key = crate::lib_impl::openrouter_api_key()?;
    let openrouter_base = crate::lib_impl::openrouter_api_base();
    let openrouter_model = crate::lib_impl::sanitize_openrouter_model(
        &request_model,
        OPENROUTER_OPENAI_VISION_FALLBACK_MODEL,
    );
    let responses_endpoint = format!("{openrouter_base}/responses");
    let responses_payload = json!({
        "model": openrouter_model,
        "input": [{
            "role": "user",
            "content": content,
        }],
        "modalities": ["text"],
        "max_output_tokens": max_output_tokens,
        "stream": false,
    });
    let responses_request = client
        .post(&responses_endpoint)
        .bearer_auth(&openrouter_key)
        .header(CONTENT_TYPE, "application/json");
    let responses_response = crate::lib_impl::apply_openrouter_request_headers(responses_request)
        .json(&responses_payload)
        .send()
        .ok()?;
    if responses_response.status().is_success() {
        let parsed: Value = responses_response.json().ok()?;
        let text = extract_openai_output_text(&parsed);
        if !text.trim().is_empty() {
            let (input_tokens, output_tokens) = extract_token_usage_pair(&parsed);
            return Some((text, input_tokens, output_tokens, openrouter_model));
        }
    } else {
        let code = responses_response.status().as_u16();
        let body = responses_response.text().ok()?;
        if !should_fallback_openrouter_responses(code, &body) {
            return None;
        }
    }

    let chat_endpoint = format!("{openrouter_base}/chat/completions");
    let chat_payload = json!({
        "model": openrouter_model,
        "messages": [{
            "role": "user",
            "content": openrouter_responses_content_to_chat_content(&content),
        }],
        "modalities": ["text"],
        "max_tokens": max_output_tokens,
        "stream": false,
    });
    let chat_request = client
        .post(&chat_endpoint)
        .bearer_auth(openrouter_key)
        .header(CONTENT_TYPE, "application/json");
    let chat_response = crate::lib_impl::apply_openrouter_request_headers(chat_request)
        .json(&chat_payload)
        .send()
        .ok()?;
    if !chat_response.status().is_success() {
        return None;
    }
    let parsed: Value = chat_response.json().ok()?;
    let text = extract_openrouter_chat_output_text(&parsed);
    if text.trim().is_empty() {
        return None;
    }
    let (input_tokens, output_tokens) = extract_token_usage_pair(&parsed);
    Some((text, input_tokens, output_tokens, openrouter_model))
}

pub(crate) fn prepare_vision_image_data_url(path: &Path, max_dim: u32) -> Option<String> {
    let (bytes, mime) = prepare_vision_image(path, max_dim)?;
    let encoded = BASE64.encode(bytes);
    Some(format!("data:{mime};base64,{encoded}"))
}

pub(crate) fn prepare_vision_image(path: &Path, max_dim: u32) -> Option<(Vec<u8>, String)> {
    let dim = max_dim.max(128);
    if let Ok(image) = image::open(path) {
        let rgba = image.to_rgba8();
        let mut flattened = RgbaImage::new(rgba.width(), rgba.height());
        for (x, y, pixel) in rgba.enumerate_pixels() {
            let alpha = u16::from(pixel[3]);
            let blend = |channel: u8| -> u8 {
                (((u16::from(channel) * alpha) + (255 * (255 - alpha))) / 255) as u8
            };
            flattened.put_pixel(
                x,
                y,
                Rgba([blend(pixel[0]), blend(pixel[1]), blend(pixel[2]), 255]),
            );
        }
        let resized = DynamicImage::ImageRgba8(flattened)
            .resize(dim, dim, FilterType::Triangle)
            .to_rgb8();
        let mut bytes = Vec::new();
        let mut encoder = JpegEncoder::new_with_quality(&mut bytes, 90);
        if encoder
            .encode_image(&DynamicImage::ImageRgb8(resized))
            .is_ok()
        {
            return Some((bytes, "image/jpeg".to_string()));
        }
    }

    let bytes = std::fs::read(path).ok()?;
    let mime = guess_image_mime(path).to_string();
    Some((bytes, mime))
}

pub(crate) fn guess_image_mime(path: &Path) -> &'static str {
    let ext = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "heic" | "heif" => "image/heic",
        _ => "image/png",
    }
}

pub(crate) fn extract_openai_output_text(response: &Value) -> String {
    if let Some(text) = response.get("output_text").and_then(Value::as_str) {
        if !text.trim().is_empty() {
            return text.trim().to_string();
        }
    }

    let mut parts: Vec<String> = Vec::new();
    let rows = response
        .get("output")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    for row in rows {
        let Some(obj) = row.as_object() else {
            continue;
        };
        if let Some(kind) = obj.get("type").and_then(Value::as_str) {
            if matches!(kind, "output_text" | "text") {
                if let Some(text) = obj.get("text").and_then(Value::as_str) {
                    if !text.trim().is_empty() {
                        parts.push(text.trim().to_string());
                    }
                }
                continue;
            }
            if kind != "message" {
                continue;
            }
        }
        let content = obj
            .get("content")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        for chunk in content {
            let Some(chunk_obj) = chunk.as_object() else {
                continue;
            };
            let kind = chunk_obj
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or_default();
            if !matches!(kind, "output_text" | "text") {
                continue;
            }
            if let Some(text) = chunk_obj.get("text").and_then(Value::as_str) {
                if !text.trim().is_empty() {
                    parts.push(text.trim().to_string());
                }
            }
        }
    }

    parts.join("\n").trim().to_string()
}

pub(crate) fn openrouter_chat_content_to_responses_input(chat_content: &[Value]) -> Vec<Value> {
    let mut out: Vec<Value> = Vec::new();
    for item in chat_content {
        let Some(obj) = item.as_object() else {
            continue;
        };
        let kind = obj
            .get("type")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default()
            .to_ascii_lowercase();
        if kind == "text" {
            if let Some(text) = obj
                .get("text")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
            {
                out.push(json!({
                    "type": "input_text",
                    "text": text,
                }));
            }
            continue;
        }
        if kind == "image_url" {
            let image_url = obj
                .get("image_url")
                .and_then(|value| {
                    value
                        .as_object()
                        .and_then(|row| row.get("url"))
                        .and_then(Value::as_str)
                        .or_else(|| value.as_str())
                })
                .map(str::trim)
                .filter(|value| !value.is_empty());
            if let Some(url) = image_url {
                out.push(json!({
                    "type": "input_image",
                    "image_url": url,
                }));
            }
        }
    }
    out
}

pub(crate) fn openrouter_responses_content_to_chat_content(content: &[Value]) -> Vec<Value> {
    let mut out: Vec<Value> = Vec::new();
    for item in content {
        let Some(obj) = item.as_object() else {
            continue;
        };
        let kind = obj
            .get("type")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default()
            .to_ascii_lowercase();
        if kind == "input_text" {
            if let Some(text) = obj
                .get("text")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
            {
                out.push(json!({
                    "type": "text",
                    "text": text,
                }));
            }
            continue;
        }
        if kind == "input_image" {
            let image_url = obj
                .get("image_url")
                .and_then(Value::as_str)
                .or_else(|| {
                    obj.get("image_url")
                        .and_then(Value::as_object)
                        .and_then(|row| row.get("url"))
                        .and_then(Value::as_str)
                })
                .map(str::trim)
                .filter(|value| !value.is_empty());
            if let Some(url) = image_url {
                out.push(json!({
                    "type": "image_url",
                    "image_url": {
                        "url": url,
                    }
                }));
            }
        }
    }
    out
}

pub(crate) fn extract_openrouter_chat_output_text(response: &Value) -> String {
    let mut parts: Vec<String> = Vec::new();
    for choice in response
        .get("choices")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
    {
        let Some(message) = choice.get("message").and_then(Value::as_object) else {
            continue;
        };
        if let Some(content) = message.get("content") {
            match content {
                Value::String(text) => {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        parts.push(trimmed.to_string());
                    }
                }
                Value::Array(rows) => {
                    for row in rows {
                        let Some(obj) = row.as_object() else {
                            continue;
                        };
                        let kind = obj
                            .get("type")
                            .and_then(Value::as_str)
                            .map(str::trim)
                            .unwrap_or_default()
                            .to_ascii_lowercase();
                        if !matches!(kind.as_str(), "text" | "output_text") {
                            continue;
                        }
                        if let Some(text) = obj
                            .get("text")
                            .and_then(Value::as_str)
                            .map(str::trim)
                            .filter(|value| !value.is_empty())
                        {
                            parts.push(text.to_string());
                        }
                    }
                }
                _ => {}
            }
        }
        if let Some(refusal) = message
            .get("refusal")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            parts.push(refusal.to_string());
        }
    }
    let joined = parts.join("\n").trim().to_string();
    if !joined.is_empty() {
        joined
    } else {
        extract_openai_output_text(response)
    }
}

pub(crate) fn extract_openrouter_chat_finish_reason(response: &Value) -> Option<String> {
    response
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|rows| rows.first())
        .and_then(Value::as_object)
        .and_then(|row| row.get("finish_reason").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

pub(crate) fn should_fallback_openrouter_responses(status_code: u16, body: &str) -> bool {
    if matches!(status_code, 404 | 405 | 415 | 501) {
        return true;
    }
    if matches!(status_code, 400 | 422) {
        return body_indicates_openrouter_responses_unavailable(body);
    }
    false
}

fn body_indicates_openrouter_responses_unavailable(body: &str) -> bool {
    let lowered = body.to_ascii_lowercase();
    if !lowered.contains("response") {
        return false;
    }
    lowered.contains("unsupported")
        || lowered.contains("not supported")
        || lowered.contains("not found")
        || lowered.contains("unknown")
        || lowered.contains("unavailable")
        || lowered.contains("does not exist")
}

fn value_to_nonnegative_i64(value: &Value) -> Option<i64> {
    match value {
        Value::Number(number) => {
            if let Some(raw) = number.as_i64() {
                return (raw >= 0).then_some(raw);
            }
            if let Some(raw) = number.as_u64() {
                return i64::try_from(raw).ok();
            }
            None
        }
        Value::String(text) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                return None;
            }
            trimmed.parse::<i64>().ok().filter(|value| *value >= 0)
        }
        _ => None,
    }
}

fn read_usage_value(object: &Map<String, Value>, keys: &[&str]) -> Option<i64> {
    for key in keys {
        if let Some(value) = object.get(*key) {
            if let Some(parsed) = value_to_nonnegative_i64(value) {
                return Some(parsed);
            }
        }
    }
    None
}

pub(crate) fn extract_token_usage_pair(payload: &Value) -> (Option<i64>, Option<i64>) {
    fn walk(
        value: &Value,
        input_tokens: &mut Option<i64>,
        output_tokens: &mut Option<i64>,
        depth: usize,
    ) {
        if depth > 16 || (input_tokens.is_some() && output_tokens.is_some()) {
            return;
        }
        match value {
            Value::Object(object) => {
                let maybe_input = read_usage_value(
                    object,
                    &[
                        "input_tokens",
                        "prompt_tokens",
                        "prompt_token_count",
                        "promptTokenCount",
                        "tokens_in",
                        "tokensIn",
                        "inputTokenCount",
                        "input_text_tokens",
                        "text_count_tokens",
                    ],
                );
                if input_tokens.is_none() && maybe_input.is_some() {
                    *input_tokens = maybe_input;
                }
                let maybe_output = read_usage_value(
                    object,
                    &[
                        "output_tokens",
                        "completion_tokens",
                        "completion_token_count",
                        "completionTokenCount",
                        "tokens_out",
                        "tokensOut",
                        "outputTokenCount",
                        "output_text_tokens",
                        "candidates_token_count",
                        "candidatesTokenCount",
                    ],
                );
                if output_tokens.is_none() && maybe_output.is_some() {
                    *output_tokens = maybe_output;
                }

                if output_tokens.is_none() {
                    let total_tokens = read_usage_value(
                        object,
                        &[
                            "total_token_count",
                            "totalTokenCount",
                            "total_tokens",
                            "totalTokens",
                            "token_count",
                            "tokenCount",
                        ],
                    );
                    if let (Some(total), Some(input)) = (total_tokens, *input_tokens) {
                        if total >= input {
                            *output_tokens = Some(total - input);
                        }
                    }
                }

                for nested_key in ["usage", "usage_metadata"] {
                    if let Some(nested) = object.get(nested_key) {
                        walk(nested, input_tokens, output_tokens, depth + 1);
                    }
                }
                for nested in object.values() {
                    walk(nested, input_tokens, output_tokens, depth + 1);
                }
            }
            Value::Array(items) => {
                for item in items {
                    walk(item, input_tokens, output_tokens, depth + 1);
                }
            }
            _ => {}
        }
    }

    let mut input_tokens = None;
    let mut output_tokens = None;
    walk(payload, &mut input_tokens, &mut output_tokens, 0);
    (input_tokens, output_tokens)
}
