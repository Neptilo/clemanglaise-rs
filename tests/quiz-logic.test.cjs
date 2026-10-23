const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// Run from the rs folder:
//   node.exe --test tests/quiz-logic.test.cjs
//
// Covers the pure helpers in src/common/quiz-logic.js. No browser and no
// server are needed: the module exports plain functions.
const quizLogicPath = path.join(__dirname, "..", "src", "common", "quiz-logic.js");
const {
    ampersandUnescape,
    checkAnswer,
    createQuizState,
    processQuestionResponse,
    removeDiacritics,
    standardizeString,
} = require(quizLogicPath);

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
