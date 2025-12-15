// Tab Management
let openTabs = [];
let activeTabId = null;

// Tab data structure: { id, filePath, fileName, content, model, modified }

function createTab(filePath, fileName, content, model) {
  const tabId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

  const tab = {
    id: tabId,
    filePath,
    fileName,
    content,
    model,
    modified: false
  };

  // Hide welcome screen when opening a file
  if (window.hideWelcomeScreen) {
    window.hideWelcomeScreen();
  }

  openTabs.push(tab);
  renderTabs();
  switchToTab(tabId);

  // Notify LSP that document was opened
  if (window.lsp && window.lsp.isEnabled() && filePath) {
    const languageId = getLanguageFromFilePath(filePath);
    window.lsp.didOpen(filePath, languageId, content);
  }

  return tabId;
}

function findTabByPath(filePath) {
  return openTabs.find(tab => tab.filePath === filePath);
}

function getTabById(tabId) {
  return openTabs.find(tab => tab.id === tabId);
}

function getActiveTab() {
  return openTabs.find(tab => tab.id === activeTabId);
}

function getAllTabs() {
  return openTabs;
}

function closeTabByPath(filePath) {
  const tab = findTabByPath(filePath);
  if (tab) {
    closeTab(tab.id);
  }
}

// Close all tabs (used when opening a new workspace)
function closeAllTabs() {
  // Make a copy of the array since we're modifying it
  const tabsToClose = [...openTabs];

  tabsToClose.forEach(tab => {
    // Dispose Monaco model to free memory
    if (tab.model) {
      tab.model.dispose();
    }
  });

  // Clear the array
  openTabs = [];
  activeTabId = null;

  // Update UI
  renderTabs();

  // Show welcome screen
  if (window.showWelcomeScreen) {
    window.showWelcomeScreen();
  }

  // Clear file name
  document.getElementById('file-name').textContent = 'Untitled';
  updateFileStatus(false);

  // Clear breadcrumb
  if (window.updateBreadcrumb) {
    window.updateBreadcrumb(null);
  }
}

function closeTab(tabId) {
  const index = openTabs.findIndex(tab => tab.id === tabId);
  if (index === -1) return;

  const tab = openTabs[index];

  // Notify LSP that document was closed
  if (window.lsp && window.lsp.isEnabled() && tab.filePath) {
    window.lsp.didClose(tab.filePath);
  }

  // Dispose Monaco model to free memory
  if (tab.model) {
    tab.model.dispose();
  }

  openTabs.splice(index, 1);

  // Switch to another tab if this was active
  if (activeTabId === tabId) {
    if (openTabs.length > 0) {
      const newIndex = Math.min(index, openTabs.length - 1);
      switchToTab(openTabs[newIndex].id);
    } else {
      activeTabId = null;

      // Show welcome screen instead of empty editor
      if (window.showWelcomeScreen) {
        window.showWelcomeScreen();
      }

      document.getElementById('file-name').textContent = 'Untitled';
      updateFileStatus(false);

      // Clear breadcrumb when no files are open
      if (window.updateBreadcrumb) {
        window.updateBreadcrumb(null);
      }
    }
  }

  renderTabs();
}

function switchToTab(tabId) {
  const tab = getTabById(tabId);
  if (!tab) return;

  activeTabId = tabId;

  // Update editor
  if (editor && tab.model) {
    editor.setModel(tab.model);
    editor.focus();
  }

  // Update UI
  document.getElementById('file-name').textContent = tab.fileName;
  const language = getLanguageFromFilePath(tab.filePath || tab.fileName);
  document.getElementById('language-mode').textContent = language.charAt(0).toUpperCase() + language.slice(1);
  updateFileStatus(tab.modified);

  // Update breadcrumb
  if (window.updateBreadcrumb) {
    window.updateBreadcrumb(tab.filePath);
  }

  // Performance: Only update active class instead of full re-render
  updateActiveTabClass(tabId);

  // Highlight active file in sidebar
  if (window.highlightActiveFileInSidebar && tab.filePath) {
    window.highlightActiveFileInSidebar(tab.filePath);
  }

  // Emit tab changed event for markdown preview
  window.dispatchEvent(new CustomEvent('tab-changed', { detail: { tab } }));
}

function updateTabModified(tabId, modified) {
  const tab = getTabById(tabId);
  if (tab) {
    tab.modified = modified;
    // Performance: Update only the specific tab element instead of full re-render
    updateTabElement(tabId);
  }
}

// Performance: Update a specific tab element without full re-render
function updateTabElement(tabId) {
  const tab = getTabById(tabId);
  if (!tab) return;

  const tabEl = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
  if (!tabEl) {
    // Tab element doesn't exist yet, do full render
    renderTabs();
    return;
  }

  const tabName = tabEl.querySelector('.tab-name');
  if (tabName) {
    tabName.textContent = `${tab.fileName}${tab.modified ? ' •' : ''}`;
  }
}

// Performance: Update active tab without full re-render
function updateActiveTabClass(newTabId) {
  // Remove active class from current active tab
  const currentActive = document.querySelector('.tab.active');
  if (currentActive) {
    currentActive.classList.remove('active');
  }

  // Add active class to new tab
  const newActive = document.querySelector(`.tab[data-tab-id="${newTabId}"]`);
  if (newActive) {
    newActive.classList.add('active');
  } else {
    // Tab element doesn't exist, do full render
    renderTabs();
  }
}

function renderTabs() {
  const tabsContainer = document.getElementById('tabs');
  tabsContainer.innerHTML = '';

  if (openTabs.length === 0) {
    tabsContainer.innerHTML = '<div class="no-tabs">No files open</div>';
    return;
  }

  openTabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.setAttribute('data-tab-id', tab.id); // Performance: Add ID for targeted updates
    if (tab.id === activeTabId) {
      tabEl.classList.add('active');
    }

    tabEl.innerHTML = `
      <span class="tab-name">${tab.fileName}${tab.modified ? ' •' : ''}</span>
      <button class="tab-close" data-tab-id="${tab.id}">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M7.99998 8.70708L11.6464 12.3535L12.3535 11.6464L8.70708 7.99998L12.3535 4.35353L11.6464 3.64642L7.99998 7.29287L4.35353 3.64642L3.64642 4.35353L7.29287 7.99998L3.64642 11.6464L4.35353 12.3535L7.99998 8.70708Z" fill="currentColor"/>
        </svg>
      </button>
    `;

    tabEl.addEventListener('click', (e) => {
      // Check if click is on close button or its children (SVG)
      if (!e.target.closest('.tab-close')) {
        switchToTab(tab.id);
      }
    });

    const closeBtn = tabEl.querySelector('.tab-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });

    tabsContainer.appendChild(tabEl);
  });
}

function saveActiveTab() {
  const tab = getActiveTab();
  if (!tab) return false;

  if (!tab.filePath) {
    return saveActiveTabAs();
  }

  const content = editor.getValue();
  return window.api.saveFile(tab.filePath, content).then(() => {
    tab.modified = false;
    updateFileStatus(false);
    // Performance: Only update the modified indicator instead of full re-render
    updateTabElement(tab.id);

    // Notify LSP that document was saved
    if (window.lsp && window.lsp.isEnabled() && tab.filePath) {
      window.lsp.didSave(tab.filePath, content);
    }

    return true;
  });
}

async function saveActiveTabAs() {
  const content = editor.getValue();
  const filePath = await window.api.saveFileAs(content);

  if (filePath) {
    const tab = getActiveTab();
    if (tab) {
      tab.filePath = filePath;
      tab.fileName = filePath.split('/').pop();

      const language = getLanguageFromFilePath(filePath);
      monaco.editor.setModelLanguage(tab.model, language);
      document.getElementById('language-mode').textContent = language.charAt(0).toUpperCase() + language.slice(1);

      tab.modified = false;
      updateFileStatus(false);
      renderTabs();
    }
    return true;
  }
  return false;
}

async function saveAllTabs() {
  for (const tab of openTabs) {
    if (tab.modified && tab.filePath) {
      // Temporarily switch to each tab to save
      const previousModel = editor.getModel();
      editor.setModel(tab.model);
      const content = editor.getValue();
      await window.api.saveFile(tab.filePath, content);
      tab.modified = false;
      editor.setModel(previousModel);
    }
  }

  // Performance: Update all modified tabs instead of full re-render
  openTabs.forEach(tab => {
    if (!tab.modified) {
      updateTabElement(tab.id);
    }
  });

  // Update UI for active tab
  updateFileStatus(false);
}

// Close active tab (for keyboard shortcuts)
function closeActiveTab() {
  const tab = getActiveTab();
  if (tab) {
    // Check if tab is modified and confirm close
    if (tab.modified) {
      const fileName = tab.fileName || 'Untitled';
      const message = `Do you want to save the changes you made to ${fileName}?`;
      const shouldSave = confirm(message);

      if (shouldSave) {
        // Save before closing
        saveActiveTab().then(() => {
          closeTab(tab.id);
        });
      } else {
        // Close without saving
        closeTab(tab.id);
      }
    } else {
      // Not modified, close immediately
      closeTab(tab.id);
    }
  }
}

// Initialize
renderTabs();

// Export functions for use in other modules
window.getActiveTab = getActiveTab;
window.getTabById = getTabById;
window.findTabByPath = findTabByPath;
window.getAllTabs = getAllTabs;
window.closeActiveTab = closeActiveTab;
window.closeAllTabs = closeAllTabs;
