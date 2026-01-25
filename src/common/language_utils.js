// Common language utilities for both web and Tauri versions

const LANGUAGE_NAMES = {
  'en': 'English',
  'fr': 'French',
  'hr': 'Croatian',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'es': 'Spanish',
  'de': 'German',
  'ru': 'Russian',
  'ca': 'Catalan',
  'ar': 'Arabic',
  'pt': 'Portuguese',
  'tr': 'Turkish',
  'pl': 'Polish',
  'sl': 'Slovenian',
  'it': 'Italian'
};

function getLanguageName(code) {
  return LANGUAGE_NAMES[code] ?? code;
}

function getUrlParameter(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}
