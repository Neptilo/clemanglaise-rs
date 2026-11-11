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
 * Normalise a Japanese answer. The player types Hepburn rōmaji, which stores
 * and matches either with a macron ("kōkūbin") or with the vowel doubled
 * ("kookuubin"), so a macron is folded to its doubled vowel and both agree.
 * Every character that is not a Latin letter is dropped, which lets "futatsu"
 * and "fu-ta-tsu" agree.
 *
 * Only macrons appear in rōmaji, so only macrons are folded: an acute or grave
 * accent is not a long vowel and must not be read as one.
 * @param {string} string - A rōmaji answer
 * @returns {string} The answer without long-vowel marks or separators
 */
function standardizeJapaneseAnswer(string) {
    return ampersandUnescape(string)
        .toLowerCase()
        .replace(/ā/g, "aa")
        .replace(/ī/g, "ii")
        .replace(/ū/g, "uu")
        .replace(/ē/g, "ee")
        .replace(/ō/g, "oo")
        .replace(/\u2019|'/g, "")
        .replace(/[^a-z]/g, "");
}

// ============================================================================
// Chinese: pinyin with tone marks
// ============================================================================

// Tone marks per base vowel, indexed by tone number (0 keeps the plain vowel).
// "ü" is written "v", since a Latin keyboard has no ü key.
const PINYIN_ACCENTS = {
    a: ["a", "ā", "á", "ǎ", "à"],
    e: ["e", "ē", "é", "ě", "è"],
    i: ["i", "ī", "í", "ǐ", "ì"],
    o: ["o", "ō", "ó", "ǒ", "ò"],
    u: ["u", "ū", "ú", "ǔ", "ù"],
    v: ["ü", "ǖ", "ǘ", "ǚ", "ǜ"],
};

// Every vowel form a pinyin syllable may carry, tone marks included.
const PINYIN_VOWELS = "aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜv";

/**
 * One pinyin syllable: an optional initial, the nucleus vowel and an optional
 * coda, followed by an optional tone number and trailing punctuation.
 */
const PINYIN_SYLLABLE = new RegExp(
    `([bcdfgj-np-tw-z]?h?[iu]?)([${PINYIN_VOWELS}r])([iounr]?g?)(\\d?)(\\W*)`,
    "gi"
);

/**
 * Convert the tone numbers of a pinyin answer into tone marks, so "wen2hua4"
 * becomes "wénhuà". The number is optional, so a transcription written with
 * marks already passes through unchanged.
 * @param {string} string - A pinyin answer, with or without tone numbers
 * @param {string} separator - What to put between syllables; "" drops it
 * @returns {string} The answer with tone marks
 */
function numbersToAccents(string, separator = "") {
    let result = "";
    let separation = "";
    let match;
    PINYIN_SYLLABLE.lastIndex = 0;

    while ((match = PINYIN_SYLLABLE.exec(string)) !== null) {
        result += separation;
        const [, initial, nucleus, coda, number, trailing] = match;
        const tone = Number(number) || 0;
        const marked = PINYIN_ACCENTS[nucleus[0].toLowerCase()]?.[tone] ?? nucleus;
        // A tone mark belongs to the vowel, so its case follows the vowel's.
        result +=
            initial +
            (nucleus[0] === nucleus[0].toLowerCase()
                ? marked
                : marked.toUpperCase()) +
            coda;
        separation = separator === "" ? trailing : separator;
    }

    return result;
}

// Syllable shapes. The order is deliberate: "er" must match before a bare "e",
// a full syllable (including its coda) before a lone "r", and an apostrophe is
// a boundary to drop rather than a syllable.
const PINYIN_SEPARATION = new RegExp(
    `[${"eēéěè"}]r` + // "er" as a standalone syllable, before "e" alone
        `|[bcdfgj-np-tw-z]?h?[iu]?[${PINYIN_VOWELS}][iu]?(?:ng?(?![${PINYIN_VOWELS}]))?` + // a full syllable, including a coda
        `|r` + // a syllabic r left on its own
        `|'`, // an apostrophe separates, and is dropped
    "gi"
);

/**
 * Split a pinyin answer into its syllables, spaced the way a dictionary writes
 * them: "wénhuà" becomes "wén huà". A player may type the syllables joined,
 * spaced or apostrophised; the comparison then sees the same form either way.
 * @param {string} string - A pinyin answer
 * @param {string} separator - What to put between syllables
 * @returns {string} The syllables joined by the separator
 */
function separatePinyin(string, separator = " ") {
    const syllables = [];
    let match;
    PINYIN_SEPARATION.lastIndex = 0;

    while ((match = PINYIN_SEPARATION.exec(string)) !== null) {
        const syllable = match[0];
        // An apostrophe only marks a syllable boundary.
        if (syllable === "'") continue;
        syllables.push(syllable);
    }

    return syllables.join(separator);
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
        numbersToAccents,
        removeDiacritics,
        separatePinyin,
        standardizeArabicAnswer,
        standardizeJapaneseAnswer,
        standardizeString,
        stripArabicAnswerPunctuation,
    };
}
