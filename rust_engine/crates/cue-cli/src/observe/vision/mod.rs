mod client;
mod prompts;
mod types;

use std::path::Path;
use std::time::Duration;

use serde_json::{json, Map, Value};

#[allow(unused_imports)]
pub(crate) use client::{
    extract_openai_output_text, extract_openrouter_chat_finish_reason,
    extract_openrouter_chat_output_text, extract_token_usage_pair, guess_image_mime,
    openai_vision_request, openrouter_chat_content_to_responses_input,
    openrouter_responses_content_to_chat_content, prepare_vision_image,
    prepare_vision_image_data_url, sanitize_openai_responses_model,
    should_fallback_openrouter_responses,
};
#[allow(unused_imports)]
pub(crate) use prompts::{
    description_realtime_instruction, intent_icons_instruction,
    vision_description_model_candidates_for, vision_description_realtime_model,
    OPENAI_VISION_FALLBACK_MODEL, REALTIME_DESCRIPTION_MAX_CHARS,
};
pub(crate) use types::{
    DescriptionVisionInference, DnaVisionInference, SoulVisionInference, TextVisionInference,
    TripletOddOneOutVisionInference, TripletRuleVisionInference,
};

fn infer_with_models<T, F>(
    models: &[String],
    content: Vec<Value>,
    max_output_tokens: u64,
    timeout: Duration,
    mut parse: F,
) -> Option<T>
where
    F: FnMut(String, Option<i64>, Option<i64>, String) -> Option<T>,
{
    for model in models {
        let Some((text, input_tokens, output_tokens, model_name)) =
            openai_vision_request(model, content.clone(), max_output_tokens, timeout)
        else {
            continue;
        };
        if let Some(result) = parse(text, input_tokens, output_tokens, model_name) {
            return Some(result);
        }
    }
    None
}

fn infer_text_task(
    models: Vec<String>,
    content: Vec<Value>,
    max_output_tokens: u64,
    timeout: Duration,
    max_chars: Option<usize>,
) -> Option<TextVisionInference> {
    infer_with_models(
        &models,
        content,
        max_output_tokens,
        timeout,
        |text, input_tokens, output_tokens, model_name| {
            let cleaned = clean_text_inference(&text, max_chars);
            if cleaned.is_empty() {
                return None;
            }
            Some(TextVisionInference {
                text: cleaned,
                source: "openai_vision".to_string(),
                model: Some(model_name),
                input_tokens,
                output_tokens,
            })
        },
    )
}

fn infer_json_task<T, F>(
    models: Vec<String>,
    content: Vec<Value>,
    max_output_tokens: u64,
    timeout: Duration,
    mut parse: F,
) -> Option<T>
where
    F: FnMut(&Map<String, Value>, Option<i64>, Option<i64>, String) -> Option<T>,
{
    infer_with_models(
        &models,
        content,
        max_output_tokens,
        timeout,
        |text, input_tokens, output_tokens, model_name| {
            let payload = extract_json_object_from_text(&text)?;
            parse(&payload, input_tokens, output_tokens, model_name)
        },
    )
}

fn single_model_from_env(env_keys: &[&str]) -> Vec<String> {
    vec![crate::lib_impl::first_non_empty_env(env_keys)
        .unwrap_or_else(|| OPENAI_VISION_FALLBACK_MODEL.to_string())]
}

fn requested_or_env_models(requested_model: Option<String>, env_keys: &[&str]) -> Vec<String> {
    let model_raw = requested_model
        .filter(|value| !value.trim().is_empty())
        .or_else(|| crate::lib_impl::first_non_empty_env(env_keys))
        .unwrap_or_else(|| OPENAI_VISION_FALLBACK_MODEL.to_string());
    let requested = sanitize_openai_responses_model(&model_raw, OPENAI_VISION_FALLBACK_MODEL);
    let mut models = vec![requested.clone()];
    if requested != OPENAI_VISION_FALLBACK_MODEL {
        models.push(OPENAI_VISION_FALLBACK_MODEL.to_string());
    }
    models
}

fn single_image_content(
    path: &Path,
    instruction: impl Into<String>,
    max_dim: u32,
) -> Option<Vec<Value>> {
    let data_url = prepare_vision_image_data_url(path, max_dim)?;
    Some(vec![
        json!({"type": "input_text", "text": instruction.into()}),
        json!({"type": "input_image", "image_url": data_url}),
    ])
}

pub(crate) fn openai_json_object_inference(
    model_hint: Option<&str>,
    instruction: String,
    max_output_tokens: u64,
    timeout: Duration,
) -> Option<(Map<String, Value>, String)> {
    let requested = sanitize_openai_responses_model(
        model_hint.unwrap_or(OPENAI_VISION_FALLBACK_MODEL),
        OPENAI_VISION_FALLBACK_MODEL,
    );
    let mut models = vec![requested.clone()];
    if requested != OPENAI_VISION_FALLBACK_MODEL {
        models.push(OPENAI_VISION_FALLBACK_MODEL.to_string());
    }
    let content = vec![json!({
        "type": "input_text",
        "text": instruction,
    })];
    infer_json_task(
        models,
        content,
        max_output_tokens,
        timeout,
        |payload, _, _, model_name| Some((payload.clone(), model_name)),
    )
}

pub(crate) fn vision_infer_description(
    path: &Path,
    max_chars: usize,
) -> Option<DescriptionVisionInference> {
    if let Some(inference) = crate::lib_impl::vision_infer_description_realtime(path, max_chars) {
        return Some(inference);
    }

    let models = prompts::vision_description_model_candidates();
    let data_url = prepare_vision_image_data_url(path, 1024)?;
    let content = vec![
        json!({"type": "input_text", "text": prompts::description_instruction(max_chars)}),
        json!({"type": "input_image", "image_url": data_url}),
    ];
    infer_with_models(
        &models,
        content,
        120,
        Duration::from_secs_f64(22.0),
        |text, input_tokens, output_tokens, model_name| {
            let cleaned = clean_description(&text, max_chars);
            if cleaned.is_empty() {
                return None;
            }
            Some(DescriptionVisionInference {
                description: cleaned,
                source: "openai_vision".to_string(),
                model: Some(model_name),
                input_tokens,
                output_tokens,
            })
        },
    )
}

pub(crate) fn vision_infer_diagnosis(path: &Path) -> Option<TextVisionInference> {
    infer_text_task(
        single_model_from_env(&["CUE_DIAGNOSE_MODEL", "OPENAI_DIAGNOSE_MODEL"]),
        single_image_content(path, prompts::diagnose_instruction(), 1024)?,
        900,
        Duration::from_secs_f64(45.0),
        Some(8000),
    )
}

pub(crate) fn vision_infer_canvas_context(
    path: &Path,
    requested_model: Option<String>,
) -> Option<TextVisionInference> {
    infer_text_task(
        requested_or_env_models(
            requested_model,
            &["CUE_CANVAS_CONTEXT_MODEL", "OPENAI_CANVAS_CONTEXT_MODEL"],
        ),
        single_image_content(path, prompts::canvas_context_instruction(), 768)?,
        520,
        Duration::from_secs_f64(28.0),
        Some(12000),
    )
}

pub(crate) fn vision_infer_argument(path_a: &Path, path_b: &Path) -> Option<TextVisionInference> {
    infer_text_task(
        single_model_from_env(&["CUE_ARGUE_MODEL", "OPENAI_ARGUE_MODEL"]),
        build_labeled_image_content(
            &[("Image A:", path_a), ("Image B:", path_b)],
            prompts::argue_instruction(),
            1024,
        )?,
        1100,
        Duration::from_secs_f64(55.0),
        Some(10000),
    )
}

pub(crate) fn vision_infer_dna_signature(path: &Path) -> Option<DnaVisionInference> {
    infer_json_task(
        single_model_from_env(&["CUE_DNA_VISION_MODEL", "OPENAI_DNA_MODEL"]),
        single_image_content(path, prompts::dna_extract_instruction(), 1024)?,
        380,
        Duration::from_secs_f64(35.0),
        |payload, input_tokens, output_tokens, model_name| {
            let (palette, colors, materials, summary) = parse_dna_payload(payload)?;
            Some(DnaVisionInference {
                palette,
                colors,
                materials,
                summary,
                source: "openai_vision".to_string(),
                model: Some(model_name),
                input_tokens,
                output_tokens,
            })
        },
    )
}

pub(crate) fn vision_infer_soul_signature(path: &Path) -> Option<SoulVisionInference> {
    infer_json_task(
        single_model_from_env(&["CUE_SOUL_VISION_MODEL", "OPENAI_SOUL_MODEL"]),
        single_image_content(path, prompts::soul_extract_instruction(), 1024)?,
        240,
        Duration::from_secs_f64(35.0),
        |payload, input_tokens, output_tokens, model_name| {
            let (emotion, summary) = parse_soul_payload(payload)?;
            Some(SoulVisionInference {
                emotion,
                summary,
                source: "openai_vision".to_string(),
                model: Some(model_name),
                input_tokens,
                output_tokens,
            })
        },
    )
}

fn parse_triplet_rule_payload(
    payload: &Map<String, Value>,
) -> Option<(String, Vec<Value>, Vec<Value>, f64)> {
    let principle = payload
        .get("principle")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())?
        .to_string();
    let mut evidence: Vec<Value> = Vec::new();
    for row in payload
        .get("evidence")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
    {
        let Some(obj) = row.as_object() else {
            continue;
        };
        let image = obj
            .get("image")
            .and_then(Value::as_str)
            .map(|value| value.trim().to_ascii_uppercase())
            .filter(|value| matches!(value.as_str(), "A" | "B" | "C"));
        let note = obj
            .get("note")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if let (Some(image), Some(note)) = (image, note) {
            evidence.push(json!({
                "image": image,
                "note": note,
            }));
        }
    }
    let mut annotations: Vec<Value> = Vec::new();
    for row in payload
        .get("annotations")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
    {
        let Some(obj) = row.as_object() else {
            continue;
        };
        let image = obj
            .get("image")
            .and_then(Value::as_str)
            .map(|value| value.trim().to_ascii_uppercase())
            .filter(|value| matches!(value.as_str(), "A" | "B" | "C"));
        let x = obj.get("x").and_then(Value::as_f64);
        let y = obj.get("y").and_then(Value::as_f64);
        if let (Some(image), Some(x), Some(y)) = (image, x, y) {
            if !(0.0..=1.0).contains(&x) || !(0.0..=1.0).contains(&y) {
                continue;
            }
            let label = obj
                .get("label")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim()
                .to_string();
            annotations.push(json!({
                "image": image,
                "x": x,
                "y": y,
                "label": label,
            }));
        }
    }
    let confidence = payload
        .get("confidence")
        .and_then(Value::as_f64)
        .filter(|value| (0.0..=1.0).contains(value))
        .unwrap_or(0.72);
    Some((principle, evidence, annotations, confidence))
}

pub(crate) fn vision_infer_triplet_rule(
    path_a: &Path,
    path_b: &Path,
    path_c: &Path,
) -> Option<TripletRuleVisionInference> {
    infer_json_task(
        single_model_from_env(&[
            "CUE_EXTRACT_RULE_MODEL",
            "OPENAI_EXTRACT_RULE_MODEL",
            "CUE_DIAGNOSE_MODEL",
            "OPENAI_DIAGNOSE_MODEL",
        ]),
        build_labeled_image_content(
            &[
                ("Image A:", path_a),
                ("Image B:", path_b),
                ("Image C:", path_c),
            ],
            prompts::triplet_rule_instruction(),
            1024,
        )?,
        850,
        Duration::from_secs_f64(60.0),
        |payload, input_tokens, output_tokens, model_name| {
            let (principle, evidence, annotations, confidence) =
                parse_triplet_rule_payload(payload)?;
            Some(TripletRuleVisionInference {
                principle,
                evidence,
                annotations,
                confidence,
                source: "openai_vision".to_string(),
                model: Some(model_name),
                input_tokens,
                output_tokens,
            })
        },
    )
}

fn parse_triplet_odd_payload(
    payload: &Map<String, Value>,
) -> Option<(String, i64, String, String, f64)> {
    let odd_image = payload
        .get("odd_image")
        .and_then(Value::as_str)
        .map(|value| value.trim().to_ascii_uppercase())
        .filter(|value| matches!(value.as_str(), "A" | "B" | "C"))?;
    let odd_index = if odd_image == "A" {
        0
    } else if odd_image == "B" {
        1
    } else {
        2
    };
    let pattern = payload
        .get("pattern")
        .and_then(Value::as_str)
        .map(|value| clean_text_inference(value, Some(4000)))
        .unwrap_or_default();
    let explanation = payload
        .get("explanation")
        .and_then(Value::as_str)
        .map(|value| clean_text_inference(value, Some(4000)))
        .unwrap_or_default();
    if pattern.is_empty() && explanation.is_empty() {
        return None;
    }
    let confidence = payload
        .get("confidence")
        .and_then(Value::as_f64)
        .filter(|value| (0.0..=1.0).contains(value))
        .unwrap_or(0.72);
    Some((odd_image, odd_index, pattern, explanation, confidence))
}

pub(crate) fn vision_infer_triplet_odd_one_out(
    path_a: &Path,
    path_b: &Path,
    path_c: &Path,
) -> Option<TripletOddOneOutVisionInference> {
    infer_json_task(
        single_model_from_env(&[
            "CUE_ODD_ONE_OUT_MODEL",
            "OPENAI_ODD_ONE_OUT_MODEL",
            "CUE_ARGUE_MODEL",
            "OPENAI_ARGUE_MODEL",
        ]),
        build_labeled_image_content(
            &[
                ("Image A:", path_a),
                ("Image B:", path_b),
                ("Image C:", path_c),
            ],
            prompts::odd_one_out_instruction(),
            1024,
        )?,
        850,
        Duration::from_secs_f64(60.0),
        |payload, input_tokens, output_tokens, model_name| {
            let (odd_image, odd_index, pattern, explanation, confidence) =
                parse_triplet_odd_payload(payload)?;
            Some(TripletOddOneOutVisionInference {
                odd_image,
                odd_index,
                pattern,
                explanation,
                confidence,
                source: "openai_vision".to_string(),
                model: Some(model_name),
                input_tokens,
                output_tokens,
            })
        },
    )
}

fn clean_text_inference(text: &str, max_chars: Option<usize>) -> String {
    let mut cleaned = text.trim().to_string();
    if cleaned.is_empty() {
        return String::new();
    }
    if let Some(limit) = max_chars {
        if limit > 0 && cleaned.chars().count() > limit {
            cleaned = cleaned
                .chars()
                .take(limit)
                .collect::<String>()
                .trim()
                .to_string();
        }
    }
    cleaned
}

fn is_aux_verb_token(token: &str) -> bool {
    matches!(token, "is" | "are" | "was" | "were")
}

fn is_article_token(token: &str) -> bool {
    matches!(token, "a" | "an" | "the")
}

fn token_starts_uppercase(token: &str) -> bool {
    token
        .chars()
        .next()
        .map(|ch| ch.is_uppercase())
        .unwrap_or(false)
}

fn compact_caption_phrase(text: &str) -> String {
    let mut tokens: Vec<String> = text
        .split_whitespace()
        .map(|token| token.trim().to_string())
        .filter(|token| !token.is_empty())
        .collect();
    if tokens.is_empty() {
        return String::new();
    }

    while tokens
        .first()
        .map(|token| is_article_token(token.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
        && tokens.len() > 1
    {
        tokens.remove(0);
    }

    if tokens.len() >= 3 {
        let second = tokens[1].to_ascii_lowercase();
        if is_aux_verb_token(second.as_str()) {
            tokens.remove(1);
        } else if tokens.len() >= 4 {
            let third = tokens[2].to_ascii_lowercase();
            if is_aux_verb_token(third.as_str())
                && token_starts_uppercase(tokens[0].as_str())
                && token_starts_uppercase(tokens[1].as_str())
            {
                tokens.remove(2);
            }
        }
    }

    if tokens.len() >= 3 {
        let mut aux_idx: Option<usize> = None;
        for idx in 1..(tokens.len() - 1) {
            let current = tokens[idx].to_ascii_lowercase();
            if !is_aux_verb_token(current.as_str()) {
                continue;
            }
            let next = tokens[idx + 1].to_ascii_lowercase();
            if next.ends_with("ing")
                || matches!(
                    next.as_str(),
                    "holding"
                        | "dribbling"
                        | "wearing"
                        | "standing"
                        | "sitting"
                        | "running"
                        | "jumping"
                        | "walking"
                        | "looking"
                        | "smiling"
                )
            {
                aux_idx = Some(idx);
                break;
            }
        }
        if let Some(idx) = aux_idx {
            tokens.remove(idx);
        }
    }

    if tokens.len() > 2 {
        let last_idx = tokens.len().saturating_sub(1);
        tokens = tokens
            .into_iter()
            .enumerate()
            .filter_map(|(idx, token)| {
                let lower = token.to_ascii_lowercase();
                if idx > 0 && idx < last_idx && is_aux_verb_token(lower.as_str()) {
                    None
                } else if idx > 0 && is_article_token(lower.as_str()) {
                    None
                } else {
                    Some(token)
                }
            })
            .collect();
    }

    if let Some(last) = tokens.last() {
        let lower = last.to_ascii_lowercase();
        if matches!(lower.as_str(), "looks" | "look" | "appears" | "seems") {
            let _ = tokens.pop();
        }
    }

    tokens.join(" ").trim().to_string()
}

pub(crate) fn clean_description(text: &str, max_chars: usize) -> String {
    let mut cleaned = text.trim().to_string();
    if cleaned.is_empty() {
        return String::new();
    }

    let lower = cleaned.to_ascii_lowercase();
    for prefix in ["description:", "label:", "caption:"] {
        if lower.starts_with(prefix) {
            cleaned = cleaned[prefix.len()..].trim().to_string();
            break;
        }
    }

    cleaned = cleaned
        .trim_matches('"')
        .trim_matches('\'')
        .replace(['\r', '\n', '\t'], " ");
    cleaned = cleaned.split_whitespace().collect::<Vec<&str>>().join(" ");
    cleaned = cleaned
        .trim()
        .trim_matches(|ch: char| matches!(ch, '"' | '\''))
        .trim_end_matches(|ch: char| matches!(ch, '.' | ',' | ':' | ';'))
        .trim()
        .to_string();
    if cleaned.is_empty() {
        return String::new();
    }

    let lowered = cleaned.to_ascii_lowercase();
    for prefix in [
        "a photo of ",
        "photo of ",
        "an image of ",
        "image of ",
        "a picture of ",
        "picture of ",
    ] {
        if let Some(rest) = lowered.strip_prefix(prefix) {
            let split_at = cleaned.len().saturating_sub(rest.len());
            cleaned = cleaned[split_at..].trim().to_string();
            break;
        }
    }

    cleaned = compact_caption_phrase(&cleaned);
    if cleaned.is_empty() {
        return String::new();
    }

    cleaned = cleaned.split_whitespace().collect::<Vec<&str>>().join(" ");
    if cleaned.chars().count() > max_chars {
        cleaned = cleaned.chars().take(max_chars + 1).collect::<String>();
        if let Some((head, _)) = cleaned.rsplit_once(' ') {
            cleaned = head.trim().to_string();
        }
        if cleaned.chars().count() > max_chars {
            cleaned = cleaned.chars().take(max_chars).collect();
        }
    }
    cleaned.trim().to_string()
}

fn strip_code_fence(text: &str) -> String {
    let raw = text.trim();
    if !(raw.starts_with("```") && raw.ends_with("```")) {
        return raw.to_string();
    }
    let lines: Vec<&str> = raw.lines().collect();
    if lines.len() < 2 {
        return raw.to_string();
    }
    let mut body = lines[1..lines.len() - 1].join("\n").trim().to_string();
    if body.to_ascii_lowercase().starts_with("json") {
        body = body[4..].trim().to_string();
    }
    body
}

pub(crate) fn extract_json_object_from_text(text: &str) -> Option<Map<String, Value>> {
    let raw = strip_code_fence(text);
    if raw.trim().is_empty() {
        return None;
    }
    let mut candidates = vec![raw.clone()];
    if let (Some(start), Some(end)) = (raw.find('{'), raw.rfind('}')) {
        if end > start {
            candidates.push(raw[start..=end].to_string());
        }
    }
    for candidate in candidates {
        if let Ok(parsed) = serde_json::from_str::<Value>(&candidate) {
            if let Some(object) = parsed.as_object() {
                return Some(object.clone());
            }
        }
    }
    None
}

pub(crate) fn coerce_text_list(
    value: Option<&Value>,
    max_items: usize,
    max_chars: usize,
) -> Vec<String> {
    let Some(value) = value else {
        return Vec::new();
    };
    let mut raw_items: Vec<String> = Vec::new();
    match value {
        Value::Array(rows) => {
            for row in rows {
                if let Some(text) = row.as_str() {
                    raw_items.push(text.to_string());
                }
            }
        }
        Value::String(text) => {
            raw_items.extend(text.split(',').map(str::to_string));
        }
        _ => {}
    }

    let mut cleaned = Vec::new();
    let mut seen = Vec::new();
    for row in raw_items {
        let mut text = row.split_whitespace().collect::<Vec<&str>>().join(" ");
        text = text.trim().to_string();
        if text.is_empty() {
            continue;
        }
        if text.chars().count() > max_chars {
            text = text
                .chars()
                .take(max_chars)
                .collect::<String>()
                .trim()
                .to_string();
        }
        let key = text.to_ascii_lowercase();
        if seen.iter().any(|existing| existing == &key) {
            continue;
        }
        seen.push(key);
        cleaned.push(text);
        if cleaned.len() >= max_items {
            break;
        }
    }
    cleaned
}

fn normalize_hex_color(value: &str) -> Option<String> {
    let raw = value.trim();
    if !raw.starts_with('#') {
        return None;
    }
    let mut body = raw.trim_start_matches('#').to_string();
    if body.len() == 3 && body.chars().all(|ch| ch.is_ascii_hexdigit()) {
        body = body
            .chars()
            .flat_map(|ch| [ch, ch])
            .collect::<String>()
            .to_ascii_uppercase();
    }
    if body.len() != 6 || !body.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return None;
    }
    Some(format!("#{}", body.to_ascii_uppercase()))
}

fn parse_dna_payload(
    payload: &Map<String, Value>,
) -> Option<(Vec<String>, Vec<String>, Vec<String>, String)> {
    let palette_raw = coerce_text_list(payload.get("palette"), 8, 12);
    let mut palette = Vec::new();
    for row in palette_raw {
        if let Some(code) = normalize_hex_color(&row) {
            if !palette.contains(&code) {
                palette.push(code);
            }
        }
    }
    let colors = coerce_text_list(payload.get("colors"), 8, 42);
    let materials = coerce_text_list(payload.get("materials"), 8, 42);
    let summary = payload
        .get("summary")
        .and_then(Value::as_str)
        .map(|value| clean_text_inference(value, Some(180)))
        .unwrap_or_default();
    let summary = if summary.is_empty() {
        let color_part = if colors.is_empty() {
            "the extracted palette".to_string()
        } else {
            colors
                .iter()
                .take(3)
                .cloned()
                .collect::<Vec<String>>()
                .join(", ")
        };
        let material_part = if materials.is_empty() {
            "the extracted materials".to_string()
        } else {
            materials
                .iter()
                .take(3)
                .cloned()
                .collect::<Vec<String>>()
                .join(", ")
        };
        format!("Rebuild with {color_part} and {material_part}.")
    } else {
        summary
    };
    if palette.is_empty() && colors.is_empty() && materials.is_empty() {
        return None;
    }
    Some((palette, colors, materials, summary))
}

fn parse_soul_payload(payload: &Map<String, Value>) -> Option<(String, String)> {
    let raw_emotion = payload
        .get("emotion")
        .and_then(Value::as_str)
        .or_else(|| payload.get("primary_emotion").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())?
        .to_string();
    let emotion = clean_text_inference(&raw_emotion, Some(64));
    if emotion.is_empty() {
        return None;
    }
    let summary = payload
        .get("summary")
        .and_then(Value::as_str)
        .map(|value| clean_text_inference(value, Some(180)))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("Make the scene emotionally {emotion}."));
    Some((emotion, summary))
}

fn build_labeled_image_content(
    labels_and_paths: &[(&str, &Path)],
    instruction: &str,
    max_dim: u32,
) -> Option<Vec<Value>> {
    let mut content = Vec::new();
    for (label, path) in labels_and_paths {
        if !label.trim().is_empty() {
            content.push(json!({
                "type": "input_text",
                "text": *label,
            }));
        }
        let data_url = prepare_vision_image_data_url(path, max_dim)?;
        content.push(json!({
            "type": "input_image",
            "image_url": data_url,
        }));
    }
    content.push(json!({
        "type": "input_text",
        "text": instruction,
    }));
    Some(content)
}
