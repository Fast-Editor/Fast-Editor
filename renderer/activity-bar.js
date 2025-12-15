// Activity Bar Handler

// Activity bar item click handlers
document.querySelectorAll('.activity-item').forEach((item, index) => {
  item.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const wasActive = item.classList.contains('active');

    // Get views
    const explorerView = document.getElementById('explorer-view');
    const searchView = document.getElementById('search-view');

    // Remove active class from all items
    document.querySelectorAll('.activity-item').forEach(i => i.classList.remove('active'));

    // Hide all views
    document.querySelectorAll('.sidebar-view').forEach(v => v.classList.remove('active'));

    // First item is Explorer (index 0)
    if (index === 0) {
      if (wasActive) {
        // If Explorer was already active, hide sidebar
        sidebar.classList.add('hidden');
      } else {
        // If Explorer was not active, show sidebar and make it active
        sidebar.classList.remove('hidden');
        item.classList.add('active');
        explorerView.classList.add('active');
      }

      // Trigger editor resize
      if (typeof editor !== 'undefined' && editor) {
        setTimeout(() => editor.layout(), 100);
      }
    } else if (index === 1) {
      // Second item is Search
      if (wasActive) {
        // If Search was already active, hide sidebar
        sidebar.classList.add('hidden');
      } else {
        // If Search was not active, show sidebar and make it active
        sidebar.classList.remove('hidden');
        item.classList.add('active');
        searchView.classList.add('active');

        // Focus search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          setTimeout(() => searchInput.focus(), 100);
        }
      }

      // Trigger editor resize
      if (typeof editor !== 'undefined' && editor) {
        setTimeout(() => editor.layout(), 100);
      }
    } else {
      // Other items can be implemented later
      item.classList.add('active');
    }
  });
});

// Update breadcrumb when file changes
function updateBreadcrumb(filePath) {
  const breadcrumbEl = document.getElementById('breadcrumb-path');
  if (!filePath) {
    breadcrumbEl.textContent = '';
    return;
  }

  // Get workspace relative path if workspace is open
  let displayPath = filePath;
  if (currentWorkspacePath && filePath.startsWith(currentWorkspacePath)) {
    displayPath = filePath.substring(currentWorkspacePath.length + 1);
  }

  // Split path and create breadcrumb
  const parts = displayPath.split('/');
  breadcrumbEl.innerHTML = parts.map((part, index) => {
    if (index === parts.length - 1) {
      return `<span class="breadcrumb-file">${part}</span>`;
    }
    return `<span class="breadcrumb-folder">${part}</span><span class="breadcrumb-separator">›</span>`;
  }).join('');
}

// Export for use in other modules
window.updateBreadcrumb = updateBreadcrumb;
