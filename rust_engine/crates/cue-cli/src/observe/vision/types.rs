use serde_json::Value;

#[derive(Debug, Clone)]
pub(crate) struct TextVisionInference {
    pub(crate) text: String,
    pub(crate) source: String,
    pub(crate) model: Option<String>,
    pub(crate) input_tokens: Option<i64>,
    pub(crate) output_tokens: Option<i64>,
}

#[derive(Debug, Clone)]
pub(crate) struct DescriptionVisionInference {
    pub(crate) description: String,
    pub(crate) source: String,
    pub(crate) model: Option<String>,
    pub(crate) input_tokens: Option<i64>,
    pub(crate) output_tokens: Option<i64>,
}

#[derive(Debug, Clone)]
pub(crate) struct DnaVisionInference {
    pub(crate) palette: Vec<String>,
    pub(crate) colors: Vec<String>,
    pub(crate) materials: Vec<String>,
    pub(crate) summary: String,
    pub(crate) source: String,
    pub(crate) model: Option<String>,
    pub(crate) input_tokens: Option<i64>,
    pub(crate) output_tokens: Option<i64>,
}

#[derive(Debug, Clone)]
pub(crate) struct SoulVisionInference {
    pub(crate) emotion: String,
    pub(crate) summary: String,
    pub(crate) source: String,
    pub(crate) model: Option<String>,
    pub(crate) input_tokens: Option<i64>,
    pub(crate) output_tokens: Option<i64>,
}

#[derive(Debug, Clone)]
pub(crate) struct TripletRuleVisionInference {
    pub(crate) principle: String,
    pub(crate) evidence: Vec<Value>,
    pub(crate) annotations: Vec<Value>,
    pub(crate) confidence: f64,
    pub(crate) source: String,
    pub(crate) model: Option<String>,
    pub(crate) input_tokens: Option<i64>,
    pub(crate) output_tokens: Option<i64>,
}

#[derive(Debug, Clone)]
pub(crate) struct TripletOddOneOutVisionInference {
    pub(crate) odd_image: String,
    pub(crate) odd_index: i64,
    pub(crate) pattern: String,
    pub(crate) explanation: String,
    pub(crate) confidence: f64,
    pub(crate) source: String,
    pub(crate) model: Option<String>,
    pub(crate) input_tokens: Option<i64>,
    pub(crate) output_tokens: Option<i64>,
}
