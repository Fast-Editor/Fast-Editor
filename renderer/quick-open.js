// Quick Open / Go to File
let allFiles = [];
let filteredFiles = [];
let selectedIndex = 0;

// Initialize quick open
function initQuickOpen() {
  const overlay = document.getElementById('quick-open-overlay');
  const input = document.getElementById('quick-open-input');
  const results = document.getElementById('quick-open-results');

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hideQuickOpen();
    }
  });

  // Input event - search files
  input.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    filterFiles(query);
    renderResults();
  });

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      hideQuickOpen();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filteredFiles.length - 1);
      renderResults();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      renderResults();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredFiles[selectedIndex]) {
        openSelectedFile();
      }
    }
  });

  // Handle item clicks
  results.addEventListener('click', (e) => {
    const item = e.target.closest('.quick-open-item');
    if (item) {
      const index = parseInt(item.dataset.index);
      selectedIndex = index;
      openSelectedFile();
    }
  });

  // Global keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault();
      showQuickOpen();
    }
  });

  // Menu event listener
  window.api.onMenuGotoFile(() => {
    showQuickOpen();
  });
}

// Show quick open
async function showQuickOpen() {
  if (!currentWorkspacePath) {
    alert('Please open a folder first');
    return;
  }

  const overlay = document.getElementById('quick-open-overlay');
  const input = document.getElementById('quick-open-input');

  // Collect all files from workspace
  await collectAllFiles();

  // Reset state
  input.value = '';
  selectedIndex = 0;
  filteredFiles = [...allFiles];

  // Show overlay
  overlay.classList.remove('hidden');
  input.focus();

  // Render initial results
  renderResults();
}

// Hide quick open
function hideQuickOpen() {
  const overlay = document.getElementById('quick-open-overlay');
  overlay.classList.add('hidden');
  allFiles = [];
  filteredFiles = [];
  selectedIndex = 0;
}

// Collect all files recursively from workspace
async function collectAllFiles() {
  allFiles = [];
  await collectFilesRecursive(currentWorkspacePath);
}

// Recursive file collector
async function collectFilesRecursive(dirPath) {
  try {
    const entries = await window.api.readDirectory(dirPath);

    for (const entry of entries) {
      // Skip hidden files and common ignore patterns
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__') {
        continue;
      }

      if (entry.isFile) {
        // Calculate relative path for display
        const relativePath = entry.path.substring(currentWorkspacePath.length + 1);
        allFiles.push({
          name: entry.name,
          path: entry.path,
          relativePath: relativePath
        });
      } else if (entry.isDirectory) {
        // Recursively collect from subdirectories
        await collectFilesRecursive(entry.path);
      }
    }
  } catch (error) {
    console.error('Error collecting files:', error);
  }
}

// Filter files based on search query (fuzzy matching)
function filterFiles(query) {
  if (!query) {
    filteredFiles = [...allFiles];
    selectedIndex = 0;
    return;
  }

  filteredFiles = allFiles
    .map(file => {
      const score = fuzzyMatch(query, file.name.toLowerCase());
      return { ...file, score };
    })
    .filter(file => file.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50); // Limit to 50 results for performance

  selectedIndex = 0;
}

// Simple fuzzy matching algorithm
function fuzzyMatch(query, text) {
  let score = 0;
  let queryIndex = 0;
  let lastMatchIndex = -1;

  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (text[i] === query[queryIndex]) {
      score += 1;

      // Bonus for consecutive matches
      if (lastMatchIndex === i - 1) {
        score += 5;
      }

      // Bonus for match at start
      if (i === 0) {
        score += 10;
      }

      lastMatchIndex = i;
      queryIndex++;
    }
  }

  // Return 0 if not all characters matched
  if (queryIndex !== query.length) {
    return 0;
  }

  // Bonus for shorter filenames (prefer closer matches)
  score += Math.max(0, 50 - text.length);

  return score;
}

// Highlight matching characters
function highlightMatches(text, query) {
  if (!query) return text;

  let result = '';
  let queryIndex = 0;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  for (let i = 0; i < text.length; i++) {
    if (queryIndex < lowerQuery.length && lowerText[i] === lowerQuery[queryIndex]) {
      result += `<span class="quick-open-match">${text[i]}</span>`;
      queryIndex++;
    } else {
      result += text[i];
    }
  }

  return result;
}

// Render search results
function renderResults() {
  const resultsEl = document.getElementById('quick-open-results');
  const input = document.getElementById('quick-open-input');
  const query = input.value.toLowerCase();

  if (filteredFiles.length === 0) {
    resultsEl.innerHTML = '<div class="quick-open-empty">No files found</div>';
    return;
  }

  resultsEl.innerHTML = filteredFiles.map((file, index) => {
    const isSelected = index === selectedIndex;
    const icon = getFileIcon(file.name);
    const highlightedName = highlightMatches(file.name, query);
    const pathParts = file.relativePath.split('/');
    const dirPath = pathParts.slice(0, -1).join('/');

    return `
      <div class="quick-open-item ${isSelected ? 'selected' : ''}" data-index="${index}">
        <div class="quick-open-item-icon">${icon}</div>
        <div class="quick-open-item-name">${highlightedName}</div>
        ${dirPath ? `<div class="quick-open-item-path">${dirPath}</div>` : ''}
      </div>
    `;
  }).join('');

  // Scroll selected item into view
  const selectedItem = resultsEl.querySelector('.quick-open-item.selected');
  if (selectedItem) {
    selectedItem.scrollIntoView({ block: 'nearest' });
  }
}

// Open selected file
async function openSelectedFile() {
  const file = filteredFiles[selectedIndex];
  if (!file) return;

  hideQuickOpen();

  // Hide welcome screen if visible
  if (typeof hideWelcomeScreen === 'function') {
    hideWelcomeScreen();
  }

  // Open file in editor
  await openFileInEditor(file.path);
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initQuickOpen);
} else {
  initQuickOpen();
}

// Export functions for use in other modules
window.showQuickOpen = showQuickOpen;
