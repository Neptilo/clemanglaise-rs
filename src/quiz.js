// get constant DOM elements
const wordElems = document.getElementsByClassName('word')
const partOfSpeechElem = document.getElementById('part-of-speech')
const pronunciationElem = document.getElementById('pronunciation')
const commentElem = document.getElementById('comment')
const exampleElem = document.getElementById('example')
const hintElem = document.getElementById('hint')
const input = document.getElementById('input')
const validateQuestionButton = document.getElementById('validate-question-button')
const validateAnswerButton = document.getElementById('validate-answer-button')
const correctEntryElem = document.getElementById('answer')
const correctTranslationElem = document.getElementById('meaning')
const message = document.getElementById('message')

const listId = Number(new URLSearchParams(window.location.search).get('list_id'))

let listSizeLimit = 15; // TODO init as max(1, count) where count is the size of the list
let askedInThisSession = 0;
let wordId = -1;
let correct = false;

function loadNewQuestion() {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
        if (xhr.readyState !== xhr.DONE || xhr.status !== 200)
            return;

        // reverse + pops is probably faster than shifts
        const wordData = xhr.responseText.split('\n').reverse()

        wordId = Number(wordData.pop())
        wordElems[0].innerHTML = wordElems[1].innerHTML = wordData.pop()
        correctTranslationElem.innerHTML = wordData.pop()
        partOfSpeechElem.innerHTML = wordData.pop()
        commentElem.innerHTML = wordData.pop()
        exampleElem.innerHTML = wordData.pop()
        pronunciationElem.innerHTML = '[' + wordData.pop() + ']'
        hintElem.innerHTML = wordData.pop()
        // tags = wordData.pop()
    }
    xhr.open("GET", 'https://localhost/languages/clemanglaise/find_word.php?' +
        'list_id=' + listId +
        '&list_size_limit=' + listSizeLimit);
    xhr.send();
}

loadNewQuestion()

input.addEventListener("keypress", function(event) {
    // If the user presses the "Enter" key on the keyboard
    if (event.key === "Enter") {
        // Cancel the default action, if needed
        event.preventDefault();
        if (correctEntryElem.hasAttribute('hidden'))
            validateQuestionButton.click();
        else
            validateAnswerButton.click();
    }
});

validateQuestionButton.onclick = () => {
    correct = checkAnswer(input.value, correctTranslationElem.innerHTML);
    message.innerHTML = correct ? '<b style="color:green;">Correct!</b>' :
                                  '<b style="color:red;">Wrong!</b>'

    correctEntryElem.removeAttribute('hidden');

    // set score without changing page
    const xhr = new XMLHttpRequest();
    xhr.open("POST", 'set_score.php');
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded"); // useful?
    xhr.send("correct=" + Number(correct) + "&word_id=" + wordId);
}

validateAnswerButton.onclick = () => {
    // clear everything
    correctEntryElem.setAttribute('hidden', '');
    input.value = ''

    // update list size depending on whether the last answer was correct
    const sizeIncrement = listSizeLimit / ++askedInThisSession;
    listSizeLimit = correct ?
        listSizeLimit + Math.max(1, sizeIncrement) :
        Math.max(1, listSizeLimit - 2 / 3 * sizeIncrement);

    loadNewQuestion()
}

/**
 * replace all &#number; by corresponding ascii letter
 * @par string: the string we want to handle
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