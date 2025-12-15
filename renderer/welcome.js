// Welcome Screen Management

const welcomeScreen = document.getElementById('welcome-screen');
const editorContainer = document.getElementById('editor-container');

// Show welcome screen
async function showWelcomeScreen() {
  welcomeScreen.classList.add('active');
  editorContainer.style.display = 'none';
  await loadRecentWorkspaces();
}

// Hide welcome screen
function hideWelcomeScreen() {
  welcomeScreen.classList.remove('active');
  editorContainer.style.display = 'block';
}

// Load and display recent workspaces
async function loadRecentWorkspaces() {
  const recentContainer = document.getElementById('recent-workspaces');
  const recentWorkspaces = await window.api.getRecentWorkspaces();

  if (recentWorkspaces.length === 0) {
    recentContainer.innerHTML = '<p class="welcome-empty">No recent folders</p>';
    return;
  }

  recentContainer.innerHTML = recentWorkspaces.map(workspace => {
    // Get relative time display
    const timeAgo = getTimeAgo(workspace.lastOpened);

    return `
      <a href="#" class="welcome-link" data-action="open-recent" data-workspace="${workspace.path}">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M14.5 3H7.70996L6.85999 2.15002L6.51001 2H1.51001L1.01001 2.5V6.5V13.5L1.51001 14H14.51L15.01 13.5V9V3.5L14.5 3ZM13.99 11.49V13H1.98999V11.49V7.48999V7H6.47998L6.82996 6.84998L7.68994 5.98999H14V7.48999L13.99 11.49ZM13.99 5H7.48999L7.14001 5.15002L6.28003 6.01001H2V3.01001H6.29004L7.14001 3.85999L7.5 4.01001H14L13.99 5Z" fill="#C5C5C5"/>
</svg>

        <span class="recent-workspace-info">
          <span class="recent-workspace-name">${escapeHtml(workspace.name)}</span>
          <span class="recent-workspace-path">${escapeHtml(workspace.path)}</span>
        </span>
      </a>
    `;
  }).join('');
}

// Get time ago string
function getTimeAgo(isoDate) {
  const now = new Date();
  const past = new Date(isoDate);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return past.toLocaleDateString();
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle welcome screen link clicks using event delegation
welcomeScreen.addEventListener('click', async (e) => {
  const link = e.target.closest('.welcome-link');
  if (!link) return;

  e.preventDefault();
  const action = link.dataset.action;

  switch (action) {
    case 'new-file':
      // Create a new untitled file
      hideWelcomeScreen();
      if (typeof createNewUntitledFile === 'function') {
        createNewUntitledFile();
      }
      break;

    case 'open-file':
      // Open file dialog
      const fileResult = await window.api.openFile();
      if (fileResult) {
        hideWelcomeScreen();
        // The file will be opened by the existing handler in editor.js
      }
      break;

    case 'open-folder':
      // Open folder dialog
      const folderPath = await window.api.openFolder();
      if (folderPath && typeof openWorkspace === 'function') {
        hideWelcomeScreen();
        await openWorkspace(folderPath);
      }
      break;

    case 'open-recent':
      // Open recent workspace
      const workspace = link.dataset.workspace;
      if (workspace && typeof openWorkspace === 'function') {
        hideWelcomeScreen();
        await openWorkspace(workspace);
      }
      break;
  }
});

// Show welcome screen on initial load if no files open
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!openTabs || openTabs.length === 0) {
      showWelcomeScreen();
    }
  });
} else {
  if (typeof openTabs !== 'undefined' && openTabs.length === 0) {
    showWelcomeScreen();
  }
}

// Export functions for use in other modules
window.showWelcomeScreen = showWelcomeScreen;
window.hideWelcomeScreen = hideWelcomeScreen;
