use std::collections::HashSet;

use crate::lib_impl::{canvas_context_realtime_provider, first_non_empty_env, RealtimeProvider};

pub(crate) const REALTIME_DESCRIPTION_MAX_CHARS: usize = 40;
pub(crate) const OPENAI_VISION_FALLBACK_MODEL: &str = "gpt-5.2";
pub(crate) const OPENAI_VISION_SECONDARY_MODEL: &str = "gpt-5-nano";
pub(crate) const OPENROUTER_OPENAI_VISION_FALLBACK_MODEL: &str = "openai/gpt-5.2";

pub(crate) fn description_realtime_instruction() -> &'static str {
    "Describe the image as one short caption fragment (<=40 chars), not a full sentence. Use noun-phrase style like 'Runner holding umbrella'. Do not use auxiliary verbs like is/are/was/were. Return only the caption."
}

pub(crate) fn description_instruction(max_chars: usize) -> String {
    format!(
        "Write one concise computer-vision caption fragment for the attached image (<= {max_chars} characters). Use noun-phrase style, not a full sentence. Avoid auxiliary verbs (is/are/was/were) and avoid leading articles when possible. If a person or character is confidently recognizable, use the proper name (example: 'Alex Rivera holding basketball'). Otherwise use a concrete visual subject plus one discriminator (action, garment, color, material, viewpoint, or composition cue). Do not infer sports team/franchise from jersey colors alone; only mention a team when text/logo is clearly readable. No hedging. No questions. No extra commentary. Output ONLY the caption."
    )
}

pub(crate) fn diagnose_instruction() -> &'static str {
    "Diagnose this image like an honest creative director.\nDo NOT describe the image. Diagnose what's working and what isn't, using specific visual evidence.\nWrite in plain, easy English. Short lines. Lots of whitespace. No jargon.\nThink like a tiny council first:\n1) Art director (taste, composition)\n2) Commercial lens (clarity, conversion)\nThen write ONE merged answer.\n\nIf it looks like a product photo meant to sell something, judge it as a product shot (lighting, background, crop, color accuracy, reflections/shadows, edge cutout quality, legibility).\nOtherwise, judge it by the most likely use case (ad, poster, UI, editorial, etc).\n\nFormat (keep under ~180 words):\nUSE CASE (guess): <product shot | ad | poster | UI | editorial | other>\n\nTOP ISSUE:\n<one sentence>\n\nWHAT'S WORKING:\n- <2-4 bullets>\n\nWHAT TO FIX NEXT:\n- <3-5 bullets>\n\nNEXT TEST:\n- <2 bullets>\n\nRules: keep bullets to one line each. Be concrete about composition/hierarchy, focal point, color, lighting, depth, typography/legibility (if present), and realism/materials. No generic praise."
}

pub(crate) fn canvas_context_instruction() -> &'static str {
    crate::lib_impl::canvas_context_realtime_instruction()
}

pub(crate) fn argue_instruction() -> &'static str {
    "Argue between two creative directions based on Image A and Image B.\nYou are not neutral: make the strongest case for each, using specific visual evidence.\nWrite in plain, easy English. Short lines. Lots of whitespace. No jargon.\nIf these are product shots, judge them as product shots; otherwise use the most likely use case.\n\nFormat (keep under ~220 words):\nIMAGE A WINS IF:\n- <3-5 bullets>\n\nIMAGE B WINS IF:\n- <3-5 bullets>\n\nMY PICK:\n<A or B> — <one sentence>\n\nWHY:\n<2-3 short sentences>\n\nNEXT TEST:\n- <2 bullets>\n"
}

pub(crate) fn dna_extract_instruction() -> &'static str {
    "Extract this image's visual DNA for transfer.\nFocus only on COLORS and MATERIALS that are visually dominant.\nRespond with JSON only (no markdown):\n{\n  \"palette\": [\"#RRGGBB\", \"...\"],\n  \"colors\": [\"short color phrases\"],\n  \"materials\": [\"short material phrases\"],\n  \"summary\": \"one short sentence for edit transfer\"\n}\nRules: 3-8 palette entries. 2-8 colors. 2-8 materials. Summary must be <= 16 words and directly usable in an edit instruction."
}

pub(crate) fn soul_extract_instruction() -> &'static str {
    "Extract this image's dominant emotional soul.\nRespond with JSON only (no markdown):\n{\n  \"emotion\": \"single dominant emotion phrase\",\n  \"summary\": \"one short sentence for edit transfer\"\n}\nRules: emotion should be concise and concrete (e.g., serene tension, triumphant warmth). Summary must be <= 14 words and directly usable in an edit instruction."
}

pub(crate) fn triplet_rule_instruction() -> &'static str {
    "You are an elite creative director. You will be shown three images: Image A, Image B, Image C.\nYour job: identify the ONE consistent design rule the user is applying across all three.\n\nReturn JSON ONLY with this schema:\n{\n  \"principle\": \"<one sentence rule>\",\n  \"evidence\": [\n    {\"image\": \"A\", \"note\": \"<short concrete visual evidence>\"},\n    {\"image\": \"B\", \"note\": \"<short concrete visual evidence>\"},\n    {\"image\": \"C\", \"note\": \"<short concrete visual evidence>\"}\n  ],\n  \"annotations\": [\n    {\"image\": \"A\", \"x\": 0.0, \"y\": 0.0, \"label\": \"<what to look at>\"},\n    {\"image\": \"B\", \"x\": 0.0, \"y\": 0.0, \"label\": \"<what to look at>\"},\n    {\"image\": \"C\", \"x\": 0.0, \"y\": 0.0, \"label\": \"<what to look at>\"}\n  ],\n  \"confidence\": 0.0\n}\n\nRules:\n- x and y are fractions in [0,1] relative to the image (0,0 top-left).\n- Keep annotations to 0-6 total points; omit the field or use [] if unsure.\n- No markdown, no prose outside JSON, no trailing commas."
}

pub(crate) fn odd_one_out_instruction() -> &'static str {
    "You are curating a mood board. You will be shown three images: Image A, Image B, Image C.\nTwo images share a pattern. One breaks it.\n\nReturn JSON ONLY with this schema:\n{\n  \"odd_image\": \"A\",\n  \"pattern\": \"<one short paragraph describing what A/B share>\",\n  \"explanation\": \"<why the odd one breaks it, concrete visual reasons>\",\n  \"confidence\": 0.0\n}\n\nRules:\n- odd_image MUST be exactly \"A\", \"B\", or \"C\".\n- No markdown, no prose outside JSON, no trailing commas."
}

pub(crate) fn intent_icons_instruction(mother: bool) -> String {
    let base = r#"You are a realtime Canvas-to-Intent Icon Engine.

ROLE
Observe a live visual canvas where users place images.
Your job is NOT to explain intent, guess motivation, or ask questions.
Your job is to surface the user's intent as a set of clear, human-legible ICONS for image generation.

HARD CONSTRAINTS
- Output JSON only. No prose. No user-facing text.
- The JSON must be syntactically valid (single top-level object).
- Communicate intent exclusively through icons, spatial grouping, highlights, and branching lanes.
- Never infer or expose "why".
- If uncertain, present multiple icon paths rather than choosing one.

INPUT SIGNALS
You receive:
- A CANVAS SNAPSHOT image (may contain multiple user images placed spatially).
- An optional CONTEXT_ENVELOPE_JSON (input text) that is authoritative for:
  - canvas size
  - per-image positions/sizes/order
  - per-image vision_desc labels (optional): short, noisy phrases derived from the images (not user text)
  - intent round index and remaining time (timer_enabled/rounds_enabled may be false)
  - prior user selections (YES/NO/MAYBE) by branch
- Optional SOURCE_IMAGE_REFERENCE inputs (high-res) for one or more canvas images.

INTERPRETATION RULES
- Treat images as signals of intent, not meaning.
- If vision_desc labels are present in CONTEXT_ENVELOPE_JSON.images[], treat them as weak hints only.
- If SOURCE_IMAGE_REFERENCE inputs are present, prioritize them for identity/detail disambiguation.
- Placement implies structure:
  - Left-to-right = flow
  - Top-to-bottom = hierarchy
  - Clusters = coupling
  - Isolation = emphasis
  - Relative size = emphasis/importance

OUTPUT GOAL
Continuously emit a minimal, evolving set of INTENT ICONS that describe:
1) WHAT kind of system/action the user is assembling
2) HOW they are choosing to act on that system

ICON TAXONOMY (STRICT)
Use only these icon_id values:

Core
- IMAGE_GENERATION
- OUTPUTS
- ITERATION
- PIPELINE

Use Cases (branch lanes)
- GAME_DEV_ASSETS
- STREAMING_CONTENT
- UI_UX_PROTOTYPING
- ECOMMERCE_POD
- CONTENT_ENGINE

Asset Types
- CONCEPT_ART
- SPRITES
- TEXTURES
- CHARACTER_SHEETS
- THUMBNAILS
- OVERLAYS
- EMOTES
- SOCIAL_GRAPHICS
- SCREENS
- WIREFRAMES
- MOCKUPS
- USER_FLOWS
- MERCH_DESIGN
- PRODUCT_PHOTOS
- MARKETPLACE_LISTINGS
- BRAND_SYSTEM
- MULTI_CHANNEL

Signatures
- MIXED_FIDELITY
- VOLUME
- OUTCOMES
- STRUCTURED
- SINGULAR
- PHYSICAL_OUTPUT
- PROCESS
- AUTOMATION

Relations
- FLOW
- GROUP
- ALTERNATIVE
- DEPENDS_ON
- FEEDS

Control Tokens
- YES_TOKEN
- NO_TOKEN
- MAYBE_TOKEN

TRANSFORMATION MODE ENUM (STRICT)
Valid transformation_mode values:
- amplify
- transcend
- destabilize
- purify
- hybridize
- mythologize
- monumentalize
- fracture
- romanticize
- alienate

RETURN SCHEMA (STRICT)
{
  "schema": "cue.intent_icons",
  "schema_version": 1,
  "frame_id": "<string>",
  "transformation_mode": "<one mode from enum>",
  "transformation_mode_candidates": [
    {
      "mode": "<one mode from enum>",
      "awe_joy_score": 0.0,
      "confidence": 0.0
    }
  ],
  "image_descriptions": [
    {
      "image_id": "<from CONTEXT_ENVELOPE_JSON.images[].id>",
      "label": "<CV caption fragment, <=40 chars, concrete and specific>",
      "confidence": 0.0
    }
  ],
  "intent_icons": [
    {
      "icon_id": "<from taxonomy>",
      "confidence": 0.0,
      "position_hint": "primary"
    }
  ],
  "relations": [
    {
      "from_icon": "<icon_id>",
      "to_icon": "<icon_id>",
      "relation_type": "FLOW"
    }
  ],
  "branches": [
    {
      "branch_id": "<id>",
      "confidence": 0.0,
      "icons": ["GAME_DEV_ASSETS", "SPRITES", "ITERATION"],
      "lane_position": "left",
      "evidence_image_ids": ["<image_id>"]
    }
  ],
  "checkpoint": {
    "icons": ["YES_TOKEN", "NO_TOKEN", "MAYBE_TOKEN"],
    "applies_to": "<branch_id or icon cluster>"
  }
}

BEHAVIOR RULES
- Always maintain one primary intent cluster and 1-3 alternative clusters.
- Always try to fill image_descriptions for each image in CONTEXT_ENVELOPE_JSON.images[].
- Emit exactly one image_descriptions row per CONTEXT_ENVELOPE_JSON.images[].id when available.
- Preserve CONTEXT_ENVELOPE_JSON.images[] id order in image_descriptions.
- Never swap labels across image_id values.
- transformation_mode must be one of the 10 enum values above.
- transformation_mode_candidates should include the primary mode.
- In Mother mode, transformation_mode_candidates must include all 10 enum modes exactly once.
- transformation_mode_candidates[].awe_joy_score must be in [0.0, 100.0] and represent predicted intensity of "stunningly awe-inspiring and tearfully joyous".
- transformation_mode_candidates[].confidence must be in [0.0, 1.0] and represent certainty in that awe_joy_score.
- Sort transformation_mode_candidates by awe_joy_score DESC (tie-break confidence DESC).
- Include branches[].confidence in [0.0, 1.0] and sort branches by confidence DESC.
- checkpoint.applies_to should match the highest-confidence branch_id.
- evidence_image_ids should reference CONTEXT_ENVELOPE_JSON.images[].id (0-3 ids).
- image_descriptions labels must use neutral computer-vision caption style.
- Keep labels short and concrete. `A photo of ...` is acceptable but not required.
- If a person or character is confidently recognizable, use the proper name (for example: "Alex Rivera holding a basketball").
- Prefer identifiable names over generic role nouns; avoid labels like "basketball player holding ball" when a confident identity is available.
- Do not infer team/franchise identity from jersey color alone; only mention a team when text/logo evidence is clearly visible.
- If not identifiable by name, use a concrete visual subject + one discriminator (action, garment, color, material, viewpoint, or composition cue).
- Avoid generic placeholders like "portrait photo", "object image", "person picture".
- Do not hedge ("appears to", "looks like"), ask questions, or add commentary.
- Keep labels concise and distinctive; omit minor details if needed to stay within the char budget.
- Do not copy visible text; avoid brand names.
- Do not collapse ambiguity too early.
- Start broad with use-case lanes; add Asset Types and Signatures as evidence accumulates.
- Increase specificity only after YES_TOKEN is applied.
- After NO_TOKEN, deprioritize that branch and propose another alternative.
- The icons must be understandable without explanation, language, or onboarding.

SAFETY
- Do not emit intent icons for illegal or deceptive systems.
- Do not produce impersonation or identity abuse flows.
- Keep all intent representations general-purpose and constructive.

Return JSON only."#;
    if mother {
        return format!(
            "You are ranking image proposals for Cue.\nPrimary target: outputs most likely to feel \"stunningly awe-inspiring and tearfully joyous.\"\nMaximize visual wow and emotional impact.\n\nRULES\n- CONTEXT_ENVELOPE_JSON.mother_context is authoritative when present.\n- Treat mother_context.creative_directive and mother_context.optimization_target as hard steering.\n- branches[].confidence must estimate likelihood that a generated image will feel \"stunningly awe-inspiring and tearfully joyous.\"\n- transformation_mode_candidates must include all 10 transformation enum modes exactly once.\n- transformation_mode_candidates[].awe_joy_score (0-100) must estimate intensity of \"stunningly awe-inspiring and tearfully joyous.\"\n- transformation_mode_candidates[].confidence (0-1) must estimate certainty in that awe_joy_score.\n- Sort branches by confidence DESC.\n- Sort transformation_mode_candidates by awe_joy_score DESC (tie-break confidence DESC).\n- Prefer transformation modes that are novel relative to mother_context.recent_rejected_modes_for_context.\n- Avoid repeating mother_context.last_accepted_mode unless confidence improvement is substantial.\n- Use mother_context.selected_ids and mother_context.active_id to prioritize evidence_image_ids.\n- Use mother_context.preferred_shot_type, mother_context.preferred_lighting_profile, and mother_context.preferred_lens_guidance as ranking cues for image-impacting proposal quality.\n- When mother_context.shot_type_hints or candidate shot/lighting/lens fields are present, use them to validate and adjust ranking strength per mode.\n- Use images[].origin to balance uploaded references with mother-generated continuity.\n- For 2+ images, prefer bold fusion over collage and allow stylized camera/lighting choices when impact improves.\n- Keep anti-artifact behavior conservative: avoid ghosting, duplication, and interface residue.\n\nReturn the same strict JSON schema contract as the default intent engine.\n\n{}",
            base
        );
    }
    base.to_string()
}

pub(crate) fn vision_description_realtime_model() -> String {
    let value = first_non_empty_env(&[
        "CUE_DESCRIBE_REALTIME_MODEL",
        "OPENAI_DESCRIBE_REALTIME_MODEL",
    ])
    .unwrap_or_else(|| "gpt-realtime-mini".to_string());
    crate::realtime::normalize_realtime_model_name(&value, "gpt-realtime-mini")
}

pub(crate) fn vision_description_model_candidates_for(
    provider: RealtimeProvider,
    explicit_model: Option<&str>,
) -> Vec<String> {
    let explicit = explicit_model
        .map(str::trim)
        .map(str::to_string)
        .filter(|value| !value.is_empty());
    let mut models: Vec<String> = Vec::new();
    if let Some(requested) = explicit {
        models.push(requested.clone());
        if requested != OPENAI_VISION_SECONDARY_MODEL {
            models.push(OPENAI_VISION_SECONDARY_MODEL.to_string());
        }
    } else if provider == RealtimeProvider::GeminiFlash {
        models.push("gemini-3.0-flash".to_string());
        models.push("gemini-3-flash-preview".to_string());
        models.push("google/gemini-3-flash-preview".to_string());
    } else {
        models.push(OPENAI_VISION_FALLBACK_MODEL.to_string());
        models.push(OPENAI_VISION_SECONDARY_MODEL.to_string());
    }

    fn model_dedupe_key(provider: RealtimeProvider, model: &str) -> String {
        if provider == RealtimeProvider::GeminiFlash {
            crate::lib_impl::sanitize_openrouter_model(
                model,
                OPENROUTER_OPENAI_VISION_FALLBACK_MODEL,
            )
            .trim()
            .to_ascii_lowercase()
        } else {
            crate::observe::vision::client::sanitize_openai_responses_model(
                model,
                OPENAI_VISION_FALLBACK_MODEL,
            )
            .trim()
            .to_ascii_lowercase()
        }
    }

    let mut deduped = Vec::new();
    let mut seen = HashSet::new();
    for model in models {
        let normalized = model_dedupe_key(provider, &model);
        if normalized.is_empty() || !seen.insert(normalized) {
            continue;
        }
        deduped.push(model);
    }
    deduped
}

pub(crate) fn vision_description_model_candidates() -> Vec<String> {
    let explicit = first_non_empty_env(&["CUE_DESCRIBE_MODEL", "OPENAI_DESCRIBE_MODEL"]);
    vision_description_model_candidates_for(canvas_context_realtime_provider(), explicit.as_deref())
}
