use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::{auth, DATABASE_FILE};

#[derive(Debug, Serialize, Deserialize)]
pub struct Word {
    pub id: i32,
    pub list_id: i32,
    pub word: String,
    pub meaning: String,
    pub nature: String,
    pub pronunciation: String,
    pub comment: String,
    pub example: String,
    pub hint: String,
    pub tag_ids: Vec<i32>,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct WordTag {
    pub id: i32,
    pub name: String,
}
#[derive(Debug, Deserialize)]
pub struct WordInput {
    pub id: Option<i32>,
    pub list_id: i32,
    pub remote: bool,
    pub word: String,
    pub meaning: String,
    pub nature: String,
    pub pronunciation: String,
    pub comment: String,
    pub example: String,
    pub hint: String,
    pub tag_ids: Vec<i32>,
}

#[tauri::command]
pub async fn fetch_words(list_id: i32, remote: bool) -> Result<Vec<Word>, String> {
    if remote {
        let body = remote_get(
            "search.php",
            &[
                ("list_id", list_id.to_string()),
                ("string", String::new()),
                ("tag_ids", String::new()),
                ("untagged", "1".to_string()),
            ],
        )
        .await?;
        return parse_words(&body, list_id);
    }
    let conn = Connection::open(DATABASE_FILE).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, list_id, word, meaning, nature, pronunciation, comment, example, hint \
             FROM words WHERE list_id=?1 ORDER BY word COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([list_id], |r| {
            Ok(Word {
                id: r.get(0)?,
                list_id: r.get(1)?,
                word: r.get::<_, Option<String>>(2)?.unwrap_or_default(),
                meaning: r.get::<_, Option<String>>(3)?.unwrap_or_default(),
                nature: r.get::<_, Option<String>>(4)?.unwrap_or_default(),
                pronunciation: r.get::<_, Option<String>>(5)?.unwrap_or_default(),
                comment: r.get::<_, Option<String>>(6)?.unwrap_or_default(),
                example: r.get::<_, Option<String>>(7)?.unwrap_or_default(),
                hint: r.get::<_, Option<String>>(8)?.unwrap_or_default(),
                tag_ids: vec![],
            })
        })
        .map_err(|e| e.to_string())?;
    let mut words = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;
    for word in &mut words {
        word.tag_ids = conn
            .prepare("SELECT tag_id FROM words_tags WHERE word_id=?1")
            .map_err(|e| e.to_string())?
            .query_map([word.id], |r| r.get(0))
            .map_err(|e| e.to_string())?
            .collect::<rusqlite::Result<Vec<i32>>>()
            .map_err(|e| e.to_string())?;
    }
    Ok(words)
}
#[tauri::command]
pub async fn fetch_word(list_id: i32, word_id: i32, remote: bool) -> Result<Word, String> {
    if remote {
        let body = remote_get(
            "get_word.php",
            &[
                ("list_id", list_id.to_string()),
                ("word_id", word_id.to_string()),
            ],
        )
        .await?;
        return parse_remote_word(&body, list_id, word_id);
    }

    let conn = Connection::open(DATABASE_FILE).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, list_id, word, meaning, nature, pronunciation, comment, example, hint \
             FROM words WHERE id=?1 AND list_id=?2",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(params![word_id, list_id])
        .map_err(|e| e.to_string())?;
    let row = rows
        .next()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Word not found in this vocabulary list.".to_string())?;
    let mut word = Word {
        id: row.get(0).map_err(|e| e.to_string())?,
        list_id: row.get(1).map_err(|e| e.to_string())?,
        word: row
            .get::<_, Option<String>>(2)
            .map_err(|e| e.to_string())?
            .unwrap_or_default(),
        meaning: row
            .get::<_, Option<String>>(3)
            .map_err(|e| e.to_string())?
            .unwrap_or_default(),
        nature: row
            .get::<_, Option<String>>(4)
            .map_err(|e| e.to_string())?
            .unwrap_or_default(),
        pronunciation: row
            .get::<_, Option<String>>(5)
            .map_err(|e| e.to_string())?
            .unwrap_or_default(),
        comment: row
            .get::<_, Option<String>>(6)
            .map_err(|e| e.to_string())?
            .unwrap_or_default(),
        example: row
            .get::<_, Option<String>>(7)
            .map_err(|e| e.to_string())?
            .unwrap_or_default(),
        hint: row
            .get::<_, Option<String>>(8)
            .map_err(|e| e.to_string())?
            .unwrap_or_default(),
        tag_ids: Vec::new(),
    };
    word.tag_ids = conn
        .prepare("SELECT tag_id FROM words_tags WHERE word_id=?1")
        .map_err(|e| e.to_string())?
        .query_map([word_id], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<i32>>>()
        .map_err(|e| e.to_string())?;
    Ok(word)
}

#[tauri::command]
pub async fn fetch_word_tags(list_id: i32, remote: bool) -> Result<Vec<WordTag>, String> {
    if remote {
        let body = remote_get("find_used_tags.php", &[("list_id", list_id.to_string())]).await?;
        return parse_tags(&body);
    }
    let conn = Connection::open(DATABASE_FILE).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT t.id, t.name FROM tags t \
             LEFT JOIN words_tags wt ON wt.tag_id=t.id \
             LEFT JOIN words w ON w.id=wt.word_id \
             WHERE w.list_id=?1 OR w.id IS NULL ORDER BY t.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([list_id], |r| {
            Ok(WordTag {
                id: r.get(0)?,
                name: r.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn save_word(word: WordInput) -> Result<(), String> {
    if word.remote {
        let mut fields = vec![
            ("list_id", word.list_id.to_string()),
            ("word", word.word),
            ("meaning", word.meaning),
            ("nature", word.nature),
            ("pronunciation", word.pronunciation),
            ("comment", word.comment),
            ("example", word.example),
            ("hint", word.hint),
        ];
        let endpoint = if let Some(id) = word.id {
            fields.push(("id", id.to_string()));
            "update_word.php"
        } else {
            "add_word.php"
        };
        for id in word.tag_ids {
            fields.push(("tag_ids[]", id.to_string()));
        }
        let client = auth::get_http_client().clone();
        let response = client
            .post(auth::server_url(auth::PHP_API_ROOT) + endpoint)
            .form(&fields)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = response.status();
        let text = response.text().await.map_err(|e| e.to_string())?;
        if !status.is_success() {
            return Err(if text.trim().is_empty() {
                format!("Server returned {status}.")
            } else {
                text
            });
        }
        if !text.trim().is_empty() {
            return Err(text);
        }
        return Ok(());
    }
    let mut conn = Connection::open(DATABASE_FILE).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    if let Some(id) = word.id {
        let count = tx
            .execute(
                "UPDATE words SET word=?1, meaning=?2, nature=?3, pronunciation=?4, \
                 comment=?5, example=?6, hint=?7 WHERE id=?8 AND list_id=?9",
                params![
                    word.word.trim(),
                    word.meaning.trim(),
                    word.nature,
                    word.pronunciation.trim(),
                    word.comment.trim(),
                    word.example.trim(),
                    word.hint.trim(),
                    id,
                    word.list_id
                ],
            )
            .map_err(|e| e.to_string())?;
        if count != 1 {
            return Err("Word not found in this list.".into());
        }
        tx.execute("DELETE FROM words_tags WHERE word_id=?1", [id])
            .map_err(|e| e.to_string())?;
        for tag in word.tag_ids {
            tx.execute(
                "INSERT INTO words_tags(word_id,tag_id) VALUES(?1,?2)",
                params![id, tag],
            )
            .map_err(|e| e.to_string())?;
        }
    } else {
        tx.execute(
            "INSERT INTO words(list_id, word, meaning, nature, pronunciation, comment, example, hint) \
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                word.list_id,
                word.word.trim(),
                word.meaning.trim(),
                word.nature,
                word.pronunciation.trim(),
                word.comment.trim(),
                word.example.trim(),
                word.hint.trim()
            ],
        )
        .map_err(|e| e.to_string())?;
        let id = tx.last_insert_rowid();
        for tag in word.tag_ids {
            tx.execute(
                "INSERT INTO words_tags(word_id,tag_id) VALUES(?1,?2)",
                params![id, tag],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())
}

fn parse_remote_word(body: &str, list_id: i32, word_id: i32) -> Result<Word, String> {
    let mut value: serde_json::Value = serde_json::from_str(body).map_err(|e| e.to_string())?;
    let response_word_id = value
        .get("id")
        .and_then(serde_json::Value::as_i64)
        .ok_or_else(|| "Invalid word response: missing id.".to_string())?;
    if response_word_id != i64::from(word_id) {
        return Err("Word not found in this vocabulary list.".into());
    }
    if let Some(object) = value.as_object_mut() {
        object.insert("list_id".into(), serde_json::Value::from(list_id));
    }
    serde_json::from_value(value).map_err(|e| e.to_string())
}

async fn remote_get(endpoint: &str, params: &[(&str, String)]) -> Result<String, String> {
    let url = format!("{}{}", auth::server_url(auth::PHP_API_ROOT), endpoint);
    let client = auth::get_http_client().clone();
    let response = client
        .get(url)
        .query(params)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Server returned {}", response.status()));
    }
    response.text().await.map_err(|e| e.to_string())
}
fn parse_words(body: &str, list_id: i32) -> Result<Vec<Word>, String> {
    let lines = body.lines().collect::<Vec<_>>();
    if lines.is_empty() {
        return Ok(Vec::new());
    }
    if lines.len() % 9 != 0 {
        return Err("Invalid word list response.".into());
    }
    Ok(lines
        .chunks_exact(9)
        .map(|c| Word {
            id: c[0].parse().unwrap_or(0),
            list_id,
            word: c[1].into(),
            meaning: c[2].into(),
            pronunciation: c[3].into(),
            nature: c[4].into(),
            comment: c[5].into(),
            example: c[6].into(),
            hint: c[7].into(),
            tag_ids: c[8]
                .split(", ")
                .filter_map(|s| s.trim().parse().ok())
                .collect(),
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::{parse_remote_word, parse_tags, parse_words};

    #[test]
    fn remote_word_response_without_list_id_is_completed() {
        let body = r#"{"id":9,"word":"chat","meaning":"cat","nature":"n","pronunciation":"sha","comment":"","example":"","hint":"","tag_ids":[2]}"#;
        let word = parse_remote_word(body, 4, 9).expect("valid remote word");
        assert_eq!(word.id, 9);
        assert_eq!(word.list_id, 4);
        assert_eq!(word.tag_ids, vec![2]);
    }

    #[test]
    fn remote_word_response_for_another_id_is_rejected() {
        let body = r#"{"id":10,"word":"chat","meaning":"cat","nature":"n","pronunciation":"sha","comment":"","example":"","hint":"","tag_ids":[]}"#;
        assert!(parse_remote_word(body, 4, 9).is_err());
    }

    #[test]
    fn word_list_response_is_read_in_nine_line_chunks() {
        let body = "1\nchat\ncat\nsha\nn\ncomment\nexample\nhint\n2, 3\n\
                    2\nchien\ndog\nshya\nn\n\n\n\n4";
        let words = parse_words(body, 4).expect("valid word list");
        assert_eq!(words.len(), 2);

        assert_eq!(words[0].id, 1);
        assert_eq!(words[0].list_id, 4);
        assert_eq!(words[0].word, "chat");
        assert_eq!(words[0].meaning, "cat");
        assert_eq!(words[0].pronunciation, "sha");
        assert_eq!(words[0].nature, "n");
        assert_eq!(words[0].comment, "comment");
        assert_eq!(words[0].example, "example");
        assert_eq!(words[0].hint, "hint");
        assert_eq!(words[0].tag_ids, vec![2, 3]);

        assert_eq!(words[1].id, 2);
        assert_eq!(words[1].word, "chien");
        assert_eq!(words[1].tag_ids, vec![4]);
    }

    #[test]
    fn word_list_response_with_a_partial_chunk_is_rejected() {
        let body = "1\nchat\ncat\nsha\nn\ncomment\nexample\nhint\n";
        assert!(parse_words(body, 4).is_err());
    }

    #[test]
    fn tag_list_response_is_read_in_two_line_chunks() {
        let tags = parse_tags("2\nNouns\n3\nVerbs\n").expect("valid tag list");
        assert_eq!(tags.len(), 2);
        assert_eq!(tags[0].id, 2);
        assert_eq!(tags[0].name, "Nouns");
        assert_eq!(tags[1].id, 3);
        assert_eq!(tags[1].name, "Verbs");
    }

    #[test]
    fn tag_list_response_with_an_odd_line_count_is_rejected() {
        assert!(parse_tags("2\nNouns\n3\n").is_err());
    }
}

fn parse_tags(body: &str) -> Result<Vec<WordTag>, String> {
    let lines = body
        .lines()
        .filter(|l| !l.trim().is_empty())
        .collect::<Vec<_>>();
    if lines.len() % 2 != 0 {
        return Err("Invalid tag list response.".into());
    }
    Ok(lines
        .chunks_exact(2)
        .filter_map(|c| {
            Some(WordTag {
                id: c[0].parse().ok()?,
                name: c[1].into(),
            })
        })
        .collect())
}
