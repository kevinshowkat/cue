use anyhow::{Context, Result};
use reqwest::Url;
use tungstenite::client::IntoClientRequest;
use tungstenite::http::{HeaderValue, Request};

pub const REALTIME_BETA_HEADER_VALUE: &str = "realtime=v1";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OpenAiRealtimeWebSocketRequest {
    pub api_base: String,
    pub model: String,
    pub api_key: String,
}

impl OpenAiRealtimeWebSocketRequest {
    pub fn new(
        api_base: impl Into<String>,
        model: impl Into<String>,
        api_key: impl Into<String>,
    ) -> Self {
        Self {
            api_base: api_base.into(),
            model: model.into(),
            api_key: api_key.into(),
        }
    }

    pub fn ws_url(&self) -> String {
        openai_realtime_ws_url(&self.api_base, &self.model)
    }

    pub fn build(&self) -> Result<Request<()>> {
        build_realtime_websocket_request(&self.api_base, &self.model, &self.api_key)
    }
}

pub fn build_realtime_websocket_request(
    api_base: &str,
    model: &str,
    api_key: &str,
) -> Result<Request<()>> {
    let ws_url = openai_realtime_ws_url(api_base, model);
    let auth_header = format!("Bearer {api_key}");
    let mut request = ws_url
        .as_str()
        .into_client_request()
        .context("invalid realtime websocket request")?;
    request.headers_mut().insert(
        "Authorization",
        HeaderValue::from_str(&auth_header).context("invalid realtime auth header")?,
    );
    request.headers_mut().insert(
        "OpenAI-Beta",
        HeaderValue::from_static(REALTIME_BETA_HEADER_VALUE),
    );
    Ok(request)
}

pub fn openai_realtime_ws_url(api_base: &str, model: &str) -> String {
    if let Ok(mut url) = Url::parse(api_base) {
        let scheme = if url.scheme() == "https" {
            "wss".to_string()
        } else if url.scheme() == "http" {
            "ws".to_string()
        } else {
            url.scheme().to_string()
        };
        let _ = url.set_scheme(&scheme);
        let mut path = url.path().trim_end_matches('/').to_string();
        if path.is_empty() {
            path = "/v1".to_string();
        }
        url.set_path(&format!("{path}/realtime"));
        url.query_pairs_mut()
            .clear()
            .append_pair("model", model.trim());
        return url.to_string();
    }
    format!("wss://api.openai.com/v1/realtime?model={}", model.trim())
}
