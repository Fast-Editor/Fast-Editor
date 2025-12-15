/**
 * Diff Editor - Side-by-side file comparison
 */

let diffEditor = null;
let diffEditorModal = null;
let originalFilePath = null;
let modifiedFilePath = null;

/**
 * Initialize diff editor modal
 */
function initDiffEditorModal() {
  // Create modal if it doesn't exist
  if (document.getElementById('diff-editor-modal')) {
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'diff-editor-modal';
  modal.className = 'modal-overlay hidden';
  modal.innerHTML = `
    <div class="modal-content diff-editor-container">
      <div class="modal-header">
        <h2>Diff Editor - Compare Files</h2>
        <div class="diff-file-info">
          <span id="diff-original-file" class="diff-file-label">Original: None</span>
          <span class="diff-separator">⟷</span>
          <span id="diff-modified-file" class="diff-file-label">Modified: None</span>
        </div>
        <button id="diff-editor-close" class="modal-close-btn">×</button>
      </div>
      <div class="diff-editor-toolbar">
        <button id="diff-select-original" class="toolbar-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M14 2H8.5L7 0.5H2C1.17 0.5 0.5 1.17 0.5 2V14C0.5 14.83 1.17 15.5 2 15.5H14C14.83 15.5 15.5 14.83 15.5 14V3.5C15.5 2.67 14.83 2 14 2Z"/>
          </svg>
          Select Original
        </button>
        <button id="diff-select-modified" class="toolbar-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M14 2H8.5L7 0.5H2C1.17 0.5 0.5 1.17 0.5 2V14C0.5 14.83 1.17 15.5 2 15.5H14C14.83 15.5 15.5 14.83 15.5 14V3.5C15.5 2.67 14.83 2 14 2Z"/>
          </svg>
          Select Modified
        </button>
        <div class="toolbar-divider"></div>
        <button id="diff-swap-files" class="toolbar-btn" title="Swap files">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M12 8L8 4V7H0V9H8V12L12 8Z"/>
            <path d="M4 8L8 12V9H16V7H8V4L4 8Z"/>
          </svg>
          Swap
        </button>
        <button id="diff-next-change" class="toolbar-btn" title="Next change (F7)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 12L3 7L4.4 5.6L8 9.2L11.6 5.6L13 7L8 12Z"/>
          </svg>
          Next
        </button>
        <button id="diff-prev-change" class="toolbar-btn" title="Previous change (Shift+F7)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4L13 9L11.6 10.4L8 6.8L4.4 10.4L3 9L8 4Z"/>
          </svg>
          Previous
        </button>
      </div>
      <div id="diff-editor-content" class="diff-editor-content"></div>
    </div>
  `;

  document.body.appendChild(modal);
  diffEditorModal = modal;

  // Setup event listeners
  document.getElementById('diff-editor-close').addEventListener('click', closeDiffEditor);
  document.getElementById('diff-select-original').addEventListener('click', selectOriginalFile);
  document.getElementById('diff-select-modified').addEventListener('click', selectModifiedFile);
  document.getElementById('diff-swap-files').addEventListener('click', swapFiles);
  document.getElementById('diff-next-change').addEventListener('click', () => diffEditor?.getAction('editor.action.diffReview.next').run());
  document.getElementById('diff-prev-change').addEventListener('click', () => diffEditor?.getAction('editor.action.diffReview.prev').run());

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeDiffEditor();
    }
  });

  // ESC key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !diffEditorModal.classList.contains('hidden')) {
      closeDiffEditor();
    }
  });
}

/**
 * Open diff editor
 */
async function openDiffEditor() {
  initDiffEditorModal();

  // Show modal
  diffEditorModal.classList.remove('hidden');

  // Create diff editor if it doesn't exist
  if (!diffEditor) {
    const container = document.getElementById('diff-editor-content');

    // Wait for Monaco to be ready
    if (typeof monaco === 'undefined') {
      console.error('Monaco editor not loaded');
      return;
    }

    diffEditor = monaco.editor.createDiffEditor(container, {
      theme: 'vs-dark',
      automaticLayout: true,
      readOnly: false,
      renderSideBySide: true,
      enableSplitViewResizing: true,
      ignoreTrimWhitespace: false,
      renderIndicators: true,
      // Show inline diff view when window is narrow
      renderSideBySide: window.innerWidth > 1000,
      fontSize: 14,
      fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace"
    });

    // Resize on window resize
    const resizeObserver = new ResizeObserver(() => {
      if (diffEditor) {
        diffEditor.layout();
      }
    });
    resizeObserver.observe(container);
  }

  // Prompt to select files if none selected
  if (!originalFilePath || !modifiedFilePath) {
    showNotification('Please select original and modified files', 3000);
  }
}

/**
 * Select original file
 */
async function selectOriginalFile() {
  const result = await window.api.openFile();
  if (result) {
    originalFilePath = result.filePath;
    const fileName = result.filePath.split('/').pop();
    document.getElementById('diff-original-file').textContent = `Original: ${fileName}`;
    updateDiffEditor();
  }
}

/**
 * Select modified file
 */
async function selectModifiedFile() {
  const result = await window.api.openFile();
  if (result) {
    modifiedFilePath = result.filePath;
    const fileName = result.filePath.split('/').pop();
    document.getElementById('diff-modified-file').textContent = `Modified: ${fileName}`;
    updateDiffEditor();
  }
}

/**
 * Swap original and modified files
 */
function swapFiles() {
  if (!originalFilePath || !modifiedFilePath) {
    showNotification('Select both files first', 2000);
    return;
  }

  // Swap paths
  const temp = originalFilePath;
  originalFilePath = modifiedFilePath;
  modifiedFilePath = temp;

  // Update labels
  const origLabel = document.getElementById('diff-original-file').textContent;
  const modLabel = document.getElementById('diff-modified-file').textContent;
  document.getElementById('diff-original-file').textContent = modLabel;
  document.getElementById('diff-modified-file').textContent = origLabel;

  // Update diff
  updateDiffEditor();
  showNotification('Files swapped', 1500);
}

/**
 * Update diff editor with current files
 */
async function updateDiffEditor() {
  if (!originalFilePath || !modifiedFilePath || !diffEditor) {
    return;
  }

  try {
    // Read both files
    const [originalResult, modifiedResult] = await Promise.all([
      window.api.readFile(originalFilePath),
      window.api.readFile(modifiedFilePath)
    ]);

    if (!originalResult || !modifiedResult) {
      showNotification('Error reading files', 2000);
      return;
    }

    // Detect language from file extension
    const language = getLanguageFromFilePath(modifiedFilePath);

    // Create models
    const originalModel = monaco.editor.createModel(
      originalResult.content,
      language,
      monaco.Uri.file(originalFilePath)
    );

    const modifiedModel = monaco.editor.createModel(
      modifiedResult.content,
      language,
      monaco.Uri.file(modifiedFilePath)
    );

    // Set models in diff editor
    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel
    });

    showNotification('Diff loaded successfully', 1500);
  } catch (error) {
    console.error('Error loading diff:', error);
    showNotification('Error loading diff', 2000);
  }
}

/**
 * Close diff editor
 */
function closeDiffEditor() {
  if (diffEditorModal) {
    diffEditorModal.classList.add('hidden');
  }

  // Optionally dispose models to free memory
  // (commented out to keep files loaded for quick reopening)
  /*
  
  */
 if (diffEditor) {
    const model = diffEditor.getModel();
    if (model) {
      model.original?.dispose();
      model.modified?.dispose();
    }
  }
}

/**
 * Compare active file with another file
 */
async function compareActiveFileWith() {
  const activeTab = getActiveTab();
  if (!activeTab || !activeTab.filePath) {
    showNotification('No active file to compare', 2000);
    return;
  }

  // Set active file as original
  originalFilePath = activeTab.filePath;
  const fileName = activeTab.filePath.split('/').pop();

  // Initialize modal
  initDiffEditorModal();
  document.getElementById('diff-original-file').textContent = `Original: ${fileName}`;

  // Open diff editor
  await openDiffEditor();

  // Prompt for modified file
  showNotification('Select modified file to compare', 2000);
}

/**
 * Compare two selected files from sidebar (future enhancement)
 */
async function compareFiles(file1Path, file2Path) {
  originalFilePath = file1Path;
  modifiedFilePath = file2Path;

  const file1Name = file1Path.split('/').pop();
  const file2Name = file2Path.split('/').pop();

  initDiffEditorModal();
  document.getElementById('diff-original-file').textContent = `Original: ${file1Name}`;
  document.getElementById('diff-modified-file').textContent = `Modified: ${file2Name}`;

  await openDiffEditor();
  await updateDiffEditor();
}

// Listen for menu event
window.api.onMenuOpenDiffEditor(() => {
  openDiffEditor();
});

// Export functions
window.diffEditor = {
  open: openDiffEditor,
  close: closeDiffEditor,
  compareActiveFileWith,
  compareFiles
};
