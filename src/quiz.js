// Load shared modules
const dstCode = new URLSearchParams(window.location.search).get('dst') || '';

const quizLoader = document.createElement('script');
quizLoader.src = 'common/quiz-loader.js';
quizLoader.onload = () => loadQuizModules(() => {
    quizElements = collectQuizElements();
    correctAnswerElem = quizElements.expectedAnswerElem;
    applyLanguageInstruction(dstCode);
    initQuiz();
});
document.head.appendChild(quizLoader);

// get constant DOM elements
// The element map comes from the shared module, which this script loads
// asynchronously, so it is filled once that module is ready.
let quizElements;
let correctAnswerElem;
const input = document.getElementById('input');
const validateQuestionButton = document.getElementById(
    'validate-question-button',
);
const validateAnswerButton = document.getElementById('validate-answer-button');
const correctEntryElem = document.getElementById('answer');
const message = document.getElementById('message');
const tagFilter = document.getElementById('tag-filter');

const params = new URLSearchParams(window.location.search);
const listId = Number(params.get('list_id'));
const remote = params.get('remote') !== 'false';

let quizState;
let selectedTags = [];
let loadNewQuestion;

async function initQuiz() {
    quizState = createQuizState();
    const editorParams = `list_id=${listId}&remote=${remote}`;
    // The template ships this button hidden; this screen is the only place
    // that enables it, because the main menu belongs to this navigation.
    const backToMenuButton = document.getElementById('back-to-menu');
    backToMenuButton.hidden = false;
    backToMenuButton.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    const addWordLink = document.getElementById('add-word-link');
    const editCurrentWordButton = document.getElementById('edit-current-word');
    addWordLink.href = `edit.html?${editorParams}&mode=add`;
    addWordLink.title = 'Add a word';
    addWordLink.setAttribute('aria-label', 'Add a word');
    const authSession = window.ClemAuth.getSharedAuthSession();
    addWordLink.hidden = true;
    editCurrentWordButton.hidden = true;
    const updateWordActions = (status) => {
        const canManageWords =
            !remote ||
            (status.isLoggedIn && status.username === 'clemanglaise_admin');
        const wordId = Number(quizState.wordId);
        const hasWord = Number.isInteger(wordId) && wordId > 0;
        addWordLink.hidden = !canManageWords;
        editCurrentWordButton.hidden = !canManageWords || !hasWord;
    };
    updateWordActions(await authSession.getStatus({ forceRefresh: true }));
    authSession.onChange(updateWordActions);
    editCurrentWordButton.addEventListener('click', () => {
        const wordId = Number(quizState.wordId);
        if (!Number.isInteger(wordId) || wordId <= 0) {
            document.getElementById('edit-current-word').title =
                'No current word to edit';
            return;
        }
        window.location.href = `edit.html?${editorParams}&mode=edit&word_id=${wordId}`;
    });

    loadNewQuestion = async function () {
        try {
            const responseText = await window.__TAURI__.core.invoke(
                'fetch_quiz_question',
                {
                    listId: listId,
                    listSizeLimit: quizState.listSizeLimit,
                    remote: remote,
                    selectedTags: selectedTags,
                },
            );

            quizState.wordId = processQuestionResponse(responseText, {
                ...quizElements,
                language: dstCode,
            });
            updateWordActions(await authSession.getStatus());
        } catch (error) {
            console.error('Error fetching question:', error);
        }
    };

    installQuizTagFilter({
        container: tagFilter,
        fetchTags: async () =>
            remote
                ? await window.__TAURI__.core.invoke('fetch_remote_quiz_tags', {
                      listId,
                  })
                : await window.__TAURI__.core.invoke('fetch_quiz_tags', {
                      listId,
                  }),
        onSelectionChange: (tags) => {
            selectedTags = tags;
            if (loadNewQuestion) loadNewQuestion();
        },
    });
    loadNewQuestion();

    input.addEventListener('keypress', function (event) {
        // If the user presses the "Enter" key on the keyboard
        if (event.key === 'Enter') {
            // Cancel the default action, if needed
            event.preventDefault();
            if (correctEntryElem.hasAttribute('hidden'))
                validateQuestionButton.click();
            else validateAnswerButton.click();
        }
    });

    validateQuestionButton.onclick = async () => {
        quizState.correct = checkAnswer(
            input.value,
            correctAnswerElem.innerHTML,
            dstCode,
        );
        message.innerHTML = quizState.correct
            ? '<b style="color:green;">Correct!</b>'
            : '<b style="color:red;">Wrong!</b>';

        // One OK button at a time: the one next to the field goes away and the
        // answer's own button takes over.
        setAnswerVisible(true);

        // set score without changing page
        try {
            await window.__TAURI__.core.invoke('submit_quiz_answer', {
                correct: quizState.correct,
                wordId: quizState.wordId,
                remote: remote,
            });
        } catch (error) {
            console.error('Error submitting answer:', error);
        }
    };

    validateAnswerButton.onclick = () => {
        // clear everything
        setAnswerVisible(false);
        input.value = '';

        // update list size depending on whether the last answer was correct
        quizState.updateListSize();

        loadNewQuestion();
    };
}
