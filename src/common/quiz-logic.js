/**
 * Handles:
 * - Which stored field a quiz answer is compared against
 * - Answer validation, delegating text normalisation to text-utils.js
 * - Processing quiz question responses from find_word.php
 * - Quiz UI state management
 * - Adaptive list size algorithm
 */

// In the browser, both modules are plain scripts: text-utils.js runs first and
// declares its functions as globals, so they must not be re-declared here.
// Under Node (unit tests) there are no such globals, so the module is required.
// Calling through `textUtils` works in both cases.
const textUtils =
    typeof module !== "undefined" && module.exports
        ? require("./text-utils.js")
        : {
              asciiToDin: globalThis.asciiToDin,
              standardizeArabicAnswer: globalThis.standardizeArabicAnswer,
              standardizeString: globalThis.standardizeString,
              stripArabicAnswerPunctuation:
                  globalThis.stripArabicAnswerPunctuation,
          };

/**
 * Field a quiz answer is compared against. Arabic asks for the ASCII
 * transcription of the pronunciation, so it is checked against the
 * pronunciation; every other language is checked against the translation.
 * @param {string} language - Target language code, e.g. "ar"
 * @returns {string} "pronunciation" or "meaning"
 */
function getAnswerField(language) {
    return language === "ar" ? "pronunciation" : "meaning";
}

/**
 * Show the quiz prompt matching the language: the shared template carries the
 * translation prompt (visible) and the pronunciation prompt (hidden), and the
 * two swap when the target language asks for the pronunciation. Arabic is
 * answered with the ASCII transcription of the pronunciation, which needs no
 * Arabic keyboard.
 * @param {string} language - Target language code, e.g. "ar"
 */
function applyLanguageInstruction(language) {
    if (getAnswerField(language) !== "pronunciation") return;
    const translationInstruction = document.getElementById(
        "translation-instruction"
    );
    const pronunciationInstruction = document.getElementById(
        "pronunciation-instruction"
    );
    if (translationInstruction) translationInstruction.hidden = true;
    if (pronunciationInstruction) pronunciationInstruction.hidden = false;
}

/**
 * Check if player's answer matches one of the correct answers
 * @param {string} playerAnswer - The answer provided by the player
 * @param {string} correctAnswers - Comma-separated list of correct answers
 * @param {string} [language] - Target language code; Arabic answers are
 *   transcribed from ASCII and compared with diacritics intact
 * @returns {boolean} True if answer is correct
 */
function checkAnswer(playerAnswer, correctAnswers, language) {
    const isArabic = language === "ar";

    // remove whitespaces at start and end
    let standardizedAnswer = playerAnswer.trim();

    if (isArabic) {
        // The player types ASCII, the pronunciation is stored in DIN 31635.
        standardizedAnswer = textUtils.standardizeArabicAnswer(
            textUtils.asciiToDin(standardizedAnswer, false)
        );
        correctAnswers = textUtils.standardizeArabicAnswer(correctAnswers);
    } else {
        standardizedAnswer = textUtils.standardizeString(standardizedAnswer);
        correctAnswers = textUtils.standardizeString(correctAnswers);
    }

    let correctAnswerList = correctAnswers.split(",");

    // An empty answer must never count as correct. This matters for Arabic,
    // where the expected answer is the pronunciation: a word saved without one
    // would otherwise be "answered" by submitting an empty input.
    if (standardizedAnswer === "") return false;

    // remove whitespaces at start and end of each element in the list
    for (let i = 0; i < correctAnswerList.length; ++i) {
        const answer = correctAnswerList[i].trim();
        correctAnswerList[i] = isArabic
            ? textUtils.stripArabicAnswerPunctuation(answer)
            : answer;
    }

    return correctAnswerList.includes(standardizedAnswer);
}

/**
 * Collect the quiz DOM elements that a question response populates. Both
 * runtimes mount the same shared template, so the mapping from template ids to
 * the keys `processQuestionResponse` expects lives here rather than in each
 * entry script.
 * @returns {Object} The element map, ready to pass to processQuestionResponse
 */
function collectQuizElements() {
    return {
        wordElems: document.getElementsByClassName("word"),
        meaningElem: document.getElementById("meaning"),
        partOfSpeechElem: document.getElementById("part-of-speech"),
        commentElem: document.getElementById("comment"),
        exampleElem: document.getElementById("example"),
        pronunciationElem: document.getElementById("pronunciation"),
        hintElem: document.getElementById("hint"),
        translationElem: document.getElementById("translation"),
    };
}

// ============================================================================
// Question Response Processing
// ============================================================================

/**
 * Parse and display quiz question data from find_word.php response
 * @param {string} responseText - Newline-delimited response from find_word.php
 * @param {Object} elements - DOM elements to populate
 * @returns {number} The word ID for score submission
 */
function processQuestionResponse(responseText, elements) {
    // Response format (newline-delimited):
    // 0: word_id
    // 1: word (source language)
    // 2: meaning (target language)
    // 3: part of speech
    // 4: comment
    // 5: example
    // 6: pronunciation
    // 7: hint
    // 8: tags (optional)

    // reverse + pops is probably faster than shifts
    const wordData = responseText.split('\n').reverse()

    const wordId = Number(wordData.pop())
    const word = wordData.pop()
    const meaning = wordData.pop()
    const partOfSpeech = wordData.pop()
    const comment = wordData.pop()
    const example = wordData.pop()
    const pronunciation = wordData.pop()
    const hint = wordData.pop()
    // tags = wordData.pop()

    // Arabic is answered with the transcription of the pronunciation, as in
    // so that no Arabic keyboard is needed.
    const correctAnswer = getAnswerField(elements.language) === "pronunciation"
        ? pronunciation
        : meaning

    // Populate DOM elements
    if (elements.wordElems && elements.wordElems.length > 0) {
        for (let i = 0; i < elements.wordElems.length; i++) {
            elements.wordElems[i].innerHTML = word;
        }
    }
    if (elements.meaningElem) elements.meaningElem.innerHTML = correctAnswer;
    if (elements.partOfSpeechElem) elements.partOfSpeechElem.innerHTML = partOfSpeech;
    if (elements.commentElem) elements.commentElem.innerHTML = comment;
    if (elements.exampleElem) elements.exampleElem.innerHTML = example;
    if (elements.pronunciationElem) elements.pronunciationElem.innerHTML = '[' + pronunciation + ']';
    if (elements.hintElem) elements.hintElem.innerHTML = hint;
    // When the pronunciation is the expected answer, the translation is not
    // shown anywhere else, so the answer block makes up for it.
    if (elements.translationElem) {
        const hasTranslation =
            elements.language === "ar" && meaning !== "";
        elements.translationElem.innerHTML = meaning;
        elements.translationElem.hidden = !hasTranslation;
    }

    return wordId;
}

// ============================================================================
// Quiz State Management
// ============================================================================

/**
 * Creates a quiz state manager with adaptive list sizing
 * @returns {Object} Quiz state object with methods
 */
function createQuizState() {
    return {
        listSizeLimit: 15, // Initial list size - TODO init as max(1, count) where count is the size of the list
        askedInThisSession: 0,
        wordId: -1,
        correct: false,

        /**
         * Update list size based on whether last answer was correct
         * This implements an adaptive algorithm that expands the question pool
         * when answers are correct and contracts it when they're wrong
         */
        updateListSize() {
            const sizeIncrement = this.listSizeLimit / ++this.askedInThisSession;
            this.listSizeLimit = this.correct ?
                this.listSizeLimit + Math.max(1, sizeIncrement) :
                Math.max(1, this.listSizeLimit - 2 / 3 * sizeIncrement);
        },

        /**
         * Reset for new question
         */
        resetForNewQuestion() {
            this.correct = false;
        }
    };
}

// ============================================================================
// Exports (for module systems, otherwise global)
// ============================================================================

// Check if we're in a module environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        applyLanguageInstruction,
        checkAnswer,
        collectQuizElements,
        createQuizState,
        getAnswerField,
        processQuestionResponse,
    };
}
