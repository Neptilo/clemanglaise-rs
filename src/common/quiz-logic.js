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
              numbersToAccents: globalThis.numbersToAccents,
              separatePinyin: globalThis.separatePinyin,
              standardizeArabicAnswer: globalThis.standardizeArabicAnswer,
              standardizeJapaneseAnswer: globalThis.standardizeJapaneseAnswer,
              standardizeString: globalThis.standardizeString,
              stripArabicAnswerPunctuation:
                  globalThis.stripArabicAnswerPunctuation,
          };

/**
 * Languages the quiz answers with the pronunciation instead of the
 * translation. All three are written outside the Latin alphabet but have a
 * Latin transcription a player can type without a native keyboard: Japanese
 * rōmaji, Chinese pinyin and the Arabic DIN 31635 transcription.
 */
const PRONUNCIATION_LANGUAGES = ["ar", "ja", "zh"];

/**
 * Field a quiz answer is compared against: the pronunciation for the languages
 * above, the translation for every other language.
 * @param {string} language - Target language code, e.g. "ar"
 * @returns {string} "pronunciation" or "meaning"
 */
function getAnswerField(language) {
    return PRONUNCIATION_LANGUAGES.includes(language)
        ? "pronunciation"
        : "meaning";
}

/**
 * Bracket a pronunciation the way this language is written. The languages
 * answered with a pronunciation are the ones transcribed rather than written in
 * the International Phonetic Alphabet, so their transcription goes between
 * slashes: `/kabīr/`. Everything else is an IPA reading and keeps brackets.
 * @param {string} pronunciation - The stored pronunciation
 * @param {string} [language] - Target language code
 * @returns {string} The pronunciation with its brackets
 */
function formatPronunciation(pronunciation, language) {
    const brackets = PRONUNCIATION_LANGUAGES.includes(language)
        ? `/${pronunciation}/`
        : `[${pronunciation}]`;
    // The template holds no separator of its own, so a word without a
    // pronunciation leaves no dangling punctuation behind.
    return `: ${brackets}`;
}

/**
 * Display name of a target language. `language_utils.js` declares the lookup
 * table as a global and loads before this module in both entry scripts; under
 * Node (unit tests) it is absent, so the code itself stands in for the name.
 * @param {string} language - Target language code, e.g. "ar"
 * @returns {string} The language name, or the code when it is unknown
 */
function languageDisplayName(language) {
    return typeof getLanguageName === "function"
        ? getLanguageName(language)
        : language;
}

/**
 * How the pronunciation is written for a language, as the prompt names it.
 * Japanese and Chinese call it by name; Arabic has no short name for its
 * transcription, so it says ASCII, which is what the player types.
 */
const TRANSCRIPTION_NAMES = { ar: "ASCII", ja: "rōmaji", zh: "pinyin" };

/**
 * Show the quiz prompt matching the language: the shared template carries the
 * translation prompt (visible) and the pronunciation prompt (hidden), and the
 * two swap when the target language asks for the pronunciation.
 *
 * Both prompts name their target language and the transcription expected, so
 * the player knows what is asked before answering.
 * @param {string} language - Target language code, e.g. "ar"
 */
function applyLanguageInstruction(language) {
    const languageName = languageDisplayName(language);
    const targetLanguageElem = document.getElementById("target-language");
    if (targetLanguageElem) targetLanguageElem.textContent = languageName;

    if (getAnswerField(language) !== "pronunciation") return;

    const pronunciationLanguageElem = document.getElementById(
        "pronunciation-language"
    );
    if (pronunciationLanguageElem) {
        pronunciationLanguageElem.textContent = languageName;
    }
    const transcriptionElem = document.getElementById("transcription-name");
    if (transcriptionElem) {
        transcriptionElem.textContent = TRANSCRIPTION_NAMES[language] ?? "";
    }

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
 * Normalisation applied to a stored answer, per language. The player's answer
 * goes through the same table, so the two sides can never drift apart. Arabic
 * is the one exception: a typed answer is ASCII and needs transcribing first,
 * while the stored form is already DIN 31635 (see `standardizePlayerAnswer`).
 */
const STORED_ANSWER_NORMALISERS = {
    ar: (answer) =>
        textUtils.stripArabicAnswerPunctuation(
            textUtils.standardizeArabicAnswer(answer)
        ),
    ja: (answer) => textUtils.standardizeJapaneseAnswer(answer),
    zh: (answer) =>
        textUtils.separatePinyin(answer.toLowerCase()),
};

/**
 * Normalise an answer typed by the player, so that the keyboard form and the
 * stored form can be compared. Arabic is transcribed ASCII → DIN 31635 and
 * keeps its diacritics; Japanese folds long-vowel marks and separators away;
 * Chinese has its tone numbers turned into tone marks; every other language is
 * entity-decoded, diacritic-folded and lowercased.
 * @param {string} answer - The answer as typed
 * @param {string} [language] - Target language code
 * @returns {string} The normalised answer
 */
function standardizePlayerAnswer(answer, language) {
    if (language === "ar") {
        return STORED_ANSWER_NORMALISERS.ar(
            textUtils.asciiToDin(answer, false)
        );
    }
    // Chinese tone numbers are part of the typed form, so they are converted
    // before the shared normalisation spaces the syllables.
    if (language === "zh") {
        return STORED_ANSWER_NORMALISERS.zh(
            textUtils.numbersToAccents(answer.toLowerCase())
        );
    }
    return standardizeTypedAnswer(answer, language);
}

/**
 * Normalise one stored answer the same way the player's is.
 * @param {string} answer - One entry of the stored answer list
 * @param {string} [language] - Target language code
 * @returns {string} The normalised answer
 */
function standardizeStoredAnswer(answer, language) {
    return standardizeTypedAnswer(answer, language);
}

/**
 * The half the two forms share: a language-specific normaliser when the
 * language has one, and the default text normalisation otherwise.
 * @param {string} answer - An answer, typed or stored
 * @param {string} [language] - Target language code
 * @returns {string} The normalised answer
 */
function standardizeTypedAnswer(answer, language) {
    const normalise = STORED_ANSWER_NORMALISERS[language];
    return normalise ? normalise(answer) : textUtils.standardizeString(answer);
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
    const standardizedAnswer = standardizePlayerAnswer(
        playerAnswer.trim(),
        language
    );

    // An empty answer must never count as correct. This matters for the
    // languages answered with a pronunciation: a word saved without one would
    // otherwise be "answered" by submitting an empty input.
    if (standardizedAnswer === "") return false;

    const correctAnswerList = correctAnswers
        .split(",")
        .map((answer) => standardizeStoredAnswer(answer.trim(), language));

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
        expectedAnswerElem: document.getElementById("expected-answer"),
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

    // The expected answer is the pronunciation for the languages that ask for
    // one, so that no native keyboard is needed.
    const correctAnswer = getAnswerField(elements.language) === "pronunciation"
        ? pronunciation
        : meaning

    // Populate DOM elements
    if (elements.wordElems && elements.wordElems.length > 0) {
        for (let i = 0; i < elements.wordElems.length; i++) {
            elements.wordElems[i].innerHTML = word;
        }
    }
    // The block is about the meaning: it fills the large left column. The
    // word's own script goes on the headline line with its pronunciation, so
    // nothing is printed twice.
    if (elements.meaningElem) elements.meaningElem.innerHTML = meaning;
    if (elements.partOfSpeechElem) elements.partOfSpeechElem.innerHTML = partOfSpeech;
    if (elements.commentElem) elements.commentElem.innerHTML = comment;
    if (elements.exampleElem) elements.exampleElem.innerHTML = example;
    // The answer the player's input is compared with: the pronunciation for the
    // languages that ask for one, the meaning otherwise. It is carried by a
    // hidden element, so the block can show the meaning without comparing
    // against it.
    if (elements.expectedAnswerElem) {
        elements.expectedAnswerElem.innerHTML = correctAnswer;
    }
    if (elements.pronunciationElem) {
        const hasPronunciation = pronunciation !== "";
        elements.pronunciationElem.textContent = hasPronunciation
            ? formatPronunciation(pronunciation, elements.language)
            : "";
        // A word with no pronunciation must not leave an empty pair of
        // brackets behind.
        elements.pronunciationElem.hidden = !hasPronunciation;
    }
    if (elements.hintElem) elements.hintElem.innerHTML = hint;

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
