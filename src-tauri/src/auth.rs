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
 * Tauri command: Log in to the PHP auth endpoint.
 * Maintains a persistent client that stores cookies for subsequent requests.
 */
#[tauri::command]
pub async fn auth_login(username: String, password: String) -> Result<AuthResponse, String> {
    let url = "https://localhost/php/login.php?action=login";

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
    
    let response = response.await;

    match response {
        Ok(response) => {
            match response.text().await {
                Ok(body) => {                    
                    // Simple check: if response contains the username in a greeting, login succeeded
                    if body.contains(&format!("Hello <strong>{}</strong>", username)) {
                        // Store logged-in user
                        if let Ok(mut user) = LOGGED_IN_USER.lock() {
                            *user = Some(username.clone());
                        }
                        Ok(AuthResponse {
                            success: true,
                            message: format!("Logged in as {}", username),
                        })
                    } else {
                        // Always try to extract the actual error message from PHP response
                        let mut message = "Login failed".to_string();
                        
                        // Search for the login div (may have additional classes)
                        if let Some(start_pos) = body.find("<div id=\"login\"") {
                            // Find the end of the opening tag
                            if let Some(tag_close) = body[start_pos..].find('>') {
                                let content_start = start_pos + tag_close + 1;
                                
                                // Find the end of the first text block (before <br/> or </div>)
                                if let Some(br_pos) = body[content_start..].find("<br") {
                                    let text_block = &body[content_start..content_start + br_pos];
                                    
                                    // Remove all HTML tags to get plain text
                                    let mut plain_text = String::new();
                                    let mut in_tag = false;
                                    
                                    for ch in text_block.chars() {
                                        if ch == '<' {
                                            in_tag = true;
                                        } else if ch == '>' {
                                            in_tag = false;
                                        } else if !in_tag {
                                            plain_text.push(ch);
                                        }
                                    }
                                    
                                    let plain_text = plain_text.trim();
                                    if !plain_text.is_empty() {
                                        // Extract up to first period if present
                                        if let Some(period_pos) = plain_text.find('.') {
                                            message = plain_text[..period_pos + 1].to_string();
                                        } else {
                                            message = plain_text.to_string();
                                        }
                                    }
                                }
                            }
                        }
                        
                        Ok(AuthResponse {
                            success: false,
                            message,
                        })
                    }
                }
                Err(e) => Err(format!("Error reading response: {}", e)),
            }
        }
        Err(e) => Err(format!("Error sending request: {}", e)),
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
    let url = "https://localhost/php/login.php?action=logout";

    // Get client and make request
    let response = {
        let client = get_http_client();
        client.get(url).send()
    };
    
    let response = response.await;

    match response {
        Ok(_) => {
            // Clear logged-in user
            if let Ok(mut user) = LOGGED_IN_USER.lock() {
                *user = None;
            }
            Ok(AuthResponse {
                success: true,
                message: "Logged out".to_string(),
            })
        }
        Err(e) => Err(format!("Error sending request: {}", e)),
    }
}
