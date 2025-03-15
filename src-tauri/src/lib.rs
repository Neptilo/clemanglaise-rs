use serde::{Deserialize, Serialize}; 

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Test {
    id: i32,
    name: String,
    src: String,
    dst: String,
    flag: String,
}

#[tauri::command]
async fn fetch_vocab_tests() -> Result<Vec<Test>, String> {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;
    
    let url = "https://localhost/php/clemanglaise/get_lists.php";

    let response = client.get(url).send().await.map_err(|e| e.to_string())?;
    let body = response.text().await.map_err(|e| e.to_string())?;

    let lines: Vec<&str> = body.trim().split('\n').collect();
    let mut tests = Vec::new();

    for chunk in lines.chunks(5) {
        if chunk.len() == 5 {
            let test = Test {
                id: chunk[0].parse().unwrap_or(0),
                name: chunk[1].to_string(),
                src: chunk[2].to_string(),
                dst: chunk[3].to_string(),
                flag: chunk[4].to_string(),
            };
            tests.push(test);
        }
    }

    Ok(tests)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![fetch_vocab_tests])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}