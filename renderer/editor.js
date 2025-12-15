// Editor State
let editor = null;
let currentFilePath = null;
let currentModel = null;

// Auto-save State
let autoSaveEnabled = true;
let autoSaveDelay = 1000; // milliseconds (default: 1 second)
let autoSaveTimer = null;
let isSaving = false;

// Load auto-save settings from localStorage
function loadAutoSaveSettings() {
  try {
    const settings = localStorage.getItem('autoSaveSettings');
    if (settings) {
      const parsed = JSON.parse(settings);
      autoSaveEnabled = parsed.enabled !== undefined ? parsed.enabled : true;
      autoSaveDelay = parsed.delay || 1000;
    }
  } catch (err) {
    console.error('Error loading auto-save settings:', err);
  }
  updateAutoSaveIndicator();
}

// Save auto-save settings to localStorage
function saveAutoSaveSettings() {
  try {
    localStorage.setItem('autoSaveSettings', JSON.stringify({
      enabled: autoSaveEnabled,
      delay: autoSaveDelay
    }));
  } catch (err) {
    console.error('Error saving auto-save settings:', err);
  }
}

// Toggle auto-save
function toggleAutoSave() {
  autoSaveEnabled = !autoSaveEnabled;
  saveAutoSaveSettings();
  updateAutoSaveIndicator();

  // Show notification
  showNotification(autoSaveEnabled ? 'Auto Save: ON' : 'Auto Save: OFF');
}

// Update auto-save indicator in UI
function updateAutoSaveIndicator() {
  const indicator = document.getElementById('auto-save-indicator');
  if (indicator) {
    indicator.textContent = autoSaveEnabled ? 'Auto Save: ON' : 'Auto Save: OFF';
    indicator.style.color = autoSaveEnabled ? '#4CAF50' : '#858585';
  }
}

// Trigger auto-save
function triggerAutoSave() {
  // Clear existing timer
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  // Don't auto-save if disabled or already saving
  if (!autoSaveEnabled || isSaving) {
    return;
  }

  // Get active tab
  const activeTab = getActiveTab();
  if (!activeTab || !activeTab.modified || !activeTab.filePath) {
    return; // Nothing to save or no file path (unsaved file)
  }

  // Set timer for auto-save
  autoSaveTimer = setTimeout(async () => {
    try {
      isSaving = true;
      updateSavingIndicator(true);

      // Save the file
      await saveActiveTab();

      // Show brief success indicator
      updateSavingIndicator(false, true);
      setTimeout(() => {
        updateSavingIndicator(false, false);
      }, 1500);
    } catch (error) {
      console.error('Auto-save error:', error);
      updateSavingIndicator(false, false);
    } finally {
      isSaving = false;
    }
  }, autoSaveDelay);
}

// Update saving indicator
function updateSavingIndicator(saving, saved = false) {
  const indicator = document.getElementById('saving-indicator');
  if (!indicator) return;

  if (saving) {
    indicator.textContent = 'Saving...';
    indicator.style.display = 'block';
    indicator.style.color = '#858585';
  } else if (saved) {
    indicator.textContent = 'Saved';
    indicator.style.display = 'block';
    indicator.style.color = '#4CAF50';
  } else {
    indicator.style.display = 'none';
  }
}

// Show notification (toast-style)
function showNotification(message, duration = 2000) {
  // Remove existing notification
  const existing = document.getElementById('notification-toast');
  if (existing) {
    existing.remove();
  }

  // Create notification
  const notification = document.createElement('div');
  notification.id = 'notification-toast';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #323233;
    color: #cccccc;
    padding: 12px 20px;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    font-size: 13px;
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;

  document.body.appendChild(notification);

  // Remove after duration
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

// Export showNotification globally for use in other modules
window.showNotification = showNotification;

// Performance: Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initialize Monaco Editor with performance optimizations
function initEditor() {
  const container = document.getElementById('editor-container');
  container.classList.add('loading');

  // Configure Monaco paths
  require.config({
    paths: {
      vs: '../node_modules/monaco-editor/min/vs'
    },
    // Performance: Disable Monaco's automatic language detection on first load
    'vs/editor/editor.main': {
      loader: 'text'
    }
  });

  require(['vs/editor/editor.main'], function () {
    container.classList.remove('loading');

    // Performance: Disable features that aren't needed initially
    editor = monaco.editor.create(container, {
      value: '// Welcome to Fast Editor\n// Press Cmd/Ctrl+Shift+O to open a file\n// Press Cmd/Ctrl+O to open a folder\n',
      theme: 'vs-dark',
      language: 'javascript',
      fontSize: 14,
      fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
      lineNumbers: 'on',
      minimap: {
        enabled: true,
        maxColumn: 80 // Performance: Limit minimap width
      },
      scrollBeyondLastLine: false,
      automaticLayout: true, // Performance: Auto-resize

      // IntelliSense Configuration (VS Code-like)
      quickSuggestions: {
        other: true,
        comments: true,  // Enable in comments
        strings: true    // Enable in strings
      },
      quickSuggestionsDelay: 10,  // Fast suggestions (10ms)

      // Auto-completion features
      suggestOnTriggerCharacters: true,  // Show suggestions on trigger characters (., @, etc)
      acceptSuggestionOnCommitCharacter: true,  // Accept with commit characters
      acceptSuggestionOnEnter: 'on',  // Accept with Enter
      tabCompletion: 'on',  // Tab to accept suggestions
      wordBasedSuggestions: true,  // Suggest words from the document

      // Parameter hints
      parameterHints: {
        enabled: true,
        cycle: true  // Cycle through multiple signatures
      },

      // Hover tooltips
      hover: {
        enabled: true,
        delay: 300,  // Show after 300ms
        sticky: true  // Keep hover visible when mouse moves to it
      },

      // Snippet suggestions
      snippetSuggestions: 'top',  // Show snippets at the top
      suggest: {
        snippetsPreventQuickSuggestions: false,
        showMethods: true,
        showFunctions: true,
        showConstructors: true,
        showFields: true,
        showVariables: true,
        showClasses: true,
        showStructs: true,
        showInterfaces: true,
        showModules: true,
        showProperties: true,
        showEvents: true,
        showOperators: true,
        showUnits: true,
        showValues: true,
        showConstants: true,
        showEnums: true,
        showEnumMembers: true,
        showKeywords: true,
        showWords: true,
        showColors: true,
        showFiles: true,
        showReferences: true,
        showFolders: true,
        showTypeParameters: true,
        showSnippets: true,
        showUsers: true,
        showIssues: true
      },

      // Visual Features
      folding: true, // Code folding
      foldingStrategy: 'auto', // Auto-detect folding regions
      showFoldingControls: 'mouseover', // Show on hover
      bracketPairColorization: {
        enabled: true // Colorize matching brackets
      },
      guides: {
        indentation: true, // Show indentation guides
        highlightActiveIndentation: true, // Highlight active indent level
        bracketPairs: true // Show guides for bracket pairs
      },
      stickyScroll: {
        enabled: true // Keep function/class header visible at top
      },
      glyphMargin: true, // Left margin for breakpoints, git indicators
      rulers: [80, 120], // Vertical rulers at columns
      renderWhitespace: 'boundary', // Show whitespace at word boundaries
      renderControlCharacters: true, // Show control characters
      unicodeHighlight: {
        ambiguousCharacters: true, // Highlight ambiguous unicode
        invisibleCharacters: true // Highlight invisible characters
      },
      showUnused: true, // Fade out unused variables
      colorDecorators: true, // Show color preview for color codes
      links: true, // Make URLs clickable (Cmd+Click)

      // Editor Features
      formatOnPaste: true, // Auto-format pasted code
      formatOnType: false, // Don't auto-format while typing (can be slow)
      lightbulb: {
        enabled: true // Show quick fixes/code actions
      },
      inlineSuggest: {
        enabled: true // Ghost text suggestions
      },
      codeLens: true, // Show reference counts, test run buttons
      inlayHints: {
        enabled: 'on' // Show parameter names, type hints inline
      },
      linkedEditing: true, // Edit matching HTML tags simultaneously

      // Navigation Features
      occurrencesHighlight: true, // Highlight all occurrences of symbol under cursor
      selectionHighlight: true, // Highlight all matching text selections

      // Advanced Editing
      autoClosingBrackets: 'always', // Auto-close brackets
      autoClosingQuotes: 'always', // Auto-close quotes
      autoClosingPairs: true, // Auto-close pairs
      autoSurround: 'languageDefined', // Wrap selection with quotes/brackets
      dragAndDrop: true, // Drag and drop text
      wordWrap: 'off', // No word wrap by default
      copyWithSyntaxHighlighting: true, // Copy with syntax highlighting

      // Appearance
      fontLigatures: true, // Enable font ligatures
      cursorStyle: 'line', // Line cursor
      cursorWidth: 2,
      cursorBlinking: 'blink', // Blinking cursor
      smoothScrolling: true, // Smooth scrolling
      cursorSmoothCaretAnimation: 'on', // Smooth cursor movement
      cursorSurroundingLines: 3, // Keep 3 lines visible above/below cursor

      // Scrollbar
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 14,
        horizontalScrollbarSize: 12,
        arrowSize: 11
      },

      // Enable multi-cursor support
      multiCursorModifier: 'ctrlCmd',

      // Better scrolling
      mouseWheelScrollSensitivity: 1,
      fastScrollSensitivity: 5,

      // Semantic features
      'semanticHighlighting.enabled': true,

      // Breadcrumbs (will be shown in UI)
      breadcrumbs: {
        enabled: true
      }
    });

    // Update cursor position in status bar
    editor.onDidChangeCursorPosition(debounce((e) => {
      updateCursorPosition(e.position);
    }, 50));

    // Track content changes
    editor.onDidChangeModelContent(debounce(() => {
      updateFileStatus(true);
      // Emit event for markdown preview
      window.dispatchEvent(new Event('editor-content-changed'));
      // Trigger auto-save
      triggerAutoSave();

      // Notify LSP of document changes
      if (window.lsp && window.lsp.isEnabled()) {
        const tab = getActiveTab();
        if (tab && tab.filePath) {
          const content = editor.getValue();
          window.lsp.didChange(tab.filePath, content);
        }
      }
    }, 200));

    // Keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveFile();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => {
      saveFileAs();
    });

    // Cmd+O is handled by menu (Open Folder)
    // Cmd+Shift+O is handled by menu (Open File)
    // Removed duplicate keybinding to avoid conflicts

    // Find in file (Cmd+F / Ctrl+F)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.trigger('keyboard', 'actions.find');
    });

    // Replace in file (Cmd+H / Ctrl+H)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      editor.trigger('keyboard', 'editor.action.startFindReplaceAction');
    });

    // Close active tab (Cmd+W / Ctrl+W)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => {
      if (typeof window.closeActiveTab === 'function') {
        window.closeActiveTab();
      }
    });

    // Focus editor
    editor.focus();

    // Initialize auto-save
    loadAutoSaveSettings();
  });
}

// Initialize auto-save on load
document.addEventListener('DOMContentLoaded', () => {
  loadAutoSaveSettings();
});

// Update cursor position display
function updateCursorPosition(position) {
  const statusEl = document.getElementById('cursor-position');
  statusEl.textContent = `Ln ${position.lineNumber}, Col ${position.column}`;
}

// Update file status indicator
function updateFileStatus(modified) {
  const statusEl = document.getElementById('file-status');
  statusEl.textContent = modified ? '● Modified' : '';
}

// Get file language from extension
function getLanguageFromFilePath(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const languageMap = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'json': 'json',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    'rb': 'ruby',
    'php': 'php',
    'sh': 'shell',
    'bash': 'shell',
    'sql': 'sql',
    'md': 'markdown',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'dockerfile': 'dockerfile',
    'vue': 'html',
    'svelte': 'html'
  };
  return languageMap[ext] || 'plaintext';
}

// Open file
async function openFile() {
  const result = await window.api.openFile();
  if (result) {
    // Check if file is already open
    const existingTab = findTabByPath(result.filePath);
    if (existingTab) {
      switchToTab(existingTab.id);
      return;
    }

    const fileName = result.filePath.split('/').pop();
    const language = getLanguageFromFilePath(result.filePath);

    // Create new model
    const model = monaco.editor.createModel(result.content, language);

    // Create tab
    const tabId = createTab(result.filePath, fileName, result.content, model);

    // Track changes
    model.onDidChangeContent(() => {
      const tab = getTabById(tabId);
      if (tab && !tab.modified) {
        tab.modified = true;
        updateTabModified(tabId, true);
      }
    });

    editor.focus();
  }
}

// Save file (uses tab system)
async function saveFile() {
  return await saveActiveTab();
}

// Save file as (uses tab system)
async function saveFileAs() {
  return await saveActiveTabAs();
}

// Menu event listeners
window.api.onMenuOpenFile(() => openFile());
window.api.onMenuSaveFile(() => saveFile());
window.api.onMenuSaveFileAs(() => saveFileAs());
window.api.onMenuSaveAll(() => saveAllTabs());
window.api.onMenuCloseTab(() => {
  if (typeof window.closeActiveTab === 'function') {
    window.closeActiveTab();
  }
});
window.api.onMenuFind(() => {
  if (editor) {
    editor.trigger('keyboard', 'actions.find');
  }
});
window.api.onMenuReplace(() => {
  if (editor) {
    editor.trigger('keyboard', 'editor.action.startFindReplaceAction');
  }
});

// Format menu handlers
window.api.onMenuFormatDocument(() => {
  if (editor) {
    editor.getAction('editor.action.formatDocument').run();
  }
});
window.api.onMenuFormatSelection(() => {
  if (editor) {
    editor.getAction('editor.action.formatSelection').run();
  }
});

// Comment menu handlers
window.api.onMenuCommentLine(() => {
  if (editor) {
    editor.getAction('editor.action.commentLine').run();
  }
});
window.api.onMenuBlockComment(() => {
  if (editor) {
    editor.getAction('editor.action.blockComment').run();
  }
});

// Line manipulation handlers
window.api.onMenuMoveLineUp(() => {
  if (editor) {
    editor.getAction('editor.action.moveLinesUpAction').run();
  }
});
window.api.onMenuMoveLineDown(() => {
  if (editor) {
    editor.getAction('editor.action.moveLinesDownAction').run();
  }
});
window.api.onMenuCopyLineUp(() => {
  if (editor) {
    editor.getAction('editor.action.copyLinesUpAction').run();
  }
});
window.api.onMenuCopyLineDown(() => {
  if (editor) {
    editor.getAction('editor.action.copyLinesDownAction').run();
  }
});
window.api.onMenuDeleteLine(() => {
  if (editor) {
    editor.getAction('editor.action.deleteLines').run();
  }
});

// Transform handlers
window.api.onMenuTransformUppercase(() => {
  if (editor) {
    editor.getAction('editor.action.transformToUppercase').run();
  }
});
window.api.onMenuTransformLowercase(() => {
  if (editor) {
    editor.getAction('editor.action.transformToLowercase').run();
  }
});

// Whitespace handler
window.api.onMenuTrimWhitespace(() => {
  if (editor) {
    editor.getAction('editor.action.trimTrailingWhitespace').run();
  }
});

// Navigation handlers
window.api.onMenuGotoSymbol(() => {
  if (editor) {
    editor.getAction('editor.action.quickOutline').run();
  }
});
window.api.onMenuGotoSymbolWorkspace(() => {
  if (editor) {
    editor.getAction('editor.action.showAllSymbols').run();
  }
});
window.api.onMenuGotoDefinition(() => {
  if (editor) {
    editor.getAction('editor.action.revealDefinition').run();
  }
});
window.api.onMenuPeekDefinition(() => {
  if (editor) {
    editor.getAction('editor.action.peekDefinition').run();
  }
});
window.api.onMenuGotoTypeDefinition(() => {
  if (editor) {
    editor.getAction('editor.action.goToTypeDefinition').run();
  }
});
window.api.onMenuGotoImplementation(() => {
  if (editor) {
    editor.getAction('editor.action.goToImplementation').run();
  }
});
window.api.onMenuFindReferences(() => {
  if (editor) {
    editor.getAction('editor.action.referenceSearch.trigger').run();
  }
});

// Error navigation handlers
window.api.onMenuNextError(() => {
  if (editor) {
    editor.getAction('editor.action.marker.nextInFiles').run();
  }
});
window.api.onMenuPrevError(() => {
  if (editor) {
    editor.getAction('editor.action.marker.prevInFiles').run();
  }
});

// View toggle handlers
window.api.onMenuToggleWordWrap(() => {
  if (editor) {
    const currentWrap = editor.getOption(monaco.editor.EditorOption.wordWrap);
    editor.updateOptions({
      wordWrap: currentWrap === 'off' ? 'on' : 'off'
    });
    showNotification(`Word Wrap: ${currentWrap === 'off' ? 'ON' : 'OFF'}`);
  }
});

window.api.onMenuToggleMinimap(() => {
  if (editor) {
    const minimap = editor.getOption(monaco.editor.EditorOption.minimap);
    editor.updateOptions({
      minimap: {
        enabled: !minimap.enabled
      }
    });
    showNotification(`Minimap: ${!minimap.enabled ? 'ON' : 'OFF'}`);
  }
});

window.api.onMenuToggleBreadcrumbs(() => {
  if (editor) {
    const breadcrumbs = editor.getOption(monaco.editor.EditorOption.breadcrumbs);
    editor.updateOptions({
      breadcrumbs: {
        enabled: !breadcrumbs.enabled
      }
    });
    showNotification(`Breadcrumbs: ${!breadcrumbs.enabled ? 'ON' : 'OFF'}`);
  }
});

// Theme handlers
window.api.onMenuThemeDark(() => {
  if (monaco) {
    monaco.editor.setTheme('vs-dark');
    showNotification('Theme: Dark');
  }
});
window.api.onMenuThemeLight(() => {
  if (monaco) {
    monaco.editor.setTheme('vs');
    showNotification('Theme: Light');
  }
});
window.api.onMenuThemeHcBlack(() => {
  if (monaco) {
    monaco.editor.setTheme('hc-black');
    showNotification('Theme: High Contrast Dark');
  }
});
window.api.onMenuThemeHcLight(() => {
  if (monaco) {
    monaco.editor.setTheme('hc-light');
    showNotification('Theme: High Contrast Light');
  }
});

// Selection handlers
window.api.onMenuSelectAllOccurrences(() => {
  if (editor) {
    editor.getAction('editor.action.selectHighlights').run();
  }
});
window.api.onMenuAddCursorAbove(() => {
  if (editor) {
    editor.getAction('editor.action.insertCursorAbove').run();
  }
});
window.api.onMenuAddCursorBelow(() => {
  if (editor) {
    editor.getAction('editor.action.insertCursorBelow').run();
  }
});
window.api.onMenuExpandSelection(() => {
  if (editor) {
    editor.getAction('editor.action.smartSelect.expand').run();
  }
});
window.api.onMenuShrinkSelection(() => {
  if (editor) {
    editor.getAction('editor.action.smartSelect.shrink').run();
  }
});

// Git menu handlers
window.api.onMenuGitRefresh(() => {
  if (window.git && window.git.isEnabled()) {
    window.git.refresh();
  }
});

window.api.onMenuGitStageFile(() => {
  if (window.git && window.git.isEnabled()) {
    const activeTab = getActiveTab();
    if (activeTab && activeTab.filePath) {
      window.git.stageFile(activeTab.filePath);
    } else {
      showNotification('No active file to stage', 2000);
    }
  } else {
    showNotification('Git not enabled for this workspace', 2000);
  }
});

window.api.onMenuGitUnstageFile(() => {
  if (window.git && window.git.isEnabled()) {
    const activeTab = getActiveTab();
    if (activeTab && activeTab.filePath) {
      window.git.unstageFile(activeTab.filePath);
    } else {
      showNotification('No active file to unstage', 2000);
    }
  } else {
    showNotification('Git not enabled for this workspace', 2000);
  }
});

window.api.onMenuGitCommit(() => {
  if (window.git && window.git.isEnabled()) {
    window.git.showCommitDialog();
  } else {
    showNotification('Git not enabled for this workspace', 2000);
  }
});

window.api.onMenuGitPush(() => {
  if (window.git && window.git.isEnabled()) {
    window.git.push();
  } else {
    showNotification('Git not enabled for this workspace', 2000);
  }
});

window.api.onMenuGitPull(() => {
  if (window.git && window.git.isEnabled()) {
    window.git.pull();
  } else {
    showNotification('Git not enabled for this workspace', 2000);
  }
});

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEditor);
} else {
  initEditor();
}

// Export functions globally
window.toggleAutoSave = toggleAutoSave;
