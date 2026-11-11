const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// Run from the rs folder:
//   node.exe --test tests/quiz-logic.test.cjs
//
// Covers the pure helpers in src/common/quiz-logic.js. No browser and no
// server are needed: the module exports plain functions.
const quizLogicPath = path.join(__dirname, "..", "src", "common", "quiz-logic.js");
const textUtilsPath = path.join(__dirname, "..", "src", "common", "text-utils.js");
const {
    checkAnswer,
    collectQuizElements,
    createQuizState,
    processQuestionResponse,
    setAnswerVisible,
} = require(quizLogicPath);
const {
    ampersandUnescape,
    asciiToDin,
    normalizePronunciationForSave,
    removeDiacritics,
    standardizeString,
} = require(textUtilsPath);

test("removeDiacritics maps accented letters and leaves other scripts intact", () => {
    assert.equal(removeDiacritics("ÀÁÂÃÄÅĄÆÇĆ"), "AAAAAAAAECC");
    assert.equal(removeDiacritics("ÈÉÊËĘÌÍÎÏŁÑŃ"), "EEEEEIIIILNN");
    assert.equal(removeDiacritics("ÒÓÔÕÖØŒŠŚÙÚÛÜÝŸŽŹŻ"), "OOOOOOOESSUUUUYYZZZ");
    assert.equal(
        removeDiacritics("àáâãäåąæçćèéêëęìíîïłñń"),
        "aaaaaaaaecceeeeeiiiilnn",
    );
    assert.equal(
        removeDiacritics("òóôõöøœšśùúûüýÿžźż"),
        "oooooooessuuuuyyzzz",
    );
    // Non-Latin scripts have no entry in the table and must survive unchanged.
    assert.equal(removeDiacritics("文化"), "文化");
});

test("standardizeString lowercases and strips diacritics", () => {
    assert.equal(standardizeString("Été"), "ete");
    assert.equal(standardizeString("ÉTÉ"), "ete");
    assert.equal(standardizeString("żółw"), "zolw");
    // standardizeString does not trim; checkAnswer does.
    assert.equal(standardizeString("  Été "), "  ete ");
});

test("ampersandUnescape decodes numeric references and keeps the rest of the text", () => {
    assert.equal(ampersandUnescape("&#233;t&#233;"), "été");
    assert.equal(ampersandUnescape("&#25991;&#21270;"), "文化");
    // Text between entities is preserved rather than dropped.
    assert.equal(ampersandUnescape("a&#233;b"), "aéb");
    // A whole entity-only string is not truncated.
    assert.equal(ampersandUnescape("&#275;t&#233;"), "ēté");
    // Text with no entity, including a bare ampersand, is returned unchanged.
    assert.equal(ampersandUnescape("a & b"), "a & b");
});

test("checkAnswer normalizes case, accents and surrounding whitespace", () => {
    assert.equal(checkAnswer("ete", "été"), true);
    assert.equal(checkAnswer("ÉTÉ", "été"), true);
    assert.equal(checkAnswer("ete", "ÉTÉ"), true);
    assert.equal(checkAnswer("  chien  ", "chien"), true);
    assert.equal(checkAnswer("chien", "  chien  "), true);
});

test("checkAnswer matches any entry of a comma-separated answer list", () => {
    assert.equal(checkAnswer("cat", "chat,cat"), true);
    assert.equal(checkAnswer("cat", "chat, cat"), true);
    assert.equal(checkAnswer(" chat ", "chat, cat"), true);
    // A word that is not in the list is rejected.
    assert.equal(checkAnswer("dog", "chat,cat"), false);
});

test("checkAnswer compares an entity-encoded answer to plain typed text", () => {
    // Meanings are stored entity-encoded, so a typed answer must still match.
    assert.equal(checkAnswer("ete", "&#233;t&#233;"), true);
    assert.equal(checkAnswer("cat", "chat,&#233;t&#233;"), false);
});

test("asciiToDin transcribes ASCII markers into DIN 31635", () => {
    // DIN 31635 reference vectors.
    assert.equal(
        asciiToDin("a2thj7khddhrzsshSDTZ3gh"),
        "ʾaʾṯǧḥḫdḏrzsšṣḍṭẓʿġ",
    );
    assert.equal(asciiToDin("kabiir"), "kabīr");
    assert.equal(asciiToDin("shukran"), "šukran");
    // A string already in DIN must not change.
    assert.equal(asciiToDin("ʿh.(, ġī;"), "ʿh.(, ġī;");
    // Without punctuation, only phonemes are kept.
    assert.equal(asciiToDin("/r,l a-*y.", false), "rlʾay");
});

test("checkAnswer accepts an ASCII transcription for Arabic", () => {
    // No Arabic keyboard needed: the user types the pronunciation in ASCII and
    // it is compared with the stored DIN transcription.
    assert.equal(checkAnswer("kabiir", "kabīr", "ar"), true);
    assert.equal(checkAnswer("kabīr", "kabīr", "ar"), true);
    assert.equal(checkAnswer("  kabiir  ", "kabīr", "ar"), true);
    assert.equal(checkAnswer("shukran", "šukran", "ar"), true);
    // Uppercase markers are distinct phonemes, so they are not a case
    // variant of their lowercase form: "H" is ḥ, not h.
    assert.equal(checkAnswer("Habiib", "ḥabīb", "ar"), true);
    assert.equal(checkAnswer("habiib", "ḥabīb", "ar"), false);
    // A short vowel is significant: "kabir" is not "kabīr".
    assert.equal(checkAnswer("kabir", "kabīr", "ar"), false);
    // The Arabic script itself is not what is asked for, so it does not match.
    assert.equal(checkAnswer("كبير", "kabīr", "ar"), false);
});

test("checkAnswer keeps diacritics for Arabic and strips them elsewhere", () => {
    // The default path folds diacritics away...
    assert.equal(checkAnswer("kabir", "kabīr"), false);
    // ...but the Arabic path does not, so only the exact transcription matches.
    assert.equal(checkAnswer("kabiir", "kabīr", "ar"), true);
    // Non-Arabic languages are unaffected by the new parameter.
    assert.equal(checkAnswer("ete", "été", "fr"), true);
    assert.equal(checkAnswer("chat", "chat,cat", "fr"), true);
});

test("checkAnswer ignores punctuation in stored Arabic pronunciations", () => {
    assert.equal(checkAnswer("bayt", "bayt, buyūt", "ar"), true);
    assert.equal(checkAnswer("buyuut", "bayt, buyūt", "ar"), true);
    assert.equal(checkAnswer("bayt.", "bayt", "ar"), true);
});

test("an empty answer is never correct", () => {
    // Arabic asks for a pronunciation, so a word saved without one must not be
    // "answered" by submitting an empty input.
    assert.equal(checkAnswer("", "", "ar"), false);
    assert.equal(checkAnswer("   ", "", "ar"), false);
    assert.equal(checkAnswer("...", "", "ar"), false);
    assert.equal(checkAnswer("", "", "fr"), false);
    assert.equal(checkAnswer("   ", "chat", "fr"), false);
});

test("checkAnswer accepts a pinyin answer for Chinese with or without tone numbers", () => {
    // The player types pinyin, either with tone numbers or with tone marks.
    assert.equal(checkAnswer("wen2hua4", "wénhuà", "zh"), true);
    assert.equal(checkAnswer("wénhuà", "wénhuà", "zh"), true);
    assert.equal(checkAnswer("wen2 hua4", "wénhuà", "zh"), true);
    // Syllable spacing is ignored: the comparison spaces both sides the same way.
    assert.equal(checkAnswer("wén huà", "wénhuà", "zh"), true);
    assert.equal(checkAnswer("wen2hua4", "wén huà", "zh"), true);
    // A wrong word is rejected...
    assert.equal(checkAnswer("ni3hao3", "wénhuà", "zh"), false);
    // ...and so is a missing tone: the tone is the point of pinyin.
    assert.equal(checkAnswer("wenhua", "wénhuà", "zh"), false);
});

test("checkAnswer accepts a rōmaji answer for Japanese", () => {
    // Japanese is answered in Hepburn rōmaji, typed on a Latin keyboard.
    assert.equal(checkAnswer("futatsu", "futatsu", "ja"), true);
    assert.equal(checkAnswer("  Futatsu ", "futatsu", "ja"), true);
    // A macron and the doubled vowel are the same long vowel, whichever side
    // the mark is written on.
    assert.equal(checkAnswer("kookuubin", "kōkūbin", "ja"), true);
    // Separators the player types are ignored.
    assert.equal(checkAnswer("fu-ta-tsu", "futatsu", "ja"), true);
    assert.equal(checkAnswer("gomen nasai", "gomen'nasai", "ja"), true);
    // A short vowel is still significant: it is not the long one.
    assert.equal(checkAnswer("kakkoi", "kakkoī", "ja"), false);
});

test("normalizePronunciationForSave stores Arabic in DIN 31635", () => {
    // ASCII entered for Arabic is stored as DIN, so a quiz answer typed in
    // ASCII matches the stored field.
    assert.equal(normalizePronunciationForSave("kabiir", "ar"), "kabīr");
    assert.equal(normalizePronunciationForSave("shukran", "ar"), "šukran");
    // Punctuation is kept for a stored pronunciation.
    assert.equal(normalizePronunciationForSave("bayt.", "ar"), "bayt.");
    // A value already in DIN must not change.
    assert.equal(normalizePronunciationForSave("kabīr", "ar"), "kabīr");
});

test("normalizePronunciationForSave leaves other languages and empty values alone", () => {
    assert.equal(normalizePronunciationForSave("sha", "fr"), "sha");
    assert.equal(normalizePronunciationForSave("kabiir", "fr"), "kabiir");
    assert.equal(normalizePronunciationForSave("kabiir", undefined), "kabiir");
    assert.equal(normalizePronunciationForSave("", "ar"), "");
    assert.equal(normalizePronunciationForSave(undefined, "ar"), undefined);
});

test("collectQuizElements maps every template id the response fills", () => {
    const stub = (id) => ({ id });
    global.document = {
        getElementsByClassName: (name) => [{ className: name }],
        getElementById: (id) => stub(id),
    };
    try {
        const elements = collectQuizElements();
        // Keys are the ones processQuestionResponse consumes.
        assert.deepEqual(Object.keys(elements).sort(), [
            "commentElem",
            "exampleElem",
            "expectedAnswerElem",
            "hintElem",
            "meaningElem",
            "partOfSpeechElem",
            "pronunciationElem",
            "wordElems",
        ]);
        assert.equal(elements.meaningElem.id, "meaning");
        assert.equal(elements.expectedAnswerElem.id, "expected-answer");
        // The word class is used by several elements on the page.
        assert.equal(elements.wordElems[0].className, "word");
    } finally {
        delete global.document;
    }
});

test("a saved Arabic pronunciation still matches an ASCII quiz answer", () => {
    // The two halves of the feature must agree: what the editor stores is what
    // the quiz accepts.
    const stored = normalizePronunciationForSave("kabiir", "ar");
    assert.equal(checkAnswer("kabiir", stored, "ar"), true);
    assert.equal(checkAnswer("kabīr", stored, "ar"), true);
});

test("a correct answer grows the pool and a wrong one shrinks it", () => {
    const state = createQuizState();

    state.correct = true;
    state.updateListSize();
    assert.equal(state.askedInThisSession, 1);
    assert.equal(state.listSizeLimit, 30);

    state.correct = false;
    state.updateListSize();
    assert.equal(state.askedInThisSession, 2);
    assert.equal(state.listSizeLimit, 20);
});

test("the pool never drops below one word", () => {
    const state = createQuizState();
    for (let i = 0; i < 100; i++) {
        state.correct = false;
        state.updateListSize();
        assert.ok(state.listSizeLimit >= 1);
    }
});

test("the pool size stays a whole number once the shrink goes fractional", () => {
    // The size is a count of words a caller can select, so a fraction reaching it
    // is a defect in itself. Shrinking from 20 used to produce 15.555….
    const state = createQuizState();
    state.correct = true;
    state.updateListSize();
    state.correct = false;
    state.updateListSize();
    assert.equal(state.listSizeLimit, 20);

    for (let i = 0; i < 20; i++) {
        state.correct = i % 2 === 0;
        state.updateListSize();
        assert.ok(
            Number.isInteger(state.listSizeLimit),
            `pool size ${state.listSizeLimit} is not a whole number after ${
                state.askedInThisSession
            } answers`,
        );
    }
});

test("a rounded shrink keeps the pool usable instead of collapsing it", () => {
    // Rounding must not turn a slow shrink into a drop to the floor: two wrong
    // answers in a row used to leave a fraction, and truncating it would have
    // discarded the words the pool still allows.
    const state = createQuizState();
    state.correct = true;
    state.updateListSize();

    state.correct = false;
    state.updateListSize();
    assert.equal(state.listSizeLimit, 20);

    state.updateListSize();
    assert.equal(state.listSizeLimit, 16);
});

test("processQuestionResponse fills elements and returns the word id", () => {
    const body = [
        "42",
        "chat",
        "cat",
        "noun",
        "a comment",
        "an example",
        "sha",
        "a hint",
        "",
    ].join("\n");

    const wordElems = [{ innerHTML: "" }, { innerHTML: "" }];
    const elements = {
        wordElems,
        meaningElem: { innerHTML: "" },
        partOfSpeechElem: { innerHTML: "" },
        commentElem: { innerHTML: "" },
        exampleElem: { innerHTML: "" },
        pronunciationElem: { textContent: "", hidden: false },
        hintElem: { innerHTML: "" },
    };

    assert.equal(processQuestionResponse(body, elements), 42);
    assert.equal(wordElems[0].innerHTML, "chat");
    assert.equal(wordElems[1].innerHTML, "chat");
    assert.equal(elements.meaningElem.innerHTML, "cat");
    assert.equal(elements.partOfSpeechElem.innerHTML, "noun");
    assert.equal(elements.commentElem.innerHTML, "a comment");
    assert.equal(elements.exampleElem.innerHTML, "an example");
    // A language that does not ask for the pronunciation shows an IPA reading
    // in brackets, prefixed by the separator.
    assert.equal(elements.pronunciationElem.textContent, ": [sha]");
    assert.equal(elements.hintElem.innerHTML, "a hint");
});

test("processQuestionResponse brackets the pronunciation the way the language is written", () => {
    const body = ["7", "كبير", "big", "adj", "", "", "kabīr", "", ""].join("\n");

    const makeElements = (language) => ({
        wordElems: [],
        meaningElem: { innerHTML: "" },
        pronunciationElem: { textContent: "", hidden: false },
        language,
    });

    // A language answered with a transcription gets slashes...
    const arabic = makeElements("ar");
    processQuestionResponse(body, arabic);
    assert.equal(arabic.pronunciationElem.textContent, ": /kabīr/");
    assert.equal(arabic.pronunciationElem.hidden, false);

    // ...while a language whose pronunciation is an IPA reading keeps brackets.
    const french = makeElements("fr");
    processQuestionResponse(body, french);
    assert.equal(french.pronunciationElem.textContent, ": [kabīr]");
});

test("processQuestionResponse hides the brackets when there is no pronunciation", () => {
    // An empty pronunciation field must not render as "[]" or leave the
    // separator dangling after the part of speech.
    const body = ["9", "chat", "cat", "noun", "", "", "", "", ""].join("\n");
    const elements = {
        wordElems: [],
        meaningElem: { innerHTML: "" },
        partOfSpeechElem: { innerHTML: "" },
        pronunciationElem: { textContent: "", hidden: false },
        language: "fr",
    };

    processQuestionResponse(body, elements);
    assert.equal(elements.pronunciationElem.textContent, "");
    assert.equal(elements.pronunciationElem.hidden, true);
});

test("processQuestionResponse answers with the pronunciation in the languages that ask for it", () => {
    const body = [
        "7",
        "كبير",
        "big",
        "adj",
        "",
        "",
        "kabīr",
        "",
        "",
    ].join("\n");

    const makeElements = (language) => ({
        wordElems: [],
        meaningElem: { innerHTML: "" },
        expectedAnswerElem: { innerHTML: "" },
        language,
    });

    // The large left column always shows the meaning.
    const arabicElements = makeElements("ar");
    processQuestionResponse(body, arabicElements);
    assert.equal(arabicElements.meaningElem.innerHTML, "big");
    // The expected answer is kept apart from it, because Arabic is answered
    // with the pronunciation.
    assert.equal(arabicElements.expectedAnswerElem.innerHTML, "kabīr");

    // Japanese behaves the same way, and is answered in rōmaji.
    const japaneseElements = makeElements("ja");
    processQuestionResponse(body, japaneseElements);
    assert.equal(japaneseElements.meaningElem.innerHTML, "big");
    assert.equal(japaneseElements.expectedAnswerElem.innerHTML, "kabīr");

    // Languages asking for the translation compare against the meaning itself.
    const frenchElements = makeElements("fr");
    processQuestionResponse(body, frenchElements);
    assert.equal(frenchElements.meaningElem.innerHTML, "big");
    assert.equal(frenchElements.expectedAnswerElem.innerHTML, "big");

    // A response without a language keeps the previous behaviour.
    const defaultElements = makeElements(undefined);
    processQuestionResponse(body, defaultElements);
    assert.equal(defaultElements.meaningElem.innerHTML, "big");
    assert.equal(defaultElements.expectedAnswerElem.innerHTML, "big");
});

test("setAnswerVisible leaves exactly one OK button reachable per step", () => {
    const element = (id) => ({ id, hidden: false, disabled: false, focus() {} });
    const elements = {
        answer: element("answer"),
        "validate-question-button": element("validate-question-button"),
        "validate-answer-button": element("validate-answer-button"),
        input: element("input"),
    };
    global.document = { getElementById: (id) => elements[id] ?? null };
    try {
        // Showing the answer withdraws the question's button and locks the
        // field: the answer has been compared already.
        setAnswerVisible(true);
        assert.equal(elements.answer.hidden, false);
        assert.equal(elements["validate-question-button"].hidden, true);
        assert.equal(elements["validate-answer-button"].hidden, false);
        assert.equal(elements.input.disabled, true);

        // Asking again is the mirror image, field included.
        setAnswerVisible(false);
        assert.equal(elements.answer.hidden, true);
        assert.equal(elements["validate-question-button"].hidden, false);
        assert.equal(elements.input.disabled, false);
    } finally {
        delete global.document;
    }
});
