// Sidebar and File Explorer
let currentWorkspacePath = null;
let expandedDirs = new Set();

// Performance: Debounce timers for batching updates
let refreshTreeTimer = null;
let saveStateTimer = null;

// Initialize sidebar
async function initSidebar() {
  // Check if this is a new window (should start with empty slate)
  const urlParams = new URLSearchParams(window.location.search);
  const isNewWindow = urlParams.get('newWindow') === 'true';

  // Skip loading workspace state for new windows
  if (isNewWindow) {
    console.log('Opening new window with empty slate');
    return;
  }

  // Load workspace state
  const state = await window.api.loadWorkspaceState();
  if (state.workspace) {
    await openWorkspace(state.workspace);
  }

  // Restore expanded directories
  if (state.expandedDirs) {
    expandedDirs = new Set(state.expandedDirs);
  }
}

// Open folder dialog
async function openFolderDialog() {
  const folderPath = await window.api.openFolder();
  if (folderPath) {
    await openWorkspace(folderPath);
  }
}

// Open workspace
async function openWorkspace(workspacePath) {
  // Close all previously opened tabs
  if (typeof window.closeAllTabs === 'function') {
    window.closeAllTabs();
  }

  currentWorkspacePath = workspacePath;
  const folderName = workspacePath.split('/').pop();
  document.getElementById('workspace-name').textContent = folderName;

  // Load file tree
  await loadFileTree(workspacePath);

  // Initialize git integration
  if (window.git && window.git.init) {
    await window.git.init(workspacePath);
  }

  // Initialize LSP integration
  if (window.lsp && window.lsp.init) {
    await window.lsp.init(workspacePath);
  }

  // Save workspace state
  await saveWorkspaceState();
}

// Load file tree with virtual scrolling optimization
async function loadFileTree(dirPath, parentElement = null) {
  const treeContainer = parentElement || document.getElementById('file-tree');

  if (!parentElement) {
    treeContainer.innerHTML = '<div class="loading-tree">Loading...</div>';
  }

  const entries = await window.api.readDirectory(dirPath);

  if (!parentElement) {
    treeContainer.innerHTML = '';
  }

  // Filter out hidden files and common ignore patterns
  const filteredEntries = entries.filter(entry => {
    return !entry.name.startsWith('.') &&
           entry.name !== 'node_modules' &&
           entry.name !== '__pycache__';
  });

  // Performance: Render in chunks for large directories (virtual scrolling)
  if (filteredEntries.length > 100 && !parentElement) {
    // Show loading indicator for large directories
    treeContainer.innerHTML = `<div class="loading-tree">Loading ${filteredEntries.length} items...</div>`;
    // Small delay to show the message
    await new Promise(resolve => setTimeout(resolve, 10));
    treeContainer.innerHTML = '';
    await renderFileTreeInChunks(filteredEntries, treeContainer);
  } else {
    // Small directory: render all at once
    filteredEntries.forEach(entry => {
      const entryEl = createFileTreeEntry(entry);
      treeContainer.appendChild(entryEl);

      // If directory was previously expanded, expand it again
      if (entry.isDirectory && expandedDirs.has(entry.path)) {
        expandDirectory(entry.path, entryEl);
      }
    });
  }
}

// Render file tree in chunks (non-blocking for large directories)
async function renderFileTreeInChunks(entries, container) {
  const CHUNK_SIZE = 50; // Render 50 items per frame
  let index = 0;

  const renderChunk = () => {
    const startTime = performance.now();

    // Render items until we've spent ~16ms (60fps) or finished the chunk
    while (index < entries.length && (performance.now() - startTime) < 16) {
      const entry = entries[index];
      const entryEl = createFileTreeEntry(entry);
      container.appendChild(entryEl);

      // If directory was previously expanded, expand it again
      if (entry.isDirectory && expandedDirs.has(entry.path)) {
        expandDirectory(entry.path, entryEl);
      }

      index++;
    }

    // If more items to render, schedule next chunk
    if (index < entries.length) {
      requestAnimationFrame(renderChunk);
    }
  };

  // Start rendering
  requestAnimationFrame(renderChunk);
}

// Create file tree entry
function createFileTreeEntry(entry) {
  const entryEl = document.createElement('div');
  entryEl.className = 'tree-entry';
  entryEl.dataset.path = entry.path;
  entryEl.dataset.isDirectory = entry.isDirectory;
  entryEl.dataset.name = entry.name;

  const icon = entry.isDirectory ? '<span class="expand-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.0719 8.024L5.7146 3.66669L6.33332 3.04797L11 7.71464V8.33336L6.33332 13L5.7146 12.3813L10.0719 8.024Z" fill="#C5C5C5"/></svg></span>' : getFileIcon(entry.name);

  entryEl.innerHTML = `
    <div class="tree-item" data-path="${entry.path}" draggable="true">
      <span class="tree-icon">${icon}</span>
      <span class="tree-name">${entry.name}</span>
    </div>
  `;

  const itemEl = entryEl.querySelector('.tree-item');

  if (entry.isDirectory) {
    itemEl.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleDirectory(entry.path, entryEl);
    });
  } else {
    itemEl.addEventListener('click', async (e) => {
      e.stopPropagation();
      await openFileInEditor(entry.path);
    });
  }

  // Drag and drop support
  setupDragAndDrop(entryEl, itemEl, entry);

  return entryEl;
}

// Toggle directory expansion
async function toggleDirectory(dirPath, entryEl) {
  const isExpanded = expandedDirs.has(dirPath);

  if (isExpanded) {
    // Collapse
    expandedDirs.delete(dirPath);
    const childContainer = entryEl.querySelector('.tree-children');
    if (childContainer) {
      childContainer.remove();
    }
    const expandIcon = entryEl.querySelector('.expand-icon');
    const folderIcon = entryEl.querySelector('.tree-icon span');
    if (expandIcon) {
expandIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.0719 8.024L5.7146 3.66669L6.33332 3.04797L11 7.71464V8.33336L6.33332 13L5.7146 12.3813L10.0719 8.024Z" fill="#C5C5C5"/></svg>';
    }
    if (folderIcon) {
      folderIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.0719 8.024L5.7146 3.66669L6.33332 3.04797L11 7.71464V8.33336L6.33332 13L5.7146 12.3813L10.0719 8.024Z" fill="#C5C5C5"/></svg>';    }
  } else {
    // Expand
    expandedDirs.add(dirPath);
    await expandDirectory(dirPath, entryEl);
  }

  // Performance: Debounce state save (batch rapid expand/collapse)
  scheduleSaveWorkspaceState();
}

// Expand directory
async function expandDirectory(dirPath, entryEl) {
  const expandIcon = entryEl.querySelector('.expand-icon');
  const folderIcon = entryEl.querySelector('.tree-icon span');
  if (expandIcon) {
    
  expandIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.97612 10.0719L12.3334 5.7146L12.9521 6.33332L8.28548 11L7.66676 11L3.0001 6.33332L3.61882 5.7146L7.97612 10.0719Z" fill="#C5C5C5"/></svg>';

  }
  if (folderIcon) {
     folderIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.97612 10.0719L12.3334 5.7146L12.9521 6.33332L8.28548 11L7.66676 11L3.0001 6.33332L3.61882 5.7146L7.97612 10.0719Z" fill="#C5C5C5"/></svg>';

  }

  // Create children container
  let childContainer = entryEl.querySelector('.tree-children');
  if (!childContainer) {
    childContainer = document.createElement('div');
    childContainer.className = 'tree-children';
    entryEl.appendChild(childContainer);
  }

  await loadFileTree(dirPath, childContainer);
}

// Get file icon based on extension (VS Code style)
function getFileIcon(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();

  // SVG icons matching VS Code style with official logo colors
  const iconMap = {
    // JavaScript/TypeScript (Official colors: JS=#F7DF1E, TS=#3178C6)
    'js': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#F7DF1E" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="10" font-weight="600">JS</text></svg>',
    'mjs': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#F7DF1E" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="10" font-weight="600">JS</text></svg>',
    'cjs': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#F7DF1E" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="10" font-weight="600">JS</text></svg>',
    'jsx': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#61DAFB" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">JSX</text></svg>',
    'ts': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#3178C6" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="10" font-weight="600">TS</text></svg>',
    'mts': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#3178C6" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="10" font-weight="600">TS</text></svg>',
    'cts': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#3178C6" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="10" font-weight="600">TS</text></svg>',
    'tsx': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#3178C6" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">TSX</text></svg>',

    // Data formats
    'json': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#FFCA28" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="11" font-weight="600">{}</text></svg>',
    'jsonc': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#FFCA28" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="11" font-weight="600">{}</text></svg>',
    'json5': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#FFCA28" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="11" font-weight="600">{}</text></svg>',
    'yaml': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#CB4A31" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="8" font-weight="600">YML</text></svg>',
    'yml': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#CB4A31" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="8" font-weight="600">YML</text></svg>',
    'toml': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#9C4221" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="7" font-weight="600">TOML</text></svg>',
    'xml': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#E37933" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">XML</text></svg>',

    // Web (Official colors: HTML5=#E34C26, CSS3=#264DE4)
    'html': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#E34F26" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="8" font-weight="600">HTML</text></svg>',
    'htm': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#E34F26" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="8" font-weight="600">HTM</text></svg>',
    'xhtml': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#E34F26" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="7" font-weight="600">XHTML</text></svg>',
    'css': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#264DE4" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">CSS</text></svg>',
    'scss': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#CC6699" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="8" font-weight="600">SCSS</text></svg>',
    'sass': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#CC6699" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="8" font-weight="600">SASS</text></svg>',
    'less': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#1D365D" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="8" font-weight="600">LESS</text></svg>',

    // Frameworks
    'vue': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#42B883" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">VUE</text></svg>',
    'svelte': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#FF3E00" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="7" font-weight="600">SVELTE</text></svg>',

    // Python (Official: #3776AB blue, #FFD43B yellow)
    'py': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#3776AB" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="10" font-weight="600">PY</text></svg>',
    'pyw': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#3776AB" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">PYW</text></svg>',
    'pyc': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#3776AB" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">PYC</text></svg>',

    // Java
    'java': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#B07219" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="8" font-weight="600">JAVA</text></svg>',
    'class': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#B07219" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="7" font-weight="600">CLASS</text></svg>',
    'jar': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#B07219" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">JAR</text></svg>',

    // C/C++
    'c': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#555555" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="11" font-weight="600">C</text></svg>',
    'cpp': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#00599C" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">CPP</text></svg>',
    'cc': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#00599C" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">CC</text></svg>',
    'cxx': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#00599C" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">CXX</text></svg>',
    'h': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#A074C4" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="11" font-weight="600">H</text></svg>',
    'hpp': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#A074C4" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">HPP</text></svg>',
    'hxx': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#A074C4" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">HXX</text></svg>',

    // C#
    'cs': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#239120" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="10" font-weight="600">CS</text></svg>',
    'csx': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#239120" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">CSX</text></svg>',

    // Other languages
    'go': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#00ADD8" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="10" font-weight="600">GO</text></svg>',
    'rs': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#DEA584" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="10" font-weight="600">RS</text></svg>',
    'rb': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#CC342D" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="10" font-weight="600">RB</text></svg>',
    'php': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#777BB4" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">PHP</text></svg>',
    'swift': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#FA7343" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="7" font-weight="600">SWIFT</text></svg>',
    'kt': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#7F52FF" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="10" font-weight="600">KT</text></svg>',
    'scala': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#DC322F" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="7" font-weight="600">SCALA</text></svg>',
    'dart': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#0175C2" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="8" font-weight="600">DART</text></svg>',
    'lua': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#000080" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">LUA</text></svg>',
    'r': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#276DC3" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="11" font-weight="600">R</text></svg>',
    'sql': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#E38C00" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">SQL</text></svg>',

    // Shell
    'sh': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#89E051" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="11" font-weight="600">$</text></svg>',
    'bash': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#89E051" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="11" font-weight="600">$</text></svg>',
    'zsh': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#89E051" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="11" font-weight="600">$</text></svg>',
    'fish': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#89E051" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="11" font-weight="600">$</text></svg>',

    // Markdown
    'md': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#083FA1" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="10" font-weight="600">MD</text></svg>',
    'markdown': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#083FA1" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="10" font-weight="600">MD</text></svg>',
    'mdx': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#FFC938" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">MDX</text></svg>',

    // Images
    'png': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#A074C4" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">PNG</text></svg>',
    'jpg': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#A074C4" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">JPG</text></svg>',
    'jpeg': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#A074C4" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="8" font-weight="600">JPEG</text></svg>',
    'gif': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#A074C4" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">GIF</text></svg>',
    'webp': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#A074C4" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="8" font-weight="600">WEBP</text></svg>',
    'svg': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#FFB13B" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">SVG</text></svg>',
    'ico': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#A074C4" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">ICO</text></svg>',

    // Git
    'gitignore': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#F05033" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">GIT</text></svg>',
    'gitattributes': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#F05033" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">GIT</text></svg>',

    // Docker
    'dockerfile': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#2496ED" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="6" font-weight="600">DOCKER</text></svg>',

    // Environment
    'env': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#ECD53F" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">ENV</text></svg>',

    // Archives
    'zip': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#8A8A8A" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">ZIP</text></svg>',
    'tar': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#8A8A8A" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">TAR</text></svg>',
    'gz': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#8A8A8A" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="10" font-weight="600">GZ</text></svg>',
    'rar': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#8A8A8A" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">RAR</text></svg>',

    // Documents
    'pdf': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#E53935" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">PDF</text></svg>',
    'txt': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#6A737D" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">TXT</text></svg>',
    'log': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#6A737D" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Consolas, monospace" font-size="9" font-weight="600">LOG</text></svg>',
  };

  // Check for specific filenames first (before extension check)
  // const lowerName = fileName.toLowerCase();
  // if (lowerName === '.gitignore') return iconMap['gitignore'];
  // if (lowerName === '.gitattributes') return iconMap['gitattributes'];
  // if (lowerName === '.env' || lowerName.startsWith('.env.')) return iconMap['env'];
  // if (lowerName === 'dockerfile' || lowerName.startsWith('dockerfile.')) return iconMap['dockerfile'];
  // if (lowerName === 'docker-compose.yml' || lowerName === 'docker-compose.yaml') return iconMap['dockerfile'];
  // if (lowerName === 'package.json') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#CB3837" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Arial" font-size="7" font-weight="bold">NPM</text></svg>';
  // if (lowerName === 'package-lock.json') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#CB3837" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Arial" font-size="7" font-weight="bold">NPM</text></svg>';
  // if (lowerName === 'yarn.lock') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#2C8EBB" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Arial" font-size="7" font-weight="bold">YARN</text></svg>';
  // if (lowerName === 'tsconfig.json') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#3178C6" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="monospace" font-size="10" font-weight="bold">{}</text></svg>';
  // if (lowerName === 'webpack.config.js' || lowerName === 'webpack.config.ts') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#8DD6F9" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Arial" font-size="7" font-weight="bold">WP</text></svg>';
  // if (lowerName === 'vite.config.js' || lowerName === 'vite.config.ts') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#646CFF" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Arial" font-size="6" font-weight="bold">VITE</text></svg>';
  // if (lowerName === 'readme.md') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#083FA1" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Arial" font-size="7" font-weight="bold">README</text></svg>';
  // if (lowerName === '.eslintrc' || lowerName === '.eslintrc.js' || lowerName === '.eslintrc.json') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#4B32C3" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Arial" font-size="7" font-weight="bold">ESL</text></svg>';
  // if (lowerName === '.prettierrc' || lowerName === '.prettierrc.js' || lowerName === '.prettierrc.json') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#F7B93E" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Arial" font-size="7" font-weight="bold">PR</text></svg>';
  // if (lowerName === 'cargo.toml') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#DEA584" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Arial" font-size="6" font-weight="bold">CARGO</text></svg>';
  // if (lowerName === 'gemfile') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#CC342D" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Arial" font-size="6" font-weight="bold">GEM</text></svg>';
  // if (lowerName === 'makefile') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text fill="#6D8086" x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Arial" font-size="7" font-weight="bold">MAKE</text></svg>';

  // Return icon by extension or default file icon
  return iconMap[ext] || '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 10V9H14V10H2ZM2 6H14V7H2V6ZM14 3V4H2V3H14Z" fill="#C5C5C5"/><path d="M2 12V13H14V12H2Z" fill="#C5C5C5"/></svg>';
}

// Open file in editor
async function openFileInEditor(filePath) {
  // Check if file is already open in a tab
  const existingTab = findTabByPath(filePath);
  if (existingTab) {
    switchToTab(existingTab.id);
    return;
  }

  // Read file content
  const result = await window.api.readFile(filePath);
  if (!result) return;

  const fileName = filePath.split('/').pop();
  const language = getLanguageFromFilePath(filePath);

  // Create Monaco model
  const model = monaco.editor.createModel(result.content, language);

  // Create tab
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

// Toggle sidebar visibility
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('hidden');

  // Toggle active button state based on current view
  const activeView = document.querySelector('.sidebar-view.active');
  if (activeView) {
    const activityItems = document.querySelectorAll('.activity-item');
    if (sidebar.classList.contains('hidden')) {
      // Hide: remove active from all buttons
      activityItems.forEach(item => item.classList.remove('active'));
    } else {
      // Show: restore active state to correct button
      if (activeView.id === 'explorer-view') {
        activityItems[0]?.classList.add('active');
      } else if (activeView.id === 'search-view') {
        activityItems[1]?.classList.add('active');
      }
    }
  }

  // Trigger editor resize
  if (editor) {
    setTimeout(() => editor.layout(), 100);
  }
}

// Save workspace state
async function saveWorkspaceState() {
  const state = {
    workspace: currentWorkspacePath,
    expandedDirs: Array.from(expandedDirs)
  };
  await window.api.saveWorkspaceState(state);
}

// Performance: Debounced workspace state save (batch rapid expand/collapse)
function scheduleSaveWorkspaceState() {
  clearTimeout(saveStateTimer);
  saveStateTimer = setTimeout(() => {
    saveWorkspaceState();
  }, 200); // Save after 200ms of inactivity
}

// Performance: Debounced tree refresh (batch file operations)
function scheduleTreeRefresh() {
  if (!currentWorkspacePath) return;

  clearTimeout(refreshTreeTimer);
  refreshTreeTimer = setTimeout(() => {
    loadFileTree(currentWorkspacePath);
  }, 100); // Refresh after 100ms of inactivity
}

// Refresh file explorer
async function refreshExplorer() {
  if (currentWorkspacePath) {
    await loadFileTree(currentWorkspacePath);
  }
}

// Collapse all folders
function collapseAllFolders() {
  expandedDirs.clear();
  if (currentWorkspacePath) {
    loadFileTree(currentWorkspacePath);
  }
  saveWorkspaceState();
}

// Context menu state
let contextMenuTarget = null;

// Show context menu
function showContextMenu(x, y, targetPath, isDirectory) {
  const contextMenu = document.getElementById('context-menu');
  contextMenuTarget = { path: targetPath, isDirectory };

  // Position context menu
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.classList.remove('hidden');

  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu, { once: true });
  }, 0);
}

// Hide context menu
function hideContextMenu() {
  const contextMenu = document.getElementById('context-menu');
  contextMenu.classList.add('hidden');
  contextMenuTarget = null;
}

// Handle context menu actions
async function handleContextMenuAction(action) {
  if (!contextMenuTarget) return;

  const { path: targetPath, isDirectory } = contextMenuTarget;

  switch (action) {
    case 'new-file':
      await createNewFile(targetPath, isDirectory);
      break;
    case 'new-folder':
      await createNewFolder(targetPath, isDirectory);
      break;
    case 'rename':
      await renameItem(targetPath);
      break;
    case 'delete':
      await deleteItem(targetPath, isDirectory);
      break;
    case 'copy-path':
      await navigator.clipboard.writeText(targetPath);
      break;
    case 'copy-relative-path':
      if (currentWorkspacePath) {
        const relativePath = targetPath.replace(currentWorkspacePath + '/', '');
        await navigator.clipboard.writeText(relativePath);
      }
      break;
    case 'reveal-in-finder':
      // This would require additional IPC handler for shell commands
      console.log('Reveal in Finder:', targetPath);
      break;
  }

  hideContextMenu();
}

// Create new file
async function createNewFile(targetPath, isDirectory) {
  // If target is a file, use its parent directory
  const targetDir = isDirectory ? targetPath : targetPath.substring(0, targetPath.lastIndexOf('/'));
  const fileName = await promptForName('New File Name:', 'newfile.txt');

  if (!fileName) return;

  const filePath = `${targetDir}/${fileName}`;
  const result = await window.api.createFile(filePath, '');

  if (result.success) {
    // Performance: Debounce tree refresh (batch file operations)
    scheduleTreeRefresh();
    // Open the new file in editor
    await openFileInEditor(filePath);
  } else {
    alert(`Failed to create file: ${result.error}`);
  }
}

// Create new folder
async function createNewFolder(targetPath, isDirectory) {
  // If target is a file, use its parent directory
  const targetDir = isDirectory ? targetPath : targetPath.substring(0, targetPath.lastIndexOf('/'));
  const folderName = await promptForName('New Folder Name:', 'newfolder');

  if (!folderName) return;

  const folderPath = `${targetDir}/${folderName}`;
  const result = await window.api.createFolder(folderPath);

  if (result.success) {
    // Performance: Debounce tree refresh (batch file operations)
    scheduleTreeRefresh();
  } else {
    alert(`Failed to create folder: ${result.error}`);
  }
}

// Rename item
async function renameItem(oldPath) {
  const oldName = oldPath.split('/').pop();
  const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
  const newName = await promptForName('Rename to:', oldName);

  if (!newName || newName === oldName) return;

  const newPath = `${parentPath}/${newName}`;
  const result = await window.api.renamePath(oldPath, newPath);

  if (result.success) {
    // Update tabs if file was open
    updateTabsAfterRename(oldPath, newPath);
    // Performance: Debounce tree refresh (batch file operations)
    scheduleTreeRefresh();
  } else {
    alert(`Failed to rename: ${result.error}`);
  }
}

// Delete item
async function deleteItem(targetPath, isDirectory) {
  const itemName = targetPath.split('/').pop();
  const itemType = isDirectory ? 'folder' : 'file';
  const message = `Are you sure you want to delete ${itemType} "${itemName}"?${isDirectory ? ' This will delete all contents.' : ''}`;

  if (!confirm(message)) return;

  const result = await window.api.deletePath(targetPath);

  if (result.success) {
    // Close tabs for deleted files
    if (!isDirectory) {
      closeTabByPath(targetPath);
    } else {
      // Close all tabs for files in deleted folder
      closeTabsInFolder(targetPath);
    }
    // Performance: Debounce tree refresh (batch file operations)
    scheduleTreeRefresh();
  } else {
    alert(`Failed to delete: ${result.error}`);
  }
}

// Custom prompt dialog (replaces browser prompt which doesn't work in Electron)
function promptForName(message, defaultValue) {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';

    // Create dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = 'background: #252526; border: 1px solid #454545; border-radius: 5px; padding: 20px; min-width: 300px; box-shadow: 0 4px 16px rgba(0,0,0,0.5);';

    // Message
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText = 'color: #cccccc; margin-bottom: 12px; font-size: 13px;';

    // Input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultValue || '';
    input.style.cssText = 'width: 100%; padding: 6px; background: #3c3c3c; color: #cccccc; border: 1px solid #454545; border-radius: 3px; font-family: inherit; font-size: 13px; outline: none; margin-bottom: 12px;';
    input.addEventListener('focus', () => {
      input.style.border = '1px solid #007acc';
    });
    input.addEventListener('blur', () => {
      input.style.border = '1px solid #454545';
    });

    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding: 6px 14px; background: #3c3c3c; color: #cccccc; border: 1px solid #454545; border-radius: 3px; cursor: pointer; font-size: 13px;';
    cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.background = '#4e4e4e');
    cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.background = '#3c3c3c');

    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.cssText = 'padding: 6px 14px; background: #0e639c; color: #ffffff; border: 1px solid #0e639c; border-radius: 3px; cursor: pointer; font-size: 13px;';
    okBtn.addEventListener('mouseenter', () => okBtn.style.background = '#1177bb');
    okBtn.addEventListener('mouseleave', () => okBtn.style.background = '#0e639c');

    // Event handlers
    const cleanup = () => document.body.removeChild(overlay);

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    okBtn.addEventListener('click', () => {
      cleanup();
      resolve(input.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        cleanup();
        resolve(input.value);
      } else if (e.key === 'Escape') {
        cleanup();
        resolve(null);
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(null);
      }
    });

    // Assemble dialog
    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(okBtn);
    dialog.appendChild(messageEl);
    dialog.appendChild(input);
    dialog.appendChild(buttonContainer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Focus input
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  });
}

// Update tabs after rename
function updateTabsAfterRename(oldPath, newPath) {
  const tab = findTabByPath(oldPath);
  if (tab) {
    tab.filePath = newPath;
    const fileName = newPath.split('/').pop();
    const tabElement = document.querySelector(`[data-tab-id="${tab.id}"] .tab-name`);
    if (tabElement) {
      tabElement.textContent = fileName;
    }
  }
}

// Close tabs in folder
function closeTabsInFolder(folderPath) {
  const tabsToClose = getAllTabs().filter(tab => tab.filePath && tab.filePath.startsWith(folderPath + '/'));
  tabsToClose.forEach(tab => closeTab(tab.id));
}

// Button handlers for creating files/folders in workspace root or selected folder
async function handleNewFile() {
  if (!currentWorkspacePath) {
    alert('Please open a folder first');
    return;
  }
  await createNewFile(currentWorkspacePath, true);
}

async function handleNewFolder() {
  if (!currentWorkspacePath) {
    alert('Please open a folder first');
    return;
  }
  await createNewFolder(currentWorkspacePath, true);
}

// Setup event listeners
function setupEventListeners() {
  // Menu listeners
  window.api.onMenuOpenFolder(() => openFolderDialog());
  window.api.onMenuToggleSidebar(() => toggleSidebar());

  // File management button listeners
  const newFileBtn = document.getElementById('new-file-btn');
  const newFolderBtn = document.getElementById('new-folder-btn');
  const refreshBtn = document.getElementById('refresh-folder-btn');
  const collapseBtn = document.getElementById('collapse-all-btn');

  if (newFileBtn) {
    newFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleNewFile();
    });
  }

  if (newFolderBtn) {
    newFolderBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleNewFolder();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      refreshExplorer();
    });
  }

  if (collapseBtn) {
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      collapseAllFolders();
    });
  }

  // Context menu listeners
  document.addEventListener('contextmenu', (e) => {
    // Find if click was on a tree item
    const treeItem = e.target.closest('.tree-item');
    if (treeItem) {
      e.preventDefault();
      const path = treeItem.dataset.path;
      const entryEl = treeItem.closest('.tree-entry');
      const expandIcon = entryEl ? entryEl.querySelector('.expand-icon') : null;
      const isDirectory = expandIcon && expandIcon.innerHTML !== '';
      showContextMenu(e.clientX, e.clientY, path, isDirectory);
    }
  });

  // Context menu item clicks
  document.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      handleContextMenuAction(action);
    });
  });

  // Hide context menu on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideContextMenu();
    }
  });
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initSidebar();
  });
} else {
  setupEventListeners();
  initSidebar();
}

// Highlight active file in sidebar
function highlightActiveFileInSidebar(filePath) {
  // Remove active-file class from all tree items
  document.querySelectorAll('.tree-item.active-file').forEach(item => {
    item.classList.remove('active-file');
  });

  if (!filePath) return;

  // Find and highlight the tree item with matching path
  const treeItem = document.querySelector(`.tree-item[data-path="${filePath}"]`);
  if (treeItem) {
    treeItem.classList.add('active-file');

    // Scroll into view if needed
    treeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// ===== Drag and Drop Implementation =====

let draggedElement = null;
let draggedPath = null;

/**
 * Setup drag and drop for a tree entry
 */
function setupDragAndDrop(entryEl, itemEl, entry) {
  // Drag start
  itemEl.addEventListener('dragstart', (e) => {
    draggedElement = entryEl;
    draggedPath = entry.path;

    // Set drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', entry.path);

    // Add visual feedback
    itemEl.classList.add('dragging');
    entryEl.classList.add('dragging');

    // Create drag image (optional)
    e.dataTransfer.setDragImage(itemEl, 20, 10);
  });

  // Drag end
  itemEl.addEventListener('dragend', (e) => {
    // Remove visual feedback
    itemEl.classList.remove('dragging');
    entryEl.classList.remove('dragging');
    document.querySelectorAll('.drop-target').forEach(el => {
      el.classList.remove('drop-target');
    });

    draggedElement = null;
    draggedPath = null;
  });

  // Drag over (for folders - allow drop)
  if (entry.isDirectory) {
    itemEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't allow dropping on self
      if (draggedPath === entry.path) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }

      // Don't allow dropping parent folder into child folder
      if (draggedPath && entry.path.startsWith(draggedPath + '/')) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }

      e.dataTransfer.dropEffect = 'move';
      itemEl.classList.add('drop-target');
    });

    itemEl.addEventListener('dragleave', (e) => {
      itemEl.classList.remove('drop-target');
    });

    // Drop on folder
    itemEl.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      itemEl.classList.remove('drop-target');

      const sourcePath = e.dataTransfer.getData('text/plain');
      const targetFolderPath = entry.path;

      if (!sourcePath || sourcePath === targetFolderPath) {
        return;
      }

      // Don't allow dropping parent folder into child folder
      if (targetFolderPath.startsWith(sourcePath + '/')) {
        alert('Cannot move a folder into itself or its subfolder');
        return;
      }

      await moveFileOrFolder(sourcePath, targetFolderPath);
    });
  }
}

/**
 * Move file or folder to target folder
 */
async function moveFileOrFolder(sourcePath, targetFolderPath) {
  try {
    // Get source name
    const sourceName = sourcePath.split('/').pop();
    const newPath = `${targetFolderPath}/${sourceName}`;

    // Check if target already exists
    const exists = await window.api.pathExists(newPath);
    if (exists) {
      const overwrite = confirm(`"${sourceName}" already exists in the destination folder. Do you want to replace it?`);
      if (!overwrite) {
        return;
      }
      // Delete existing file/folder
      await window.api.deletePath(newPath);
    }

    // Perform the move
    const result = await window.api.renamePath(sourcePath, newPath);

    if (result.success) {
      // Refresh the file tree
      await refreshFileTree();

      // If the moved file was open, update its path in tabs
      updateOpenTabsAfterMove(sourcePath, newPath);

      // Show success notification
      showNotification(`Moved "${sourceName}" successfully`);
    } else {
      alert(`Failed to move: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error moving file/folder:', error);
    alert(`Failed to move: ${error.message}`);
  }
}

/**
 * Update open tabs after a file/folder move
 */
function updateOpenTabsAfterMove(oldPath, newPath) {
  if (typeof getAllTabs !== 'function') {
    return;
  }

  const tabs = getAllTabs();
  tabs.forEach(tab => {
    if (!tab.filePath) return;

    // Check if this tab's file was moved
    if (tab.filePath === oldPath) {
      // Exact match - single file moved
      tab.filePath = newPath;
      tab.name = newPath.split('/').pop();
      updateTabDisplay(tab);
    } else if (tab.filePath.startsWith(oldPath + '/')) {
      // File inside moved folder
      const relativePath = tab.filePath.substring(oldPath.length);
      tab.filePath = newPath + relativePath;
      updateTabDisplay(tab);
    }
  });
}

/**
 * Update tab display after path change
 */
function updateTabDisplay(tab) {
  const tabElement = document.querySelector(`.tab[data-tab-id="${tab.id}"]`);
  if (tabElement) {
    const nameSpan = tabElement.querySelector('.tab-name');
    if (nameSpan) {
      nameSpan.textContent = tab.name;
    }
  }
}

/**
 * Refresh the entire file tree
 */
async function refreshFileTree() {
  if (!currentWorkspacePath) {
    return;
  }

  // Save current expanded state
  await saveWorkspaceState();

  // Reload tree
  await loadFileTree(currentWorkspacePath);
}

// Export functions for use in other modules
window.openWorkspace = openWorkspace;
window.openFolderDialog = openFolderDialog;
window.highlightActiveFileInSidebar = highlightActiveFileInSidebar;
