use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use reqwest::Client;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Test {
    id: i32,
    name: String,
    src: String,
    dst: String,
    flag: String,
}

#[tauri::command]
async fn fetch_vocab_tests(remote: bool) -> Result<Vec<Test>, String> {
    if remote {
        // Fetch vocab lists from the remote server
        let client = Client::new();
        let url = "https://localhost/php/clemanglaise/get_lists.php";

        match client.get(url).send().await {
            Ok(response) => match response.text().await {
                Ok(body) => {
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
                Err(e) => Err(format!("Error reading server response: {}", e)),
            },
            Err(e) => Err(format!("Error sending request: {}", e)),
        }
    } else {
        // Fetch vocab lists from the local SQLite database
        match fetch_vocab_tests_from_db() {
            Ok(tests) => Ok(tests),
            Err(e) => Err(format!("Error accessing local database: {}", e)),
        }
    }
}

// Helper function to fetch vocab tests from the local database (SQLite)
fn fetch_vocab_tests_from_db() -> SqlResult<Vec<Test>> {
    let conn = Connection::open("clemanglaise.db")?;

    let mut stmt = conn.prepare("SELECT id, name, src, dst, flag FROM clemanglaise_lists")?;
    let test_iter = stmt.query_map(params![], |row| {
        Ok(Test {
            id: row.get(0)?,
            name: row.get(1)?,
            src: row.get(2)?,
            dst: row.get(3)?,
            flag: row.get(4)?,
        })
    })?;

    let mut tests = Vec::new();
    for test in test_iter {
        match test {
            Ok(t) => tests.push(t),
            Err(e) => return Err(e),
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