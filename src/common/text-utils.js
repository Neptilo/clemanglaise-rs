/**
 * Pure text helpers shared by every client.
 *
 * These are transformations and nothing else: no DOM, no network, no state.
 * Keeping them here means the quiz and the word editor apply the same
 * normalisation to the same field.
 *
 * The lookup tables are module-private: a caller passes text to a conversion
 * function and never reaches into a table.
 */

/**
 * Replace all &#number; by the corresponding character, leaving the rest of
 * the text untouched.
 * @param {string} string - The string we want to handle
 */
function ampersandUnescape(string) {
    return string.replace(/&#(\d+);/g, (entity, code) =>
        String.fromCharCode(Number(code))
    );
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

// ============================================================================
// Arabic: ASCII transcription to DIN 31635
// ============================================================================

/**
 * Marker-to-letter map for the ASCII transcription of Arabic. Users without an
 * Arabic keyboard type these markers instead of Arabic script.
 */
const ASCII_DIN_MAP = {
    2: "ʾ",
    aa: "ā",
    th: "ṯ",
    j: "ǧ",
    7: "ḥ",
    H: "ḥ",
    kh: "ḫ",
    dh: "ḏ",
    sh: "š",
    S: "ṣ",
    D: "ḍ",
    T: "ṭ",
    Z: "ẓ",
    3: "ʿ",
    gh: "ġ",
    ii: "ī",
    uu: "ū",
};

// One phoneme at a time: optional leading punctuation, then "aa", "ii", "uu",
// or a letter/digit optionally followed by "h". Letters and digits are matched
// as Unicode so that a string already in DIN 31635 passes through unchanged
// (ASCII `\w` would drop "ī" and friends).
const ASCII_DIN_PHONEME = /([^\p{L}\p{N}_]*)(aa|ii|uu|[\p{L}\p{N}_]h?)/gu;

/**
 * Convert an ASCII transcription of Arabic into DIN 31635, so that an answer
 * typed on a Latin keyboard can be compared with the stored pronunciation.
 * @param {string} string - The ASCII transcription
 * @param {boolean} keepPunctuation - Keep punctuation and unmatched characters.
 *   Set to false for a player answer, which is compared phoneme by phoneme.
 * @returns {string} The DIN 31635 transcription
 */
function asciiToDin(string, keepPunctuation = true) {
    const regex = new RegExp(ASCII_DIN_PHONEME.source, "gu");
    let result = "";
    let pos = 0;
    let match;

    while ((match = regex.exec(string)) !== null) {
        const punctuation = match[1];
        const phoneme = match[2];
        if (keepPunctuation) result += punctuation;

        // A word that starts with a vowel gets a hamza.
        const startsWord = match.index === 0 || punctuation !== "";
        if (startsWord && "aiuā".includes(phoneme[0])) result += "ʾ";

        result += Object.prototype.hasOwnProperty.call(ASCII_DIN_MAP, phoneme)
            ? ASCII_DIN_MAP[phoneme]
            : phoneme;

        pos = regex.lastIndex; // Move to the end of the match
    }

    // Append any remaining characters after the last match
    if (keepPunctuation && pos < string.length) result += string.slice(pos);

    return result;
}

// Only letters, digits, a hamza (ʾ) and an ayn (ʿ) count as part of an Arabic
// answer.
const ARABIC_ANSWER_PUNCTUATION = /[^\p{L}\dʾʿ]/gu;

/**
 * Normalise an Arabic answer without touching its diacritics: "kabiir" becomes
 * "kabīr", which must only match the stored DIN transcription, not "kabir".
 */
function standardizeArabicAnswer(string) {
    return ampersandUnescape(string).toLowerCase();
}

/**
 * Strip everything that is not part of an Arabic answer: every character that
 * is not a letter, a digit, a hamza or an ayn. Kept here so the character class
 * stays private to this module.
 * @param {string} string - A standardised Arabic answer
 * @returns {string} The answer without punctuation
 */
function stripArabicAnswerPunctuation(string) {
    return string.replace(ARABIC_ANSWER_PUNCTUATION, "");
}

/**
 * Normalise a pronunciation before it is stored. Arabic is stored in
 * DIN 31635, so that a pronunciation typed in ASCII can still be matched by a
 * quiz answer typed in ASCII. Other languages are stored exactly as typed.
 * @param {string} pronunciation - The pronunciation as entered in the editor
 * @param {string} language - Target language code, e.g. "ar"
 * @returns {string} The pronunciation to store
 */
function normalizePronunciationForSave(pronunciation, language) {
    if (language !== "ar" || !pronunciation) return pronunciation;
    return asciiToDin(pronunciation, true);
}

// ============================================================================
// Exports (for module systems, otherwise global)
// ============================================================================

// Check if we're in a module environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ampersandUnescape,
        asciiToDin,
        normalizePronunciationForSave,
        removeDiacritics,
        standardizeArabicAnswer,
        standardizeString,
        stripArabicAnswerPunctuation,
    };
}
