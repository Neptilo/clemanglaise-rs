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
    getAnswerField,
    processQuestionResponse,
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

test("getAnswerField asks for the pronunciation only in Arabic", () => {
    assert.equal(getAnswerField("ar"), "pronunciation");
    assert.equal(getAnswerField("fr"), "meaning");
    assert.equal(getAnswerField(undefined), "meaning");
    assert.equal(getAnswerField(""), "meaning");
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
            "hintElem",
            "meaningElem",
            "partOfSpeechElem",
            "pronunciationElem",
            "translationElem",
            "wordElems",
        ]);
        assert.equal(elements.meaningElem.id, "meaning");
        assert.equal(elements.translationElem.id, "translation");
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

test("resetForNewQuestion clears the last result only", () => {
    const state = createQuizState();
    state.correct = true;
    state.updateListSize();
    state.resetForNewQuestion();
    assert.equal(state.correct, false);
    assert.equal(state.askedInThisSession, 1);
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
        pronunciationElem: { innerHTML: "" },
        hintElem: { innerHTML: "" },
    };

    assert.equal(processQuestionResponse(body, elements), 42);
    assert.equal(wordElems[0].innerHTML, "chat");
    assert.equal(wordElems[1].innerHTML, "chat");
    assert.equal(elements.meaningElem.innerHTML, "cat");
    assert.equal(elements.partOfSpeechElem.innerHTML, "noun");
    assert.equal(elements.commentElem.innerHTML, "a comment");
    assert.equal(elements.exampleElem.innerHTML, "an example");
    assert.equal(elements.pronunciationElem.innerHTML, "[sha]");
    assert.equal(elements.hintElem.innerHTML, "a hint");
});

test("processQuestionResponse answers with the pronunciation in Arabic", () => {
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
        language,
    });

    // Arabic asks for the pronunciation, so that is the expected answer...
    const arabicElements = makeElements("ar");
    processQuestionResponse(body, arabicElements);
    assert.equal(arabicElements.meaningElem.innerHTML, "kabīr");

    // ...while other languages keep asking for the translation.
    const frenchElements = makeElements("fr");
    processQuestionResponse(body, frenchElements);
    assert.equal(frenchElements.meaningElem.innerHTML, "big");

    // A response without a language keeps the previous behaviour.
    const defaultElements = makeElements(undefined);
    processQuestionResponse(body, defaultElements);
    assert.equal(defaultElements.meaningElem.innerHTML, "big");
});

test("processQuestionResponse shows the translation when Arabic answers the pronunciation", () => {
    const body = ["7", "كبير", "big", "adj", "", "", "kabīr", "", ""].join("\n");

    const arabic = {
        wordElems: [],
        meaningElem: { innerHTML: "" },
        translationElem: { innerHTML: "", hidden: true },
        language: "ar",
    };
    processQuestionResponse(body, arabic);
    assert.equal(arabic.meaningElem.innerHTML, "kabīr");
    assert.equal(arabic.translationElem.innerHTML, "big");
    assert.equal(arabic.translationElem.hidden, false);

    // Other languages already show the translation as the answer, so the extra
    // line stays hidden.
    const french = {
        wordElems: [],
        meaningElem: { innerHTML: "" },
        translationElem: { innerHTML: "", hidden: false },
        language: "fr",
    };
    processQuestionResponse(body, french);
    assert.equal(french.translationElem.hidden, true);

    // An Arabic word with no translation leaves the line hidden and empty
    // rather than showing a blank line.
    const emptyBody = ["8", "كبير", "", "adj", "", "", "kabīr", "", ""].join("\n");
    const arabicWithoutMeaning = {
        wordElems: [],
        meaningElem: { innerHTML: "" },
        translationElem: { innerHTML: "", hidden: false },
        language: "ar",
    };
    processQuestionResponse(emptyBody, arabicWithoutMeaning);
    assert.equal(arabicWithoutMeaning.translationElem.hidden, true);
});
