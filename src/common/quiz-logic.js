/**
 * Handles:
 * - Processing quiz question responses from find_word.php
 * - Answer validation with diacritic normalization
 * - Quiz UI state management
 * - Adaptive list size algorithm
 */

// ============================================================================
// Text Processing & Answer Validation
// ============================================================================

/**
 * Replace all &#number; by corresponding ASCII letter
 * @param {string} string - The string we want to handle
 * @warn Untested. Might not work as expected
 */
function ampersandUnescape(string) {
    const rx0 = /[^&]*/;
    const rx = /&#(\\d*);([^&]*)/g;
    let res = '';
    let match = rx0.exec(string)
    if (match) {
        res += match[0]

        match = string.substr(match.index).matchAll(rx)
        for (let i = 0; i < match.length; i++) {
            res += String.fromCharCode(match[i][1]) + match[i][2]
        }
    }
    return res;
}

const diacriticLetters =
    "ÀÁÂÃÄÅĄÆÇĆÈÉÊËĘÌÍÎÏŁÑŃÒÓÔÕÖØŒŠŚÙÚÛÜÝŸŽŹŻ" +
    "àáâãäåąæçćèéêëęìíîïłñńòóôõöøœšśùúûüýÿžźż";

const noDiacriticLetters = [
    "A", "A", "A", "A", "A", "A", "A", "AE", "C", "C", "E", "E",
    "E", "E", "E", "I", "I", "I", "I", "L", "N", "N", "O", "O",
    "O", "O", "O", "O", "OE", "S", "S", "U", "U", "U", "U", "Y",
    "Y", "Z", "Z", "Z",
    "a", "a", "a", "a", "a", "a", "a", "ae", "c", "c", "e", "e",
    "e", "e", "e", "i", "i", "i", "i", "l", "n", "n", "o", "o",
    "o", "o", "o", "o", "oe", "s", "s", "u", "u", "u", "u", "y",
    "y", "z", "z", "z"]

function removeDiacritics(string) {
    let ret = "";
    for (let i = 0; i < string.length; i++) {
        let c = string[i];
        let dIndex = diacriticLetters.indexOf(c);
        ret += dIndex < 0 ? c : noDiacriticLetters[dIndex];
    }
    return ret;
}

function standardizeString(string) {
    return removeDiacritics(ampersandUnescape(string)).toLowerCase();
}

/**
 * Check if player's answer matches one of the correct answers
 * @param {string} playerAnswer - The answer provided by the player
 * @param {string} correctAnswers - Comma-separated list of correct answers
 * @returns {boolean} True if answer is correct
 */
function checkAnswer(playerAnswer, correctAnswers) {
    // remove whitespaces at start and end
    let standardizedAnswer = playerAnswer.trim();

    standardizedAnswer = standardizeString(standardizedAnswer);
    correctAnswers = standardizeString(correctAnswers);

    let correctAnswerList = correctAnswers.split(",");

    // remove whitespaces at start and end of each element in the list
    for (let i = 0; i < correctAnswerList.length; ++i)
        correctAnswerList[i] = correctAnswerList[i].trim();

    return correctAnswerList.includes(standardizedAnswer);
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
    // 2: meaning (target language / correct answer)
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

    // Populate DOM elements
    if (elements.wordElems && elements.wordElems.length > 0) {
        for (let i = 0; i < elements.wordElems.length; i++) {
            elements.wordElems[i].innerHTML = word;
        }
    }
    if (elements.meaningElem) elements.meaningElem.innerHTML = meaning;
    if (elements.partOfSpeechElem) elements.partOfSpeechElem.innerHTML = partOfSpeech;
    if (elements.commentElem) elements.commentElem.innerHTML = comment;
    if (elements.exampleElem) elements.exampleElem.innerHTML = example;
    if (elements.pronunciationElem) elements.pronunciationElem.innerHTML = '[' + pronunciation + ']';
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
        checkAnswer,
        processQuestionResponse,
        createQuizState,
        standardizeString,
        removeDiacritics,
        ampersandUnescape
    };
}
