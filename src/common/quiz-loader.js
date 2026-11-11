// Loads the shared quiz scripts in the order they depend on each other.

/**
 * Load everything a quiz screen needs, then start it.
 *
 * The order matters: `language_utils.js` and `text-utils.js` declare globals
 * that `quiz-logic.js` calls, and the tag filter is only needed by this screen.
 * Each script is appended once the previous one has loaded, so the browser
 * cannot run them out of order.
 * @param {Function} onReady - Called once the quiz modules are in place
 */
function loadQuizModules(onReady) {
    const sources = [
        "common/language_utils.js",
        "common/text-utils.js",
        "common/quiz-logic.js",
        "common/quiz-tag-filter.js",
    ];

    const loadNext = (index) => {
        if (index === sources.length) {
            onReady();
            return;
        }
        const script = document.createElement("script");
        script.src = sources[index];
        script.onload = () => loadNext(index + 1);
        document.head.appendChild(script);
    };

    loadNext(0);
}
