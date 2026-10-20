const invoke = window.__TAURI__.core.invoke;
const query = new URLSearchParams(location.search);
const listId = Number(query.get("list_id"));
const remote = query.get("remote") === "true";
let status = document.getElementById("status");
let formSection = document.getElementById("word-form");
let form = document.getElementById("editor");
let currentWordId = null;
let tags = [];
// Languages whose nouns carry a gender; the gender row is meaningless otherwise.
const GENDERED_LANGUAGES = ["de", "hr", "ru", "ar", "ca", "es", "fr"];

if (!Number.isInteger(listId) || listId <= 0) {
    const root = document.getElementById("word-manager-root");
    if (root) root.textContent = "Invalid vocabulary list.";
} else
    loadWordManagerTemplate({
        templateUrl: "common/word-manager.html",
        mount: document.getElementById("word-manager-root"),
        values: {
            BACK_LABEL: "Back to quiz",
            PAGE_TITLE: "Manage words",
            WORDS_LABEL: "Words in this list",
            ADD_WORD_LABEL: "Add a word",
            WORD_LABEL: "Word",
            PART_OF_SPEECH_LABEL: "Part of speech",
            TRANSLATION_LABEL: "Translation",
            PRONUNCIATION_LABEL: "Pronunciation",
            COMMENT_LABEL: "Comment",
            EXAMPLE_LABEL: "Example",
            HINT_LABEL: "Hint",
            TAGS_LABEL: "Tags",
            SELECT_TAGS_LABEL: "Select tags",
            SAVE_LABEL: "Add",
        },
    })
        .then(() => {
            status = document.getElementById("status");
            formSection = document.getElementById("word-form");
            form = document.getElementById("editor");
            bindEditor();
            initialize();
        })
        .catch(showError);

async function initialize() {
    const lists = await invoke("fetch_vocab_tests", { remote });
    const list = lists.find((item) => item.id === listId);
    if (!list) throw new Error("Vocabulary list not found.");
    document.getElementById("list-title").textContent = `Words — ${list.name}`;
    window.destinationLanguage = list.dst;
    await loadTags();
    if (query.get("mode") === "add") {
        openEditor();
        return;
    }
    const wordId = Number(query.get("word_id"));
    if (!Number.isInteger(wordId) || wordId <= 0) {
        throw new Error("Invalid word. Open editing from a quiz question.");
    }

    const word = await invoke("fetch_word", { listId, wordId, remote });
    if (!word || Number(word.id) !== wordId) {
        throw new Error("Word not found in this vocabulary list.");
    }
    openEditor(word);
}
function decodeHtmlEntities(value) {
    const decoder = document.createElement("textarea");
    decoder.innerHTML = value || "";
    return decoder.value;
}

function updateGenderRow() {
    document.getElementById("gender-row").hidden =
        form.elements.nature.value !== "n" ||
        !GENDERED_LANGUAGES.includes(window.destinationLanguage);
}
function openEditor(word = null) {
    currentWordId = word?.id ?? null;
    form.reset();
    form.querySelector('[type="submit"]').textContent = word ? "Edit" : "Add";
    document.getElementById("form-title").textContent = word
        ? "Edit word"
        : "Add a word";
    document.getElementById("gender-row").hidden = true;
    if (word) {
        for (const key of [
            "word",
            "meaning",
            "pronunciation",
            "comment",
            "example",
            "hint",
            "nature",
        ]) {
            const value = word[key] ?? "";
            form.elements[key].value =
                key === "meaning" ? decodeHtmlEntities(value) : value;
        }
        const nature = word.nature ?? "";
        form.elements.nature.value = nature.startsWith("n") ? "n" : nature;
        form.elements.gender.value = nature.startsWith("n")
            ? nature.slice(1)
            : "";
        updateGenderRow();
        renderTags(word.tag_ids ?? []);
    } else {
        renderTags();
    }
    formSection.hidden = false;
}
function renderTags(selected = []) {
    const root = document.getElementById("tags");
    root.replaceChildren();
    tags.forEach((tag) => {
        const label = document.createElement("label");
        label.className = "tag-filter-option";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = tag.id;
        input.checked = selected.some((id) => Number(id) === Number(tag.id));
        label.append(input, document.createTextNode(tag.name));
        root.append(label);
    });
}
async function loadTags() {
    tags = await invoke("fetch_word_tags", { listId, remote });
    renderTags();
}
function returnToQuiz() {
    const referrer = new URL(document.referrer || window.location.href);
    if (referrer.pathname.endsWith("/quiz.html"))
        window.location.href = referrer.href;
    else
        window.location.href = `quiz.html?list_id=${listId}&dst=${encodeURIComponent(window.destinationLanguage || query.get("dst") || "")}&remote=${remote}`;
}
function bindEditor() {
    document.getElementById("back").addEventListener("click", returnToQuiz);
    form.elements.nature.addEventListener("change", updateGenderRow);
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        status.textContent = "Saving…";
        const data = Object.fromEntries(new FormData(form));
        data.list_id = listId;
        data.remote = remote;
        data.id = currentWordId;
        data.nature =
            data.nature === "n" ? `n${data.gender || ""}` : data.nature;
        data.tag_ids = [
            ...document.querySelectorAll("#tags input:checked"),
        ].map((input) => Number(input.value));
        delete data.gender;
        try {
            await invoke("save_word", { word: data });
            status.textContent = "Word saved.";
            // Adding keeps the user on the form; clear it so the next entry
            // starts empty. Editing keeps the current word loaded instead.
            if (currentWordId === null) openEditor();
        } catch (error) {
            showError(error);
        }
    });
    document.getElementById("gender-row").hidden = true;
}
async function showError(error) {
    const message = String(error);
    if (status) {
        status.textContent = message;
    } else {
        document.getElementById("word-manager-root").textContent = message;
    }
}
