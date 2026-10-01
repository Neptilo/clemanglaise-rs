use once_cell::sync::Lazy;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

// Global HTTP client with persistent cookies across all commands
pub static HTTP_CLIENT: Lazy<Mutex<Client>> = Lazy::new(|| Mutex::new(build_http_client(true)));

// Global state for logged-in user tracking
pub static LOGGED_IN_USER: Mutex<Option<String>> = Mutex::new(None);

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub success: bool,
    pub message: String,
}

pub const SERVER_DOMAIN: &str = match option_env!("CLEMANGLAISE_SERVER_URL") {
    Some(url) => url,
    None if cfg!(debug_assertions) => "https://localhost",
    None => "https://neptilo.com",
};
const API_ROOT: &str = "/languages/clemanglaise/";
pub const PHP_API_ROOT: &str = "/php/clemanglaise/";

pub fn server_url(path: &str) -> String {
    format!("{}{}", SERVER_DOMAIN.trim_end_matches('/'), path)
}

pub fn api_url() -> String {
    server_url(API_ROOT)
}

pub fn build_http_client(cookie_store: bool) -> Client {
    Client::builder()
        .cookie_store(cookie_store)
        .build()
        .unwrap_or_else(|_| Client::new())
}

fn map_request_error(context: &str, error: reqwest::Error) -> String {
    format!("{}: {}", context, error)
}

/**
 * Initialize or get the global HTTP client with cookie jar.
 * The cookie jar persists across all requests and all commands.
 */
pub fn get_http_client() -> std::sync::MutexGuard<'static, Client> {
    HTTP_CLIENT.lock().expect("HTTP_CLIENT lock poisoned")
}

/**
 * Tauri command: Log in to the JSON auth API endpoint.
 * Maintains a persistent client that stores cookies for subsequent requests.
 */
#[tauri::command]
pub async fn auth_login(username: String, password: String) -> Result<AuthResponse, String> {
    let url = server_url("/php/login-api.php?action=login");

    // Build form data - PHP expects specific field names
    let params = [
        ("pseudo", username.as_str()),
        ("password", password.as_str()),
    ];

    // Get client and make request
    let response = {
        let client = get_http_client();
        client.post(url).form(&params).send()
    };

    let response = response
        .await
        .map_err(|e| map_request_error("Error sending request", e))?;

    // Parse JSON response
    match response.json::<AuthResponse>().await {
        Ok(auth_response) => {
            if auth_response.success {
                // Store logged-in user
                if let Ok(mut user) = LOGGED_IN_USER.lock() {
                    *user = Some(username.clone());
                }
            }
            Ok(auth_response)
        }
        Err(e) => Err(format!("Error parsing JSON response: {}", e)),
    }
}

/**
 * Tauri command: Register a new user against the JSON auth API endpoint.
 */
#[tauri::command]
pub async fn auth_register(
    username: String,
    password: String,
    password2: String,
    email: String,
    captcha_response: String,
) -> Result<AuthResponse, String> {
    let url = server_url("/php/login-api.php?action=register");

    let params = [
        ("pseudo", username.as_str()),
        ("password", password.as_str()),
        ("password2", password2.as_str()),
        ("email", email.as_str()),
        ("g-recaptcha-response", captcha_response.as_str()),
    ];

    let response = {
        let client = get_http_client();
        client.post(url).form(&params).send()
    };

    let response = response
        .await
        .map_err(|e| map_request_error("Error sending request", e))?;

    response
        .json::<AuthResponse>()
        .await
        .map_err(|e| format!("Error parsing JSON response: {}", e))
}

/**
 * Tauri command: Check current authentication status.
 */
#[tauri::command]
pub fn auth_status() -> Result<serde_json::Value, String> {
    let user = LOGGED_IN_USER.lock().ok().and_then(|u| u.clone());

    Ok(serde_json::json!({
        "isLoggedIn": user.is_some(),
        "username": user.unwrap_or_default(),
    }))
}

/**
 * Tauri command: Log out the current user.
 */
#[tauri::command]
pub async fn auth_logout() -> Result<AuthResponse, String> {
    let url = server_url("/php/login-api.php?action=logout");

    // Get client and make request
    let response = {
        let client = get_http_client();
        client.get(url).send()
    };

    let response = response
        .await
        .map_err(|e| map_request_error("Error sending request", e))?;

    // Parse JSON response
    match response.json::<AuthResponse>().await {
        Ok(auth_response) => {
            if auth_response.success {
                // Clear logged-in user
                if let Ok(mut user) = LOGGED_IN_USER.lock() {
                    *user = None;
                }
            }
            Ok(auth_response)
        }
        Err(e) => Err(format!("Error parsing JSON response: {}", e)),
    }
}

/**
 * Tauri command: Fetch a quiz question using the authenticated session.
 * Uses the same cookie jar as auth_login, so session is maintained.
 */
#[derive(Debug, Serialize, Deserialize)]
pub struct QuizTag {
    pub id: i32,
    pub name: String,
}

pub async fn fetch_quiz_tags(list_id: u32) -> Result<Vec<QuizTag>, String> {
    let url = format!("{}find_used_tags.php?list_id={}", server_url(PHP_API_ROOT), list_id);
    let response = {
        let client = get_http_client();
        client.get(&url).send()
    };
    let response = response.await.map_err(|e| map_request_error("Error fetching quiz tags", e))?;
    if !response.status().is_success() {
        return Err(format!("Error fetching quiz tags: server returned {}", response.status()));
    }
    let body = response.text().await.map_err(|e| format!("Error reading tag response: {}", e))?;
    let lines = body.lines().filter(|line| !line.is_empty()).collect::<Vec<_>>();
    if lines.len() % 2 != 0 || lines.iter().step_by(2).any(|id| id.trim().parse::<i32>().is_err()) {
        return Err(format!("Invalid tag response from server: {}", body));
    }
    Ok(lines.chunks_exact(2).map(|pair| QuizTag {
        id: pair[0].trim().parse().expect("validated tag ID"),
        name: pair[1].trim().to_string(),
    }).collect())
}

pub async fn fetch_quiz_question(list_id: u32, list_size_limit: u32) -> Result<String, String> {
    let url = format!(
        "{}find_word.php?list_id={}&list_size_limit={}",
        api_url(), list_id, list_size_limit
    );

    let response = {
        let client = get_http_client();
        client.get(&url).send()
    };

    let response = response
        .await
        .map_err(|e| map_request_error("Error fetching question", e))?;
    if !response.status().is_success() {
        return Err(format!("Error fetching question: server returned {}", response.status()));
    }

    response
        .text()
        .await
        .map_err(|e| format!("Error reading response: {}", e))
}

/**
 * Tauri command: Submit a quiz answer using the authenticated session.
 */
pub async fn submit_quiz_answer(correct: bool, word_id: u32) -> Result<String, String> {
    let url = format!("{}set_score.php", api_url());
    let body = format!(
        "correct={}&word_id={}",
        if correct { 1 } else { 0 },
        word_id
    );

    let response = {
        let client = get_http_client();
        client
            .post(url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
    };

    let response = response
        .await
        .map_err(|e| map_request_error("Error submitting answer", e))?;

    response
        .text()
        .await
        .map_err(|e| format!("Error reading response: {}", e))
}
