// Load shared modules
const languageUtilsScript = document.createElement('script');
languageUtilsScript.src = 'common/language_utils.js';
languageUtilsScript.onload = () => {
    const targetLanguageElem = document.getElementById('target-language');
    if (targetLanguageElem) {
        const dstCode = getUrlParameter('dst');
        if (dstCode) {
            targetLanguageElem.textContent = getLanguageName(dstCode);
        }
    }
};
document.head.appendChild(languageUtilsScript);

const quizLogicScript = document.createElement('script');
quizLogicScript.src = 'common/quiz-logic.js';
quizLogicScript.onload = initQuiz;
document.head.appendChild(quizLogicScript);

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

let quizState;

function initQuiz() {
    // Create quiz state using shared module
    quizState = createQuizState();

    async function loadNewQuestion() {
        try {
            const responseText = await window.__TAURI__.core.invoke('fetch_quiz_question', {
                listId: listId,
                listSizeLimit: quizState.listSizeLimit
            });
            
            quizState.wordId = processQuestionResponse(responseText, {
                wordElems,
                meaningElem: correctTranslationElem,
                partOfSpeechElem,
                commentElem,
                exampleElem,
                pronunciationElem,
                hintElem
            });
        } catch (error) {
            console.error('Error fetching question:', error);
        }
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

    validateQuestionButton.onclick = async () => {
        quizState.correct = checkAnswer(input.value, correctTranslationElem.innerHTML);
        message.innerHTML = quizState.correct ? '<b style="color:green;">Correct!</b>' :
                                      '<b style="color:red;">Wrong!</b>'

        correctEntryElem.removeAttribute('hidden');

        // set score without changing page
        try {
            await window.__TAURI__.core.invoke('submit_quiz_answer', {
                correct: quizState.correct,
                wordId: quizState.wordId
            });
        } catch (error) {
            console.error('Error submitting answer:', error);
        }
    }

    validateAnswerButton.onclick = () => {
        // clear everything
        correctEntryElem.setAttribute('hidden', '');
        input.value = ''

        // update list size depending on whether the last answer was correct
        quizState.updateListSize();

        loadNewQuestion()
    }
}