// Shared JavaScript for rendering vocabulary test buttons
function renderVocabTests(tests, quizPage = 'quiz.php') {
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
    a.href = `${quizPage}?list_id=${test.id}&dst=${encodeURIComponent(test.dst)}`;
    a.textContent = test.name;
    
    li.appendChild(a);
    testButtonsContainer.appendChild(li);
  });
  
  // Trigger grid layout if available
  if (typeof onresize === 'function') {
    onresize();
  }
}
