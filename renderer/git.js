/**
 * Git Integration Module
 * Provides git status, decorations, and commands
 */

let gitEnabled = false;
let currentGitRoot = null;
let gitStatusCache = new Map(); // path -> status
let fileDecorations = new Map(); // path -> monaco decorations
let gitStatusInterval = null;

/**
 * Initialize git integration for workspace
 */
async function initGit(workspacePath) {
  if (!workspacePath) {
    gitEnabled = false;
    return;
  }

  try {
    // Check if workspace is a git repository
    const isGitRepo = await window.api.isGitRepository(workspacePath);

    if (isGitRepo) {
      currentGitRoot = workspacePath;
      gitEnabled = true;

      // Initial git status
      await refreshGitStatus();

      // Poll for changes every 5 seconds
      if (gitStatusInterval) {
        clearInterval(gitStatusInterval);
      }
      gitStatusInterval = setInterval(() => refreshGitStatus(), 5000);

      // Show git commit button
      const gitCommitBtn = document.getElementById('git-commit-btn');
      if (gitCommitBtn) {
        gitCommitBtn.style.display = 'flex';
      }

      console.log('✅ Git integration enabled');
    } else {
      gitEnabled = false;

      // Hide git commit button
      const gitCommitBtn = document.getElementById('git-commit-btn');
      if (gitCommitBtn) {
        gitCommitBtn.style.display = 'none';
      }

      console.log('ℹ️ Not a git repository');
    }
  } catch (error) {
    console.error('Error initializing git:', error);
    gitEnabled = false;

    // Hide git commit button on error
    const gitCommitBtn = document.getElementById('git-commit-btn');
    if (gitCommitBtn) {
      gitCommitBtn.style.display = 'none';
    }
  }
}

/**
 * Refresh git status for all files
 */
async function refreshGitStatus() {
  if (!gitEnabled || !currentGitRoot) return;

  try {
    const status = await window.api.getGitStatus(currentGitRoot);

    // Update cache
    gitStatusCache.clear();

    // Parse git status output
    if (status.modified) {
      status.modified.forEach(file => gitStatusCache.set(file, 'modified'));
    }
    if (status.added) {
      status.added.forEach(file => gitStatusCache.set(file, 'added'));
    }
    if (status.deleted) {
      status.deleted.forEach(file => gitStatusCache.set(file, 'deleted'));
    }
    if (status.untracked) {
      status.untracked.forEach(file => gitStatusCache.set(file, 'untracked'));
    }
    if (status.renamed) {
      status.renamed.forEach(file => gitStatusCache.set(file.to, 'renamed'));
    }

    // Update file tree decorations
    updateFileTreeGitStatus();

    // Update editor decorations for open files
    updateEditorGitDecorations();

  } catch (error) {
    console.error('Error refreshing git status:', error);
  }
}

/**
 * Get git status for a specific file
 */
function getFileGitStatus(filePath) {
  if (!gitEnabled || !currentGitRoot) return null;

  // Skip invalid or non-file paths
  if (!filePath || !filePath.startsWith('/') || filePath === '/') return null;

  // Skip files outside workspace
  if (!filePath.startsWith(currentGitRoot)) return null;

  // Get relative path
  const relativePath = filePath.substring(currentGitRoot.length + 1);

  return gitStatusCache.get(relativePath) || null;
}

/**
 * Update file tree with git status indicators
 */
function updateFileTreeGitStatus() {
  if (!gitEnabled) return;

  gitStatusCache.forEach((status, relativePath) => {
    const fullPath = `${currentGitRoot}/${relativePath}`;
    const treeItem = document.querySelector(`.tree-item[data-path="${fullPath}"]`);

    if (treeItem) {
      // Remove existing git status classes
      treeItem.classList.remove('git-modified', 'git-added', 'git-deleted', 'git-untracked', 'git-renamed');

      // Add new status class
      treeItem.classList.add(`git-${status}`);

      // Add status indicator
      let indicator = treeItem.querySelector('.git-status-indicator');
      if (!indicator) {
        indicator = document.createElement('span');
        indicator.className = 'git-status-indicator';
        treeItem.appendChild(indicator);
      }

      // Set indicator text
      const statusText = {
        'modified': 'M',
        'added': 'A',
        'deleted': 'D',
        'untracked': 'U',
        'renamed': 'R'
      };
      indicator.textContent = statusText[status] || '';
    }
  });
}

/**
 * Update editor with git gutter decorations
 */
async function updateEditorGitDecorations() {
  if (!gitEnabled || !editor) return;

  const model = editor.getModel();
  if (!model) return;

  const filePath = model.uri.path;
  // Skip git decorations for non-file paths (e.g., untitled:/1)
  if (!filePath || !filePath.startsWith('/') || filePath === '/' || !currentGitRoot) return;

  // Only process files within the git workspace
  if (!filePath.startsWith(currentGitRoot)) return;

  try {
    // Get git diff for current file
    const diff = await window.api.getGitDiff(currentGitRoot, filePath);

    if (!diff || !diff.changes) return;

    // Clear existing decorations
    const oldDecorations = fileDecorations.get(filePath) || [];

    // Create new decorations
    const newDecorations = [];

    diff.changes.forEach(change => {
      const { type, lineNumber, count } = change;

      let decorationClass = '';
      let glyphMarginClass = '';

      if (type === 'added') {
        decorationClass = 'git-line-added';
        glyphMarginClass = 'git-gutter-added';
      } else if (type === 'modified') {
        decorationClass = 'git-line-modified';
        glyphMarginClass = 'git-gutter-modified';
      } else if (type === 'deleted') {
        decorationClass = 'git-line-deleted';
        glyphMarginClass = 'git-gutter-deleted';
      }

      const range = {
        startLineNumber: lineNumber,
        startColumn: 1,
        endLineNumber: lineNumber + (count || 1) - 1,
        endColumn: 1
      };

      newDecorations.push({
        range,
        options: {
          isWholeLine: true,
          className: decorationClass,
          glyphMarginClassName: glyphMarginClass,
          glyphMarginHoverMessage: { value: `Git: ${type}` }
        }
      });
    });

    // Apply decorations
    const decorationIds = editor.deltaDecorations(oldDecorations, newDecorations);
    fileDecorations.set(filePath, decorationIds);

  } catch (error) {
    console.error('Error updating git decorations:', error);
  }
}

/**
 * Git commands
 */

// Stage file
async function stageFile(filePath) {
  if (!gitEnabled || !currentGitRoot) return;

  try {
    await window.api.gitAdd(currentGitRoot, filePath);
    await refreshGitStatus();
    window.showNotification('File staged');
  } catch (error) {
    console.error('Error staging file:', error);
    window.showNotification('Failed to stage file', 3000);
  }
}

// Unstage file
async function unstageFile(filePath) {
  if (!gitEnabled || !currentGitRoot) return;

  try {
    await window.api.gitReset(currentGitRoot, filePath);
    await refreshGitStatus();
    window.showNotification('File unstaged');
  } catch (error) {
    console.error('Error unstaging file:', error);
    window.showNotification('Failed to unstage file', 3000);
  }
}

// Commit
async function gitCommit(message) {
  if (!gitEnabled || !currentGitRoot) return;

  if (!message || !message.trim()) {
    window.showNotification('Commit message required', 2000);
    return;
  }

  try {
    await window.api.gitCommit(currentGitRoot, message);
    await refreshGitStatus();
    window.showNotification('Changes committed');
  } catch (error) {
    console.error('Error committing:', error);
    window.showNotification('Failed to commit: ' + error.message, 3000);
  }
}

// Push
async function gitPush() {
  if (!gitEnabled || !currentGitRoot) return;

  try {
    window.showNotification('Pushing to remote...', 1000);
    await window.api.gitPush(currentGitRoot);
    window.showNotification('Pushed successfully');
  } catch (error) {
    console.error('Error pushing:', error);
    window.showNotification('Failed to push: ' + error.message, 3000);
  }
}

// Pull
async function gitPull() {
  if (!gitEnabled || !currentGitRoot) return;

  try {
    window.showNotification('Pulling from remote...', 1000);
    await window.api.gitPull(currentGitRoot);
    await refreshGitStatus();
    window.showNotification('Pulled successfully');
  } catch (error) {
    console.error('Error pulling:', error);
    window.showNotification('Failed to pull: ' + error.message, 3000);
  }
}

// Track staged files for commit dialog
let stagedFiles = new Set();
let currentTab = 'unstaged';  // Track current tab
let allFiles = [];  // Store all files

// Show commit dialog with file list
async function showCommitDialog() {
  if (!gitEnabled) {
    window.showNotification('Git not enabled for this workspace', 2000);
    return;
  }

  const modal = document.getElementById('git-commit-modal');
  if (!modal) return;

  // Clear previous state
  stagedFiles.clear();
  currentTab = 'unstaged';
  allFiles = [];

  // Clear inputs
  const summary = document.getElementById('git-commit-summary');
  const description = document.getElementById('git-commit-description');
  if (summary) summary.value = '';
  if (description) description.value = '';

  // Reset push toggle
  const autoPush = document.getElementById('git-auto-push');
  if (autoPush) autoPush.checked = false;

  // Show modal
  modal.classList.remove('hidden');

  // Load current branch
  await loadCurrentBranch();

  // Load and display files
  await loadCommitDialogFiles();

  // Ensure unstaged tab is active
  switchTab('unstaged');

  // Focus on summary input
  setTimeout(() => {
    if (summary) summary.focus();
  }, 100);

  updateCommitButtons();
}

// Load current branch name
async function loadCurrentBranch() {
  try {
    const branch = await window.api.getCurrentBranch(currentGitRoot);
    const branchName = document.getElementById('git-branch-name');
    const pushDest = document.getElementById('git-push-destination');

    if (branchName) {
      branchName.textContent = branch || 'main';
    }

    if (pushDest) {
      pushDest.textContent = `Push to origin/${branch || 'main'}`;
    }
  } catch (error) {
    console.error('Error loading branch:', error);
  }
}

// Load files for commit dialog
async function loadCommitDialogFiles() {
  const filesList = document.getElementById('git-files-list');
  if (!filesList) return;

  filesList.innerHTML = '<div class="git-empty-state">Loading files...</div>';

  try {
    // Get current git status
    await refreshGitStatus();

    // Build file list
    allFiles = [];
    gitStatusCache.forEach((status, relativePath) => {
      allFiles.push({ path: relativePath, status });
    });

    // Render files based on current tab
    renderFilesList();
    updateTabCounts();

  } catch (error) {
    console.error('Error loading commit files:', error);
    filesList.innerHTML = '<div class="git-empty-state">Error loading files</div>';
  }
}

// Render files list based on current tab
function renderFilesList() {
  const filesList = document.getElementById('git-files-list');
  if (!filesList) return;

  // Filter files based on tab
  const filesToShow = currentTab === 'staged'
    ? allFiles.filter(f => stagedFiles.has(f.path))
    : allFiles.filter(f => !stagedFiles.has(f.path));

  if (filesToShow.length === 0) {
    const message = currentTab === 'staged'
      ? 'No files staged'
      : 'No changes to commit';
    filesList.innerHTML = `<div class="git-empty-state">${message}</div>`;
    return;
  }

  // Render files
  filesList.innerHTML = '';
  filesToShow.forEach(file => {
    const item = createFileItem(file);
    filesList.appendChild(item);
  });
}

// Update tab counts
function updateTabCounts() {
  const stagedCount = document.getElementById('git-staged-count');
  const unstagedCount = document.getElementById('git-unstaged-count');

  if (stagedCount) {
    stagedCount.textContent = `(${stagedFiles.size})`;
  }

  if (unstagedCount) {
    unstagedCount.textContent = `(${allFiles.length - stagedFiles.size})`;
  }
}

// Create file item element
function createFileItem(file) {
  const item = document.createElement('div');
  item.className = 'git-file-item';
  item.dataset.path = file.path;

  // File icon with status
  const icon = document.createElement('div');
  icon.className = `git-file-icon ${file.status}`;

  // Icon SVG based on status
  const iconSvg = {
    'modified': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'added': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'deleted': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 6H5H21M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'untracked': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'renamed': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  icon.innerHTML = iconSvg[file.status] || iconSvg.modified;

  // File info (name and path)
  const fileInfo = document.createElement('div');
  fileInfo.className = 'git-file-info';

  const fileName = document.createElement('div');
  fileName.className = 'git-file-name';
  const pathParts = file.path.split('/');
  fileName.textContent = pathParts[pathParts.length - 1];
  fileName.title = file.path;

  const filePath = document.createElement('div');
  filePath.className = 'git-file-path';
  filePath.textContent = pathParts.slice(0, -1).join('/') || '/';
  filePath.title = file.path;

  fileInfo.appendChild(fileName);
  fileInfo.appendChild(filePath);

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'git-file-checkbox';
  checkbox.checked = stagedFiles.has(file.path);
  checkbox.addEventListener('change', (e) => {
    e.stopPropagation();
    handleFileCheckbox(file.path, e.target.checked);
  });

  item.appendChild(icon);
  item.appendChild(fileInfo);
  item.appendChild(checkbox);

  // Click on item toggles checkbox
  item.addEventListener('click', (e) => {
    if (e.target !== checkbox) {
      checkbox.checked = !checkbox.checked;
      handleFileCheckbox(file.path, checkbox.checked);
    }
  });

  return item;
}

// Handle file checkbox change
async function handleFileCheckbox(filePath, isChecked) {
  try {
    if (isChecked) {
      // Stage file - pass relative path directly
      const result = await window.api.gitAdd(currentGitRoot, filePath);
      if (!result.success) {
        throw new Error(result.error || 'Failed to stage file');
      }
      stagedFiles.add(filePath);
    } else {
      // Unstage file - pass relative path directly
      const result = await window.api.gitReset(currentGitRoot, filePath);
      if (!result.success) {
        throw new Error(result.error || 'Failed to unstage file');
      }
      stagedFiles.delete(filePath);
    }

    // Re-render list and update counts
    renderFilesList();
    updateTabCounts();
    updateCommitButtons();
  } catch (error) {
    console.error('Error staging/unstaging file:', error);
    window.showNotification('Error: ' + error.message, 3000);

    // Revert checkbox state on error
    renderFilesList();
  }
}

// Update commit button states
function updateCommitButtons() {
  const commitBtn = document.getElementById('git-commit-submit');
  const summary = document.getElementById('git-commit-summary');
  const btnText = document.getElementById('git-commit-btn-text');

  const hasMessage = summary && summary.value.trim().length > 0;
  const hasStaged = stagedFiles.size > 0;
  const canCommit = hasMessage && hasStaged;

  if (commitBtn) {
    commitBtn.disabled = !canCommit;
  }

  if (btnText) {
    btnText.textContent = `Commit ${stagedFiles.size} File${stagedFiles.size !== 1 ? 's' : ''}`;
  }
}

// Close commit dialog
function closeCommitDialog() {
  const modal = document.getElementById('git-commit-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
  stagedFiles.clear();
}

// Commit from dialog
async function commitFromDialog() {
  const summary = document.getElementById('git-commit-summary');
  const description = document.getElementById('git-commit-description');
  const autoPush = document.getElementById('git-auto-push');

  if (!summary) return;

  const summaryText = summary.value.trim();
  if (!summaryText) {
    window.showNotification('Commit message required', 2000);
    return;
  }

  if (stagedFiles.size === 0) {
    window.showNotification('No files staged for commit', 2000);
    return;
  }

  // Build full commit message
  let message = summaryText;
  if (description && description.value.trim()) {
    message += '\n\n' + description.value.trim();
  }

  const fileCount = stagedFiles.size;
  const shouldPush = autoPush && autoPush.checked;

  // Log staged files for debugging
  console.log('Staged files:', Array.from(stagedFiles));

  closeCommitDialog();

  try {
    // Show committing message
    window.showNotification(`Committing ${fileCount} file${fileCount !== 1 ? 's' : ''}...`, 1500);

    // Commit
    const commitResult = await window.api.gitCommit(currentGitRoot, message);
    if (!commitResult.success) {
      console.error('Commit failed:', commitResult.error);
      throw new Error(commitResult.error || 'Commit failed');
    }

    await refreshGitStatus();

    // Show success message
    if (shouldPush) {
      window.showNotification(`✓ Committed ${fileCount} file${fileCount !== 1 ? 's' : ''}. Pushing...`, 2000);

      // Push
      const pushResult = await window.api.gitPush(currentGitRoot);
      if (!pushResult.success) {
        window.showNotification(`✓ Committed, but push failed: ${pushResult.error}`, 4000);
        return;
      }

      window.showNotification(`✓ Successfully committed and pushed ${fileCount} file${fileCount !== 1 ? 's' : ''}!`, 3000);
    } else {
      window.showNotification(`✓ Successfully committed ${fileCount} file${fileCount !== 1 ? 's' : ''}!`, 3000);
    }
  } catch (error) {
    console.error('Error in commit/push:', error);
    window.showNotification('✗ Failed: ' + error.message, 4000);
  }
}

// Select all files in current tab
function selectAllFiles() {
  const filesToSelect = currentTab === 'staged'
    ? allFiles.filter(f => stagedFiles.has(f.path))
    : allFiles.filter(f => !stagedFiles.has(f.path));

  filesToSelect.forEach(file => {
    if (currentTab === 'unstaged') {
      const fullPath = `${currentGitRoot}/${file.path}`;
      window.api.gitAdd(currentGitRoot, fullPath);
      stagedFiles.add(file.path);
    }
  });

  renderFilesList();
  updateTabCounts();
  updateCommitButtons();
}

// Switch tabs
function switchTab(tab) {
  currentTab = tab;

  // Update tab UI
  const stagedTab = document.getElementById('git-tab-staged');
  const unstagedTab = document.getElementById('git-tab-unstaged');

  if (stagedTab) {
    stagedTab.classList.toggle('active', tab === 'staged');
  }

  if (unstagedTab) {
    unstagedTab.classList.toggle('active', tab === 'unstaged');
  }

  // Re-render files
  renderFilesList();
}

// Setup commit dialog event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Header button to open dialog
  const gitCommitBtn = document.getElementById('git-commit-btn');
  if (gitCommitBtn) {
    gitCommitBtn.addEventListener('click', showCommitDialog);
  }

  // Dialog buttons
  const commitSubmitBtn = document.getElementById('git-commit-submit');
  const backBtn = document.getElementById('git-commit-back');
  const selectAllBtn = document.getElementById('git-select-all');
  const commitModal = document.getElementById('git-commit-modal');
  const summaryInput = document.getElementById('git-commit-summary');
  const descriptionInput = document.getElementById('git-commit-description');

  // Tab buttons
  const stagedTab = document.getElementById('git-tab-staged');
  const unstagedTab = document.getElementById('git-tab-unstaged');

  if (commitSubmitBtn) {
    commitSubmitBtn.addEventListener('click', commitFromDialog);
  }

  if (backBtn) {
    backBtn.addEventListener('click', closeCommitDialog);
  }

  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', selectAllFiles);
  }

  if (stagedTab) {
    stagedTab.addEventListener('click', () => switchTab('staged'));
  }

  if (unstagedTab) {
    unstagedTab.addEventListener('click', () => switchTab('unstaged'));
  }

  // Close on overlay click
  if (commitModal) {
    commitModal.addEventListener('click', (e) => {
      if (e.target === commitModal) {
        closeCommitDialog();
      }
    });
  }

  // Update button states as user types
  if (summaryInput) {
    summaryInput.addEventListener('input', updateCommitButtons);

    // Keyboard shortcuts
    summaryInput.addEventListener('keydown', (e) => {
      // Cmd/Ctrl + Enter to commit
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        commitFromDialog();
      }
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        closeCommitDialog();
      }
    });
  }

  if (descriptionInput) {
    // Keyboard shortcuts for description
    descriptionInput.addEventListener('keydown', (e) => {
      // Cmd/Ctrl + Enter to commit
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        commitFromDialog();
      }
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        closeCommitDialog();
      }
    });
  }

  // Global keyboard shortcut for Git commit
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'G') {
      e.preventDefault();
      if (gitEnabled) {
        showCommitDialog();
      }
    }
  });

  // Branch switcher event listeners
  const branchBadge = document.getElementById('git-current-branch');
  const branchCloseBtn = document.getElementById('git-branch-close');
  const branchModal = document.getElementById('git-branch-modal');
  const createBranchBtn = document.getElementById('git-create-branch-btn');
  const branchInput = document.getElementById('git-new-branch-name');

  if (branchBadge) {
    branchBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      showBranchSwitcher();
    });
  }

  if (branchCloseBtn) {
    branchCloseBtn.addEventListener('click', closeBranchSwitcher);
  }

  if (branchModal) {
    branchModal.addEventListener('click', (e) => {
      if (e.target === branchModal) {
        closeBranchSwitcher();
      }
    });
  }

  if (createBranchBtn) {
    createBranchBtn.addEventListener('click', createNewBranch);
  }

  if (branchInput) {
    branchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        createNewBranch();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeBranchSwitcher();
      }
    });
  }
});

// Listen for editor changes
if (typeof editor !== 'undefined' && editor) {
  editor.onDidChangeModel(() => {
    if (gitEnabled) {
      updateEditorGitDecorations();
    }
  });
}

// Cleanup on workspace change
function cleanupGit() {
  if (gitStatusInterval) {
    clearInterval(gitStatusInterval);
    gitStatusInterval = null;
  }
  gitEnabled = false;
  currentGitRoot = null;
  gitStatusCache.clear();
  fileDecorations.clear();
}

// Branch Switcher Functions
async function showBranchSwitcher() {
  if (!gitEnabled || !currentGitRoot) {
    window.showNotification('Git not enabled for this workspace', 2000);
    return;
  }

  const modal = document.getElementById('git-branch-modal');
  if (!modal) return;

  // Clear input
  const branchInput = document.getElementById('git-new-branch-name');
  if (branchInput) branchInput.value = '';

  // Show modal
  modal.classList.remove('hidden');

  // Load branches
  await loadBranches();
}

function closeBranchSwitcher() {
  const modal = document.getElementById('git-branch-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

async function loadBranches() {
  const branchList = document.getElementById('git-branch-list');
  if (!branchList) return;

  branchList.innerHTML = '<div class="git-branch-loading">Loading branches...</div>';

  try {
    const branches = await window.api.getAllBranches(currentGitRoot);

    if (branches.length === 0) {
      branchList.innerHTML = '<div class="git-branch-loading">No branches found</div>';
      return;
    }

    // Render branches
    branchList.innerHTML = '';
    branches.forEach(branch => {
      const item = createBranchItem(branch);
      branchList.appendChild(item);
    });

  } catch (error) {
    console.error('Error loading branches:', error);
    branchList.innerHTML = '<div class="git-branch-loading">Error loading branches</div>';
  }
}

function createBranchItem(branch) {
  const item = document.createElement('div');
  item.className = 'git-branch-item';
  if (branch.current) {
    item.classList.add('current');
  }

  const icon = document.createElement('div');
  icon.className = 'git-branch-icon';
  icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.75 2.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm-2.5 1.25a2.5 2.5 0 0 1 4.607 1.332c.355.028.672.126.945.288A2.478 2.478 0 0 1 16 7.5c0 1.126-.694 2.191-1.83 2.54-.424.13-.89.16-1.337.06l-.281-.063c-.094.753-.421 1.432-.905 1.96A3.828 3.828 0 0 1 9 13c-.598 0-1.163-.144-1.647-.397A3.828 3.828 0 0 1 6 11c0-.598.144-1.163.397-1.647A3.828 3.828 0 0 1 9 8c.598 0 1.163.144 1.647.397A2.478 2.478 0 0 0 11 10.5c0 .126.01.251.03.373l.281.063c.291.065.61.046.897-.042.768-.236 1.292-.973 1.292-1.894 0-.753-.461-1.394-1.117-1.661a.997.997 0 0 0-.593-.061l-.248.062a.5.5 0 0 1-.604-.373 1.5 1.5 0 1 0-2.876.586.5.5 0 0 1-.166.635l-.175.14a2.5 2.5 0 1 0 .76 3.457.5.5 0 0 1 .82.573A3.5 3.5 0 1 1 5 9c0-.818.393-1.544 1-2v5a2 2 0 1 0 4 0v-3a1 1 0 0 1 1.647-.765z"/></svg>';

  const name = document.createElement('div');
  name.className = 'git-branch-item-name';
  name.textContent = branch.name;

  item.appendChild(icon);
  item.appendChild(name);

  if (branch.current) {
    const badge = document.createElement('span');
    badge.className = 'git-branch-current-badge';
    badge.textContent = 'Current';
    item.appendChild(badge);
  }

  // Click to switch (if not current)
  if (!branch.current) {
    item.addEventListener('click', () => switchToBranch(branch.name));
  }

  return item;
}

async function switchToBranch(branchName) {
  closeBranchSwitcher();

  try {
    window.showNotification(`Switching to ${branchName}...`, 1500);

    const result = await window.api.switchBranch(currentGitRoot, branchName);

    if (result.success) {
      window.showNotification(`✓ Switched to branch '${branchName}'`, 2500);

      // Refresh git status and update UI
      await refreshGitStatus();
      await loadCurrentBranch();
    } else {
      window.showNotification(`✗ Failed to switch: ${result.error}`, 3000);
    }
  } catch (error) {
    console.error('Error switching branch:', error);
    window.showNotification('✗ Failed to switch branch', 3000);
  }
}

async function createNewBranch() {
  const branchInput = document.getElementById('git-new-branch-name');
  if (!branchInput) return;

  const branchName = branchInput.value.trim();
  if (!branchName) {
    window.showNotification('Branch name required', 2000);
    return;
  }

  // Validate branch name
  if (!/^[a-zA-Z0-9/_-]+$/.test(branchName)) {
    window.showNotification('Invalid branch name. Use letters, numbers, /, -, _', 3000);
    return;
  }

  closeBranchSwitcher();

  try {
    window.showNotification(`Creating branch '${branchName}'...`, 1500);

    const result = await window.api.createBranch(currentGitRoot, branchName, true);

    if (result.success) {
      window.showNotification(`✓ Created and switched to '${branchName}'`, 2500);

      // Refresh git status and update UI
      await refreshGitStatus();
      await loadCurrentBranch();
    } else {
      window.showNotification(`✗ Failed to create: ${result.error}`, 3000);
    }
  } catch (error) {
    console.error('Error creating branch:', error);
    window.showNotification('✗ Failed to create branch', 3000);
  }
}

// Export functions
window.git = {
  init: initGit,
  refresh: refreshGitStatus,
  getFileStatus: getFileGitStatus,
  stageFile,
  unstageFile,
  commit: gitCommit,
  push: gitPush,
  pull: gitPull,
  showCommitDialog,
  closeCommitDialog,
  showBranchSwitcher,
  closeBranchSwitcher,
  cleanup: cleanupGit,
  isEnabled: () => gitEnabled
};
