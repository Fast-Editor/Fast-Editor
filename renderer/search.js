// Global Search and Replace across files
let searchResults = [];
let currentSearchQuery = '';
let searchInProgress = false;

// Search options
let searchOptions = {
  caseSensitive: false,
  wholeWord: false,
  useRegex: false
};

// Initialize search panel
function initSearchPanel() {
  const searchInput = document.getElementById('search-input');
  const replaceInput = document.getElementById('replace-input');
  const searchBtn = document.getElementById('search-btn');
  const replaceAllBtn = document.getElementById('replace-all-btn');
  const toggleReplaceBtn = document.getElementById('toggle-replace');
  const toggleCaseSensitiveBtn = document.getElementById('toggle-case-sensitive');
  const toggleWholeWordBtn = document.getElementById('toggle-whole-word');
  const toggleRegexBtn = document.getElementById('toggle-regex');

  // Search button
  if (searchBtn) {
    searchBtn.addEventListener('click', () => performSearch());
  }

  // Search on Enter key
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
      }
    });
  }

  // Toggle replace input
  if (toggleReplaceBtn) {
    toggleReplaceBtn.addEventListener('click', () => {
      const replaceContainer = document.getElementById('replace-container');
      if (replaceContainer) {
        const isHidden = replaceContainer.classList.contains('hidden');
        if (isHidden) {
          replaceContainer.classList.remove('hidden');
          toggleReplaceBtn.classList.add('active');
        } else {
          replaceContainer.classList.add('hidden');
          toggleReplaceBtn.classList.remove('active');
        }
      }
    });
  }

  // Replace all button
  if (replaceAllBtn) {
    replaceAllBtn.addEventListener('click', () => performReplaceAll());
  }

  // Toggle case sensitive
  if (toggleCaseSensitiveBtn) {
    toggleCaseSensitiveBtn.addEventListener('click', () => {
      searchOptions.caseSensitive = !searchOptions.caseSensitive;
      toggleCaseSensitiveBtn.classList.toggle('active', searchOptions.caseSensitive);
      // Re-search if there's a query
      if (currentSearchQuery) {
        performSearch();
      }
    });
  }

  // Toggle whole word
  if (toggleWholeWordBtn) {
    toggleWholeWordBtn.addEventListener('click', () => {
      searchOptions.wholeWord = !searchOptions.wholeWord;
      toggleWholeWordBtn.classList.toggle('active', searchOptions.wholeWord);
      // Re-search if there's a query
      if (currentSearchQuery) {
        performSearch();
      }
    });
  }

  // Toggle regex
  if (toggleRegexBtn) {
    toggleRegexBtn.addEventListener('click', () => {
      searchOptions.useRegex = !searchOptions.useRegex;
      toggleRegexBtn.classList.toggle('active', searchOptions.useRegex);
      // Re-search if there's a query
      if (currentSearchQuery) {
        performSearch();
      }
    });
  }

  // Keyboard shortcuts for toggles
  document.addEventListener('keydown', (e) => {
    if (e.altKey) {
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        toggleCaseSensitiveBtn?.click();
      } else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        toggleWholeWordBtn?.click();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        toggleRegexBtn?.click();
      }
    }
  });
}

// Perform search across all files
async function performSearch() {
  if (!currentWorkspacePath) {
    alert('Please open a folder first');
    return;
  }

  const searchInput = document.getElementById('search-input');
  const query = searchInput.value.trim();

  if (!query) {
    clearSearchResults();
    return;
  }

  if (searchInProgress) return;
  searchInProgress = true;

  currentSearchQuery = query;
  searchResults = [];

  // Show loading state
  const resultsContainer = document.getElementById('search-results');
  resultsContainer.innerHTML = '<div class="search-loading">Searching...</div>';

  // Collect all files and search
  const files = await collectAllFilesForSearch(currentWorkspacePath);

  for (const file of files) {
    await searchInFile(file, query);
  }

  // Display results
  displaySearchResults();
  searchInProgress = false;
}

// Collect all files recursively
async function collectAllFilesForSearch(dirPath) {
  const files = [];
  await collectFilesRecursiveForSearch(dirPath, files);
  return files;
}

async function collectFilesRecursiveForSearch(dirPath, files) {
  try {
    const entries = await window.api.readDirectory(dirPath);

    for (const entry of entries) {
      // Skip hidden files, node_modules, and binary files
      if (entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === '__pycache__' ||
          entry.name === 'dist' ||
          entry.name === 'build') {
        continue;
      }

      if (entry.isFile) {
        // Only search text files
        if (isTextFile(entry.name)) {
          files.push(entry);
        }
      } else if (entry.isDirectory) {
        await collectFilesRecursiveForSearch(entry.path, files);
      }
    }
  } catch (error) {
    console.error('Error collecting files:', error);
  }
}

// Check if file is a text file
function isTextFile(filename) {
  const textExtensions = [
    'js', 'jsx', 'ts', 'tsx', 'json', 'html', 'htm', 'css', 'scss', 'sass', 'less',
    'md', 'markdown', 'txt', 'xml', 'yaml', 'yml', 'toml', 'py', 'rb', 'php',
    'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'swift', 'kt', 'scala',
    'sh', 'bash', 'zsh', 'fish', 'sql', 'lua', 'r', 'vue', 'svelte', 'dart'
  ];

  const ext = filename.split('.').pop().toLowerCase();
  return textExtensions.includes(ext);
}

// Search in a single file
async function searchInFile(file, query) {
  try {
    const result = await window.api.readFile(file.path);
    if (!result) return;

    const content = result.content;
    const lines = content.split('\n');
    const matches = [];

    // Build search pattern based on options
    let searchPattern;
    if (searchOptions.useRegex) {
      try {
        const flags = searchOptions.caseSensitive ? 'g' : 'gi';
        searchPattern = new RegExp(query, flags);
      } catch (e) {
        // Invalid regex, fall back to literal search
        searchPattern = null;
        console.error('Invalid regex:', e);
      }
    } else {
      // Escape special regex characters for literal search
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let pattern = escapedQuery;

      // Whole word boundary
      if (searchOptions.wholeWord) {
        pattern = `\\b${pattern}\\b`;
      }

      const flags = searchOptions.caseSensitive ? 'g' : 'gi';
      searchPattern = new RegExp(pattern, flags);
    }

    if (!searchPattern) {
      // Fallback to simple search
      const compareQuery = searchOptions.caseSensitive ? query : query.toLowerCase();

      lines.forEach((line, lineIndex) => {
        const compareLine = searchOptions.caseSensitive ? line : line.toLowerCase();
        let index = compareLine.indexOf(compareQuery);

        while (index !== -1) {
          // Check whole word if needed
          if (searchOptions.wholeWord) {
            const before = index > 0 ? line[index - 1] : ' ';
            const after = index + query.length < line.length ? line[index + query.length] : ' ';
            const isWordBoundary = !/\w/.test(before) && !/\w/.test(after);

            if (!isWordBoundary) {
              index = compareLine.indexOf(compareQuery, index + 1);
              continue;
            }
          }

          matches.push({
            line: lineIndex + 1,
            column: index + 1,
            text: line,
            matchStart: index,
            matchEnd: index + query.length
          });

          index = compareLine.indexOf(compareQuery, index + 1);
        }
      });
    } else {
      // Regex search
      lines.forEach((line, lineIndex) => {
        let match;
        // Reset regex lastIndex for each line
        searchPattern.lastIndex = 0;

        while ((match = searchPattern.exec(line)) !== null) {
          matches.push({
            line: lineIndex + 1,
            column: match.index + 1,
            text: line,
            matchStart: match.index,
            matchEnd: match.index + match[0].length
          });

          // Prevent infinite loop for zero-width matches
          if (match.index === searchPattern.lastIndex) {
            searchPattern.lastIndex++;
          }
        }
      });
    }

    if (matches.length > 0) {
      const relativePath = file.path.substring(currentWorkspacePath.length + 1);
      searchResults.push({
        path: file.path,
        relativePath: relativePath,
        name: file.name,
        matches: matches
      });
    }
  } catch (error) {
    console.error('Error searching file:', error);
  }
}

// Display search results
function displaySearchResults() {
  const resultsContainer = document.getElementById('search-results');

  if (searchResults.length === 0) {
    resultsContainer.innerHTML = `<div class="search-empty">No results found for "${escapeHtml(currentSearchQuery)}"</div>`;
    return;
  }

  const totalMatches = searchResults.reduce((sum, file) => sum + file.matches.length, 0);

  let html = `<div class="search-summary">${totalMatches} result${totalMatches !== 1 ? 's' : ''} in ${searchResults.length} file${searchResults.length !== 1 ? 's' : ''}</div>`;

  searchResults.forEach(file => {
    html += `
      <div class="search-file-group">
        <div class="search-file-header" data-path="${file.path}">
          <span class="search-file-icon">${getFileIcon(file.name)}</span>
          <span class="search-file-name">${escapeHtml(file.name)}</span>
          <span class="search-file-path">${escapeHtml(file.relativePath.substring(0, file.relativePath.length - file.name.length))}</span>
          <span class="search-match-count">${file.matches.length}</span>
        </div>
        <div class="search-matches">
          ${file.matches.map(match => `
            <div class="search-match-item" data-path="${file.path}" data-line="${match.line}" data-column="${match.column}">
              <span class="search-match-line">${match.line}:</span>
              <span class="search-match-text">${highlightMatch(match.text, match.matchStart, match.matchEnd)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  resultsContainer.innerHTML = html;

  // Add click handlers
  document.querySelectorAll('.search-match-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      const path = item.dataset.path;
      const line = parseInt(item.dataset.line);
      const column = parseInt(item.dataset.column);
      await openFileAtLocation(path, line, column);
    });
  });

  document.querySelectorAll('.search-file-header').forEach(header => {
    header.addEventListener('click', () => {
      const matchesDiv = header.nextElementSibling;
      matchesDiv.classList.toggle('collapsed');
      header.classList.toggle('collapsed');
    });
  });
}

// Highlight match in text
function highlightMatch(text, start, end) {
  const before = escapeHtml(text.substring(0, start));
  const match = escapeHtml(text.substring(start, end));
  const after = escapeHtml(text.substring(end));
  return `${before}<span class="search-highlight">${match}</span>${after}`;
}

// Open file at specific location
async function openFileAtLocation(filePath, line, column) {
  // Hide welcome screen if visible
  if (typeof hideWelcomeScreen === 'function') {
    hideWelcomeScreen();
  }

  // Check if file is already open
  const existingTab = findTabByPath(filePath);
  if (existingTab) {
    switchToTab(existingTab.id);
  } else {
    // Read and open file
    const result = await window.api.readFile(filePath);
    if (!result) return;

    const fileName = filePath.split('/').pop();
    const language = getLanguageFromFilePath(filePath);
    const model = monaco.editor.createModel(result.content, language);
    const tabId = createTab(filePath, fileName, result.content, model);

    // Track changes
    model.onDidChangeContent(() => {
      const tab = getTabById(tabId);
      if (tab && !tab.modified) {
        tab.modified = true;
        updateTabModified(tabId, true);
      }
    });
  }

  // Move cursor to location
  if (editor) {
    editor.setPosition({ lineNumber: line, column: column });
    editor.revealLineInCenter(line);
    editor.focus();

    // Select the matched text
    const query = currentSearchQuery;
    editor.setSelection({
      startLineNumber: line,
      startColumn: column,
      endLineNumber: line,
      endColumn: column + query.length
    });
  }
}

// Perform replace all
async function performReplaceAll() {
  if (searchResults.length === 0) {
    return;
  }

  const replaceInput = document.getElementById('replace-input');
  const replaceText = replaceInput.value;

  const confirmMsg = `Replace ${searchResults.reduce((sum, f) => sum + f.matches.length, 0)} occurrence${searchResults.reduce((sum, f) => sum + f.matches.length, 0) !== 1 ? 's' : ''} across ${searchResults.length} file${searchResults.length !== 1 ? 's' : ''}?`;

  if (!confirm(confirmMsg)) {
    return;
  }

  // Replace in all files
  for (const file of searchResults) {
    await replaceInFile(file.path, currentSearchQuery, replaceText);
  }

  // Refresh search results
  await performSearch();

  alert('Replace completed!');
}

// Replace text in a file
async function replaceInFile(filePath, searchText, replaceText) {
  try {
    const result = await window.api.readFile(filePath);
    if (!result) return;

    // Case-insensitive replacement
    const regex = new RegExp(escapeRegExp(searchText), 'gi');
    const newContent = result.content.replace(regex, replaceText);

    await window.api.saveFile(filePath, newContent);

    // Update tab if open
    const tab = findTabByPath(filePath);
    if (tab && tab.model) {
      tab.model.setValue(newContent);
      tab.modified = false;
      updateTabModified(tab.id, false);
    }
  } catch (error) {
    console.error('Error replacing in file:', error);
  }
}

// Escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Clear search results
function clearSearchResults() {
  searchResults = [];
  currentSearchQuery = '';
  const resultsContainer = document.getElementById('search-results');
  resultsContainer.innerHTML = '<div class="search-empty">Enter search text and press Enter</div>';
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show search panel (can be called from keyboard shortcut)
function showSearchPanel() {
  const sidebar = document.getElementById('sidebar');
  const searchView = document.getElementById('search-view');
  const searchBtn = document.querySelectorAll('.activity-item')[1];

  // Show sidebar
  sidebar.classList.remove('hidden');

  // Hide all views and show search
  document.querySelectorAll('.sidebar-view').forEach(v => v.classList.remove('active'));
  searchView.classList.add('active');

  // Activate search button
  document.querySelectorAll('.activity-item').forEach(i => i.classList.remove('active'));
  if (searchBtn) {
    searchBtn.classList.add('active');
  }

  // Focus search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    setTimeout(() => searchInput.focus(), 100);
  }

  // Trigger editor resize
  if (typeof editor !== 'undefined' && editor) {
    setTimeout(() => editor.layout(), 100);
  }
}

// Keyboard shortcut handler
document.addEventListener('keydown', (e) => {
  // Cmd+Shift+F or Ctrl+Shift+F
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
    e.preventDefault();
    showSearchPanel();
  }
});

// Menu event listener
window.api.onMenuFindInFiles(() => {
  showSearchPanel();
});

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearchPanel);
} else {
  initSearchPanel();
}

// Export functions
window.showSearchPanel = showSearchPanel;
