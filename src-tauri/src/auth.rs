use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use once_cell::sync::Lazy;

// Global HTTP client with persistent cookies across all commands
pub static HTTP_CLIENT: Lazy<Mutex<Client>> = Lazy::new(|| {
    Mutex::new(
        Client::builder()
            .cookie_store(true)
            .build()
            .unwrap_or_else(|_| Client::new())
    )
});

// Global state for logged-in user tracking
pub static LOGGED_IN_USER: Mutex<Option<String>> = Mutex::new(None);

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub success: bool,
    pub message: String,
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
    let url = "https://localhost/php/login-api.php?action=login";

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
    
    let response = response.await
        .map_err(|e| format!("Error sending request: {}", e))?;

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
 * Tauri command: Check current authentication status.
 */
#[tauri::command]
pub fn auth_status() -> Result<serde_json::Value, String> {
    let user = LOGGED_IN_USER.lock().ok()
        .and_then(|u| u.clone());
    
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
    let url = "https://localhost/php/login-api.php?action=logout";

    // Get client and make request
    let response = {
        let client = get_http_client();
        client.get(url).send()
    };
    
    let response = response.await
        .map_err(|e| format!("Error sending request: {}", e))?;

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
#[tauri::command]
pub async fn fetch_quiz_question(list_id: u32, list_size_limit: u32) -> Result<String, String> {
    let url = format!(
        "https://localhost/languages/clemanglaise/find_word.php?list_id={}&list_size_limit={}",
        list_id, list_size_limit
    );

    let response = {
        let client = get_http_client();
        client.get(&url).send()
    };
    
    let response = response.await
        .map_err(|e| format!("Error fetching question: {}", e))?;

    response.text().await
        .map_err(|e| format!("Error reading response: {}", e))
}

/**
 * Tauri command: Submit a quiz answer using the authenticated session.
 */
#[tauri::command]
pub async fn submit_quiz_answer(correct: bool, word_id: u32) -> Result<String, String> {
    let url = "https://localhost/languages/clemanglaise/set_score.php";
    let body = format!("correct={}&word_id={}", if correct { 1 } else { 0 }, word_id);

    let response = {
        let client = get_http_client();
        client.post(url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
    };
    
    let response = response.await
        .map_err(|e| format!("Error submitting answer: {}", e))?;

    response.text().await
        .map_err(|e| format!("Error reading response: {}", e))
}
