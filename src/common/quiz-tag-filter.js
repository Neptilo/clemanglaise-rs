function installQuizTagFilter({ container, fetchTags, onSelectionChange, labels = {} }) {
    if (!container) return Promise.resolve();
    // The panel closes when a click lands outside it, and only then: choosing a
    // tag must leave it open so several can be picked in a row. Focus cannot
    // stand in for that, because clicking a label's text does not move focus to
    // its checkbox in every browser, and a focus-based rule closes the panel on
    // the very click that was choosing a tag.
    document.addEventListener('pointerdown', event => {
        if (!container.contains(event.target)) container.open = false;
    });

    return Promise.resolve()
        .then(fetchTags)
        .then(tags => {
            const options = container.querySelector('#tag-filter-options');
            options.replaceChildren();
            const addOption = (id, name) => {
                const label = document.createElement('label');
                label.className = 'tag-filter-option';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = String(id);
                checkbox.addEventListener('change', () => {
                    const selected = Array.from(options.querySelectorAll('input:checked'), item => Number(item.value));
                    onSelectionChange(selected);
                });
                label.append(checkbox, document.createTextNode(name));
                options.appendChild(label);
            };
            addOption(0, labels.untagged || 'Without any tags');
            for (const tag of tags) addOption(tag.id, tag.name);
        })
        .catch(error => {
            console.error('Error fetching quiz tags:', error);
            container.hidden = true;
        });
}
