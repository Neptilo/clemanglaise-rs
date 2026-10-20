use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};

mod auth;
mod words;

const DATABASE_FILE: &str = "clemanglaise.sqlite";
const PREVIOUS_SCORE_WEIGHT: f64 = 0.7;
const CURRENT_ANSWER_WEIGHT: f64 = 1.0 - PREVIOUS_SCORE_WEIGHT;

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
        let client = auth::build_http_client(false);
        let url = format!("{}get_lists.php", auth::server_url(auth::PHP_API_ROOT));

        match client.get(&url).send().await {
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
    let conn = Connection::open(DATABASE_FILE)?;

    let mut stmt = conn.prepare("SELECT id, name, src, dst, flag FROM lists")?;
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

#[derive(Debug, Serialize)]
struct QuizTag {
    id: i32,
    name: String,
}

#[tauri::command]
async fn fetch_remote_quiz_tags(list_id: u32) -> Result<Vec<auth::QuizTag>, String> {
    auth::fetch_quiz_tags(list_id).await
}

#[tauri::command]
fn fetch_quiz_tags(list_id: u32) -> Result<Vec<QuizTag>, String> {
    let conn = Connection::open(DATABASE_FILE)
        .map_err(|e| format!("Error opening local database: {e}"))?;
    let mut stmt = conn.prepare(
        "SELECT DISTINCT tags.id, tags.name FROM words_tags \
         INNER JOIN tags ON tags.id = words_tags.tag_id \
         INNER JOIN words ON words.id = words_tags.word_id \
         WHERE words.list_id = ?1 ORDER BY tags.name ASC"
    ).map_err(|e| format!("Error preparing local tag query: {e}"))?;
    let rows = stmt.query_map([list_id], |row| Ok(QuizTag { id: row.get(0)?, name: row.get(1)? }))
        .map_err(|e| format!("Error querying local tags: {e}"))?;
    let tags = rows.collect::<SqlResult<Vec<_>>>()
        .map_err(|e| format!("Error reading local tags: {e}"))?;
    Ok(tags)
}

#[tauri::command]
async fn fetch_quiz_question(
    list_id: u32,
    list_size_limit: u32,
    remote: bool,
    selected_tags: Vec<i32>,
) -> Result<String, String> {
    if remote {
        return auth::fetch_quiz_question(list_id, list_size_limit).await;
    }

    let conn = Connection::open(DATABASE_FILE)
        .map_err(|e| format!("Error opening local database: {e}"))?;
    let limit = list_size_limit.max(1);
    let ids = selected_tags.iter().copied().filter(|id| *id > 0).collect::<Vec<_>>();
    let condition = if selected_tags.is_empty() {
        "1=1".to_string()
    } else {
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let tagged = if ids.is_empty() { "0=1".to_string() } else {
            format!("EXISTS (SELECT 1 FROM words_tags wt WHERE wt.word_id = words.id AND wt.tag_id IN ({placeholders}))")
        };
        if selected_tags.contains(&0) {
            format!("({tagged} OR NOT EXISTS (SELECT 1 FROM words_tags wt WHERE wt.word_id = words.id))")
        } else { tagged }
    };
    let sql = format!(
        "SELECT id, word, meaning, nature, comment, example, pronunciation, hint \
         FROM (SELECT words.* FROM words WHERE list_id = ? AND {condition} ORDER BY asked DESC LIMIT ?) \
         ORDER BY score, RANDOM() LIMIT 1"
    );
    let mut stmt = conn.prepare(&sql)
        .map_err(|e| format!("Error preparing local question query: {e}"))?;
    let mut query_params = vec![rusqlite::types::Value::Integer(list_id.into())];
    query_params.extend(ids.iter().map(|id| rusqlite::types::Value::Integer((*id).into())));
    query_params.push(rusqlite::types::Value::Integer(limit.into()));
    let mut rows = stmt
        .query(rusqlite::params_from_iter(query_params))
        .map_err(|e| format!("Error querying local words: {e}"))?;
    let row = rows
        .next()
        .map_err(|e| format!("Error reading local question: {e}"))?
        .ok_or_else(|| "The selected local vocabulary list is empty.".to_string())?;
    let mut fields = vec![row
        .get::<_, i64>(0)
        .map_err(|e| format!("Error reading local word ID: {e}"))?
        .to_string()];
    for i in 1..8 {
        fields.push(
            row.get::<_, Option<String>>(i)
                .map(|v| v.unwrap_or_default())
                .map_err(|e| format!("Error reading local word field: {e}"))?,
        );
    }
    Ok(fields.join("\n"))
}

#[tauri::command]
async fn submit_quiz_answer(correct: bool, word_id: u32, remote: bool) -> Result<String, String> {
    if remote {
        return auth::submit_quiz_answer(correct, word_id).await;
    }
    let conn = Connection::open(DATABASE_FILE)
        .map_err(|e| format!("Error opening local database: {e}"))?;
    let transaction = conn
        .unchecked_transaction()
        .map_err(|e| format!("Error starting score transaction: {e}"))?;
    let last_results: i64 = transaction
        .query_row(
            "SELECT last_results FROM words WHERE id = ?1",
            [word_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Error reading local score history: {e}"))?;
    let updated_results = (((last_results as u16) << 1) | u16::from(correct)) as i64;
    let affected = transaction.execute(
        "UPDATE words SET correctly_answered = correctly_answered + ?1, asked = asked + 1, last_results = ?2, \
         score = ROUND(?3 * score + ?4 * ?1, 2) WHERE id = ?5",
        params![
            i64::from(correct),
            updated_results,
            PREVIOUS_SCORE_WEIGHT,
            CURRENT_ANSWER_WEIGHT,
            word_id
        ]
    ).map_err(|e| format!("Error updating local score: {e}"))?;
    if affected != 1 {
        return Err(format!(
            "Expected to update one word score, updated {affected}."
        ));
    }
    transaction
        .commit()
        .map_err(|e| format!("Error saving local score: {e}"))?;
    Ok(String::new())
}

// ==================== Tauri App Initialization ====================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            fetch_vocab_tests,
            words::fetch_words,
            words::fetch_word,
            words::fetch_word_tags,
            words::save_word,
            fetch_remote_quiz_tags,
            fetch_quiz_tags,
            fetch_quiz_question,
            submit_quiz_answer,
            auth::auth_login,
            auth::auth_register,
            auth::auth_status,
            auth::auth_logout
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
