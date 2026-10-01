function installQuizTagFilter({ container, fetchTags, onSelectionChange, labels = {} }) {
    if (!container) return Promise.resolve();
    container.addEventListener('focusout', event => {
        if (!container.contains(event.relatedTarget)) container.open = false;
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
