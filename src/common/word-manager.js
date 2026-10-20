window.loadWordManagerTemplate = async function ({
    templateUrl,
    values = {},
    mount = document.body,
}) {
    const response = await fetch(templateUrl);
    if (!response.ok) {
        throw new Error(
            `Could not load word manager template (${response.status})`,
        );
    }

    let html = await response.text();
    for (const [key, value] of Object.entries(values)) {
        const escaped = String(value).replace(
            /[&<>"']/g,
            (char) =>
                ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;",
                })[char],
        );
        html = html.split(`{{${key}}}`).join(escaped);
    }

    if (/\{\{[A-Z_]+\}\}/.test(html)) {
        throw new Error("Unresolved word manager template placeholder.");
    }

    mount.innerHTML = html;
    closeDropdownsOnOutsideClick(mount);
};

// A <details> dropdown stays open when the user clicks elsewhere on the page,
// where it can then cover other controls. Close every open dropdown as soon as
// the user clicks (or focuses) outside it.
function closeDropdownsOnOutsideClick(root) {
    const closeAllOutside = (target) => {
        for (const dropdown of root.querySelectorAll("details[open]")) {
            if (!dropdown.contains(target)) dropdown.open = false;
        }
    };

    root.addEventListener("pointerdown", (event) => {
        closeAllOutside(event.target);
    });
    root.addEventListener("focusout", (event) => {
        closeAllOutside(event.relatedTarget);
    });
}
