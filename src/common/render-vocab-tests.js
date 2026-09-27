// Shared JavaScript for rendering vocabulary test buttons

function countryCodeToFlagImageUrl(code) {
  if (!code || code.length !== 2) return '';
  const normalized = code.toLowerCase();
  return `https://flagcdn.com/w80/${normalized}.png`;
}

function renderVocabTests(tests, quizPage = 'quiz.php', remote = true) {
  const testButtonsContainer = document.getElementById('test-buttons');
  
  if (!testButtonsContainer) {
    console.error('test-buttons element not found');
    return;
  }
  
  testButtonsContainer.innerHTML = '';
  
  if (tests.length === 0) {
    testButtonsContainer.innerHTML = '<p>No vocabulary lists available.</p>';
    return;
  }
  
  tests.forEach(test => {
    const li = document.createElement('li');
    li.classList.add('tile');
    
    const a = document.createElement('a');
    a.classList.add('language-button');
    a.href = `${quizPage}?list_id=${test.id}&dst=${encodeURIComponent(test.dst)}&remote=${remote}`;

    if (test.flag) {
      const flagImageUrl = countryCodeToFlagImageUrl(test.flag);
      if (flagImageUrl) {
        const flagDisc = document.createElement('span');
        flagDisc.classList.add('flag-icon-disc');

        const flagImage = document.createElement('img');
        flagImage.classList.add('flag-icon-image');
        flagImage.src = flagImageUrl;
        flagImage.alt = `${test.flag.toUpperCase()} flag`;
        flagImage.decoding = 'async';
        flagImage.loading = 'lazy';
        flagImage.referrerPolicy = 'no-referrer';
        flagDisc.appendChild(flagImage);
        a.appendChild(flagDisc);
      }
    }

    const nameSpan = document.createElement('span');
    nameSpan.classList.add('language-name');
    nameSpan.textContent = test.name;
    a.appendChild(nameSpan);
    
    li.appendChild(a);
    testButtonsContainer.appendChild(li);
  });
  
  // Trigger grid layout if available
  if (typeof onresize === 'function') {
    onresize();
  }

  updateFlagLayout();
}

function updateFlagLayout() {
  const landscape = window.innerWidth > window.innerHeight;
  document.querySelectorAll('.language-button').forEach(btn => {
    btn.classList.toggle('landscape', landscape);
    btn.classList.toggle('portrait', !landscape);
  });
}

// Re-apply flag layout on resize
(function () {
  const originalOnresize = window.onresize;
  window.onresize = function (event) {
    if (originalOnresize) originalOnresize(event);
    updateFlagLayout();
  };
})();
