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
