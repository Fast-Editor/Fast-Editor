const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const pty = require('node-pty');

// Auto-reload in development
if (process.env.NODE_ENV === 'development') {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
    console.log('Auto-reload enabled');
  } catch (err) {
    console.error('electron-reload not available:', err);
  }
}

// Performance: Disable GPU acceleration if not needed (can be toggled)
// app.disableHardwareAcceleration();

let mainWindow;
let windows = new Set(); // Track all windows
let terminals = new Map();
let currentWorkspace = null;

// Workspace state file
const STATE_FILE = path.join(app.getPath('userData'), 'workspace-state.json');

// Performance: Set process priority
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('high-dpi-support', 'true');
}

// Performance: Enable various optimizations
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// Helper function to send menu events to focused window
function sendToFocusedWindow(channel) {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow && !focusedWindow.isDestroyed()) {
    focusedWindow.webContents.send(channel);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#1e1e1e', // VS Code dark theme background
    show: false, // Performance: Don't show until ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Performance optimizations
      backgroundThrottling: false,
      enableWebSQL: false,
      spellcheck: false
    }
  });

  // Performance: Show window only when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile('renderer/index.html');

  // Performance: Clear cache on startup (optional - remove if too aggressive)
  // mainWindow.webContents.session.clearCache();

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Minimal menu for speed
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => createNewWindow()
        },
        { type: 'separator' },
        {
          label: 'Open File',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendToFocusedWindow('menu-open-file')
        },
        {
          label: 'Open Folder',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendToFocusedWindow('menu-open-folder')
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToFocusedWindow('menu-save-file')
        },
        {
          label: 'Save As',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendToFocusedWindow('menu-save-file-as')
        },
        {
          label: 'Save All',
          accelerator: 'CmdOrCtrl+Alt+S',
          click: () => sendToFocusedWindow('menu-save-all')
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => sendToFocusedWindow('menu-close-tab')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => sendToFocusedWindow('menu-find')
        },
        {
          label: 'Replace',
          accelerator: 'CmdOrCtrl+H',
          click: () => sendToFocusedWindow('menu-replace')
        },
        { type: 'separator' },
        {
          label: 'Find in Files',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => sendToFocusedWindow('menu-find-in-files')
        },
        { type: 'separator' },
        {
          label: 'Format Document',
          accelerator: 'Shift+Alt+F',
          click: () => sendToFocusedWindow('menu-format-document')
        },
        {
          label: 'Format Selection',
          click: () => sendToFocusedWindow('menu-format-selection')
        },
        { type: 'separator' },
        {
          label: 'Comment Line',
          accelerator: 'CmdOrCtrl+/',
          click: () => sendToFocusedWindow('menu-comment-line')
        },
        {
          label: 'Block Comment',
          accelerator: 'Shift+Alt+A',
          click: () => sendToFocusedWindow('menu-block-comment')
        },
        { type: 'separator' },
        {
          label: 'Move Line Up',
          accelerator: 'Alt+Up',
          click: () => sendToFocusedWindow('menu-move-line-up')
        },
        {
          label: 'Move Line Down',
          accelerator: 'Alt+Down',
          click: () => sendToFocusedWindow('menu-move-line-down')
        },
        {
          label: 'Copy Line Up',
          accelerator: 'Shift+Alt+Up',
          click: () => sendToFocusedWindow('menu-copy-line-up')
        },
        {
          label: 'Copy Line Down',
          accelerator: 'Shift+Alt+Down',
          click: () => sendToFocusedWindow('menu-copy-line-down')
        },
        {
          label: 'Delete Line',
          accelerator: 'CmdOrCtrl+Shift+K',
          click: () => sendToFocusedWindow('menu-delete-line')
        },
        { type: 'separator' },
        {
          label: 'Transform to Uppercase',
          click: () => sendToFocusedWindow('menu-transform-uppercase')
        },
        {
          label: 'Transform to Lowercase',
          click: () => sendToFocusedWindow('menu-transform-lowercase')
        },
        { type: 'separator' },
        {
          label: 'Trim Trailing Whitespace',
          click: () => sendToFocusedWindow('menu-trim-whitespace')
        }
      ]
    },
    {
      label: 'Go',
      submenu: [
        {
          label: 'Go to File...',
          accelerator: 'CmdOrCtrl+P',
          click: () => sendToFocusedWindow('menu-goto-file')
        },
        {
          label: 'Go to Symbol in File...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendToFocusedWindow('menu-goto-symbol')
        },
        {
          label: 'Go to Symbol in Workspace...',
          accelerator: 'CmdOrCtrl+T',
          click: () => sendToFocusedWindow('menu-goto-symbol-workspace')
        },
        { type: 'separator' },
        {
          label: 'Go to Definition',
          accelerator: 'F12',
          click: () => sendToFocusedWindow('menu-goto-definition')
        },
        {
          label: 'Peek Definition',
          accelerator: 'Alt+F12',
          click: () => sendToFocusedWindow('menu-peek-definition')
        },
        {
          label: 'Go to Type Definition',
          click: () => sendToFocusedWindow('menu-goto-type-definition')
        },
        {
          label: 'Go to Implementation',
          click: () => sendToFocusedWindow('menu-goto-implementation')
        },
        { type: 'separator' },
        {
          label: 'Find All References',
          accelerator: 'Shift+F12',
          click: () => sendToFocusedWindow('menu-find-references')
        },
        { type: 'separator' },
        {
          label: 'Next Error',
          accelerator: 'F8',
          click: () => sendToFocusedWindow('menu-next-error')
        },
        {
          label: 'Previous Error',
          accelerator: 'Shift+F8',
          click: () => sendToFocusedWindow('menu-prev-error')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => sendToFocusedWindow('menu-toggle-sidebar')
        },
        {
          label: 'Toggle Terminal',
          accelerator: 'CmdOrCtrl+`',
          click: () => sendToFocusedWindow('menu-toggle-terminal')
        },
        { type: 'separator' },
        {
          label: 'Toggle Word Wrap',
          accelerator: 'Alt+Z',
          click: () => sendToFocusedWindow('menu-toggle-word-wrap')
        },
        {
          label: 'Toggle Minimap',
          click: () => sendToFocusedWindow('menu-toggle-minimap')
        },
        {
          label: 'Toggle Breadcrumbs',
          click: () => sendToFocusedWindow('menu-toggle-breadcrumbs')
        },
        { type: 'separator' },
        {
          label: 'Open Diff Editor',
          click: () => sendToFocusedWindow('menu-open-diff-editor')
        },
        { type: 'separator' },
        {
          label: 'Theme',
          submenu: [
            {
              label: 'Dark (VS Code Dark)',
              click: () => sendToFocusedWindow('menu-theme-dark')
            },
            {
              label: 'Light',
              click: () => sendToFocusedWindow('menu-theme-light')
            },
            {
              label: 'High Contrast Dark',
              click: () => sendToFocusedWindow('menu-theme-hc-black')
            },
            {
              label: 'High Contrast Light',
              click: () => sendToFocusedWindow('menu-theme-hc-light')
            }
          ]
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Selection',
      submenu: [
        {
          label: 'Select All Occurrences',
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => sendToFocusedWindow('menu-select-all-occurrences')
        },
        {
          label: 'Add Cursor Above',
          accelerator: 'CmdOrCtrl+Alt+Up',
          click: () => sendToFocusedWindow('menu-add-cursor-above')
        },
        {
          label: 'Add Cursor Below',
          accelerator: 'CmdOrCtrl+Alt+Down',
          click: () => sendToFocusedWindow('menu-add-cursor-below')
        },
        { type: 'separator' },
        {
          label: 'Expand Selection',
          accelerator: 'Shift+Alt+Right',
          click: () => sendToFocusedWindow('menu-expand-selection')
        },
        {
          label: 'Shrink Selection',
          accelerator: 'Shift+Alt+Left',
          click: () => sendToFocusedWindow('menu-shrink-selection')
        }
      ]
    },
    {
      label: 'Git',
      submenu: [
        {
          label: 'Refresh Status',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => sendToFocusedWindow('menu-git-refresh')
        },
        { type: 'separator' },
        {
          label: 'Stage Current File',
          click: () => sendToFocusedWindow('menu-git-stage-file')
        },
        {
          label: 'Unstage Current File',
          click: () => sendToFocusedWindow('menu-git-unstage-file')
        },
        { type: 'separator' },
        {
          label: 'Commit...',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => sendToFocusedWindow('menu-git-commit')
        },
        { type: 'separator' },
        {
          label: 'Push',
          click: () => sendToFocusedWindow('menu-git-push')
        },
        {
          label: 'Pull',
          click: () => sendToFocusedWindow('menu-git-pull')
        }
      ]
    }
  ]));

  // Track window
  windows.add(mainWindow);

  // Remove from tracking when closed
  mainWindow.on('closed', () => {
    windows.delete(mainWindow);
    mainWindow = null;
  });
}

// Create new window (for Cmd+Shift+N)
function createNewWindow() {
  const newWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#1e1e1e',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      enableWebSQL: false,
      spellcheck: false
    }
  });

  newWindow.once('ready-to-show', () => {
    newWindow.show();
  });

  // Load as new window (empty slate) with query parameter
  newWindow.loadFile('renderer/index.html', {
    query: { newWindow: 'true' }
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    newWindow.webContents.openDevTools();
  }

  // Track window
  windows.add(newWindow);

  // Remove from tracking when closed
  newWindow.on('closed', () => {
    windows.delete(newWindow);
  });

  return newWindow;
}

// Performance: Wait for app to be ready
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Clean up terminals
  terminals.forEach(term => term.kill());
  terminals.clear();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// File Operations
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');
    return { filePath, content };
  }
  return null;
});

ipcMain.handle('save-file', async (event, filePath, content) => {
  await fs.writeFile(filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('save-file-dialog', async (event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    await fs.writeFile(result.filePath, content, 'utf-8');
    return result.filePath;
  }
  return null;
});

// Folder/Workspace Operations
ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    currentWorkspace = result.filePaths[0];
    await saveWorkspaceState({ workspace: currentWorkspace });
    return currentWorkspace;
  }
  return null;
});

ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile()
    })).sort((a, b) => {
      // Directories first, then files
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { filePath, content };
  } catch (error) {
    console.error('Error reading file:', error);
    return null;
  }
});

// Find files matching pattern (for .d.ts files)
ipcMain.handle('find-files', async (event, rootPath, pattern) => {
  try {
    const results = [];

    // Simple pattern matching for .d.ts files
    async function searchDirectory(dirPath) {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          // Skip node_modules and hidden directories
          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
              await searchDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            // Match pattern (simple glob: **/*.d.ts)
            if (pattern.includes('**/*.d.ts') && entry.name.endsWith('.d.ts')) {
              results.push(fullPath);
            } else if (pattern.includes('*.d.ts') && entry.name.endsWith('.d.ts')) {
              results.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't access
        console.error(`Error reading directory ${dirPath}:`, error.message);
      }
    }

    await searchDirectory(rootPath);
    return results;

  } catch (error) {
    console.error('Error finding files:', error);
    return [];
  }
});

ipcMain.handle('get-workspace', async () => {
  return currentWorkspace;
});

// Workspace State Management
async function saveWorkspaceState(state) {
  try {
    let existingState = {};
    if (fsSync.existsSync(STATE_FILE)) {
      const data = await fs.readFile(STATE_FILE, 'utf-8');
      // Only parse if data is not empty
      if (data && data.trim()) {
        try {
          existingState = JSON.parse(data);
        } catch (parseError) {
          console.error('Error parsing workspace state, starting fresh:', parseError);
          existingState = {};
        }
      }
    }

    // Update recent workspaces list
    if (state.workspace) {
      const recentWorkspaces = existingState.recentWorkspaces || [];

      // Remove if already exists (to move it to the top)
      const filtered = recentWorkspaces.filter(w => w.path !== state.workspace);

      // Add to the beginning
      filtered.unshift({
        path: state.workspace,
        name: state.workspace.split('/').pop(),
        lastOpened: new Date().toISOString()
      });

      // Keep only last 10 workspaces
      existingState.recentWorkspaces = filtered.slice(0, 10);
    }

    const newState = { ...existingState, ...state };
    await fs.writeFile(STATE_FILE, JSON.stringify(newState, null, 2));
  } catch (error) {
    console.error('Error saving workspace state:', error);
  }
}

async function loadWorkspaceState() {
  try {
    if (fsSync.existsSync(STATE_FILE)) {
      const data = await fs.readFile(STATE_FILE, 'utf-8');
      // Only parse if data is not empty
      if (data && data.trim()) {
        try {
          const state = JSON.parse(data);
          currentWorkspace = state.workspace || null;
          return state;
        } catch (parseError) {
          console.error('Error parsing workspace state, starting fresh:', parseError);
          return {};
        }
      }
    }
  } catch (error) {
    console.error('Error loading workspace state:', error);
  }
  return {};
}

ipcMain.handle('load-workspace-state', async () => {
  return await loadWorkspaceState();
});

ipcMain.handle('save-workspace-state', async (event, state) => {
  await saveWorkspaceState(state);
});

ipcMain.handle('get-recent-workspaces', async () => {
  try {
    if (fsSync.existsSync(STATE_FILE)) {
      const data = await fs.readFile(STATE_FILE, 'utf-8');
      // Only parse if data is not empty
      if (data && data.trim()) {
        try {
          const state = JSON.parse(data);
          return state.recentWorkspaces || [];
        } catch (parseError) {
          console.error('Error parsing recent workspaces, starting fresh:', parseError);
          return [];
        }
      }
    }
  } catch (error) {
    console.error('Error loading recent workspaces:', error);
  }
  return [];
});

// File Management Operations
ipcMain.handle('create-file', async (event, filePath, content = '') => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Error creating file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-folder', async (event, folderPath) => {
  try {
    await fs.mkdir(folderPath, { recursive: false });
    return { success: true };
  } catch (error) {
    console.error('Error creating folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-path', async (event, targetPath) => {
  try {
    const stats = await fs.stat(targetPath);
    if (stats.isDirectory()) {
      await fs.rmdir(targetPath, { recursive: true });
    } else {
      await fs.unlink(targetPath);
    }
    return { success: true };
  } catch (error) {
    console.error('Error deleting path:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('rename-path', async (event, oldPath, newPath) => {
  try {
    await fs.rename(oldPath, newPath);
    return { success: true };
  } catch (error) {
    console.error('Error renaming path:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('path-exists', async (event, targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
});

// Terminal Operations
ipcMain.handle('create-terminal', async (event) => {
  try {
    const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
    const cwd = currentWorkspace || process.env.HOME || process.env.USERPROFILE;

    console.log('Creating terminal with shell:', shell, 'in directory:', cwd);

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: cwd,
      env: process.env,
      // Performance: Limit scrollback to prevent memory issues (Phase 3)
      scrollback: 1000 // Reduced from default to 1000 lines
    });

    const terminalId = Date.now().toString();
    terminals.set(terminalId, ptyProcess);

    console.log('Terminal created with ID:', terminalId);

    ptyProcess.onData((data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal-data', terminalId, data);
      }
    });

    ptyProcess.onExit(() => {
      console.log('Terminal exited:', terminalId);
      terminals.delete(terminalId);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal-exit', terminalId);
      }
    });

    return terminalId;
  } catch (error) {
    console.error('Error creating terminal:', error);
    return null;
  }
});

ipcMain.handle('terminal-write', (event, terminalId, data) => {
  const terminal = terminals.get(terminalId);
  if (terminal) {
    console.log('Writing to terminal:', terminalId, 'data length:', data.length);
    terminal.write(data);
  } else {
    console.error('Terminal not found:', terminalId);
  }
});

ipcMain.handle('terminal-resize', (event, terminalId, cols, rows) => {
  const terminal = terminals.get(terminalId);
  if (terminal) {
    terminal.resize(cols, rows);
  }
});

ipcMain.handle('terminal-kill', (event, terminalId) => {
  const terminal = terminals.get(terminalId);
  if (terminal) {
    terminal.kill();
    terminals.delete(terminalId);
  }
});

// Git Operations
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

ipcMain.handle('is-git-repository', async (event, workspacePath) => {
  try {
    await execPromise('git rev-parse --git-dir', { cwd: workspacePath });
    return true;
  } catch (error) {
    return false;
  }
});

ipcMain.handle('get-git-status', async (event, workspacePath) => {
  try {
    const { stdout } = await execPromise('git status --porcelain', { cwd: workspacePath });

    const status = {
      modified: [],
      added: [],
      deleted: [],
      untracked: [],
      renamed: []
    };

    // Parse git status output - don't trim individual lines to preserve formatting
    const lines = stdout.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const statusCode = line.substring(0, 2);
      const filePath = line.substring(3).trim();

      if (statusCode === ' M' || statusCode === 'M ' || statusCode === 'MM') {
        status.modified.push(filePath);
      } else if (statusCode === 'A ' || statusCode === 'AM') {
        status.added.push(filePath);
      } else if (statusCode === ' D' || statusCode === 'D ') {
        status.deleted.push(filePath);
      } else if (statusCode === '??') {
        status.untracked.push(filePath);
      } else if (statusCode.startsWith('R')) {
        // Renamed files format: "R  old -> new"
        const parts = filePath.split(' -> ');
        status.renamed.push({ from: parts[0], to: parts[1] || filePath });
      }
    }

    return status;
  } catch (error) {
    console.error('Error getting git status:', error);
    return { modified: [], added: [], deleted: [], untracked: [], renamed: [] };
  }
});

ipcMain.handle('get-git-diff', async (event, workspacePath, filePath) => {
  try {
    // Get the relative path
    const relativePath = filePath.startsWith(workspacePath)
      ? filePath.substring(workspacePath.length + 1)
      : filePath;

    // Get diff with line numbers
    const { stdout } = await execPromise(`git diff HEAD "${relativePath}"`, {
      cwd: workspacePath,
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large diffs
    });

    if (!stdout) {
      return { changes: [] };
    }

    // Parse diff output
    const changes = [];
    const lines = stdout.split('\n');

    let currentLine = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Parse hunk headers like: @@ -10,5 +10,6 @@
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -\d+,?\d* \+(\d+),?(\d*) @@/);
        if (match) {
          currentLine = parseInt(match[1]);
        }
        continue;
      }

      // Skip diff headers
      if (line.startsWith('diff --git') || line.startsWith('index') ||
          line.startsWith('---') || line.startsWith('+++')) {
        continue;
      }

      // Process change lines
      if (line.startsWith('+') && !line.startsWith('+++')) {
        changes.push({ type: 'added', lineNumber: currentLine, count: 1 });
        currentLine++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        changes.push({ type: 'deleted', lineNumber: currentLine, count: 1 });
        // Deleted lines don't increment line number
      } else if (line.startsWith(' ')) {
        // Modified context - check if surrounded by changes
        const hasChangesAround = i > 0 && i < lines.length - 1 &&
          (lines[i - 1].startsWith('+') || lines[i - 1].startsWith('-') ||
           lines[i + 1].startsWith('+') || lines[i + 1].startsWith('-'));

        if (hasChangesAround) {
          changes.push({ type: 'modified', lineNumber: currentLine, count: 1 });
        }
        currentLine++;
      }
    }

    return { changes };
  } catch (error) {
    console.error('Error getting git diff:', error);
    return { changes: [] };
  }
});

ipcMain.handle('git-add', async (event, workspacePath, filePath) => {
  try {
    // If it's already a relative path, use it as is
    // Otherwise, extract the relative path
    let relativePath = filePath;
    if (filePath.startsWith(workspacePath)) {
      // Remove workspace path and leading slash
      relativePath = filePath.substring(workspacePath.length).replace(/^\/+/, '');
    }

    await execPromise(`git add "${relativePath}"`, { cwd: workspacePath });
    return { success: true };
  } catch (error) {
    console.error('Error staging file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-reset', async (event, workspacePath, filePath) => {
  try {
    // If it's already a relative path, use it as is
    // Otherwise, extract the relative path
    let relativePath = filePath;
    if (filePath.startsWith(workspacePath)) {
      // Remove workspace path and leading slash
      relativePath = filePath.substring(workspacePath.length).replace(/^\/+/, '');
    }

    console.log(`git reset HEAD "${relativePath}" in ${workspacePath}`);
    await execPromise(`git reset HEAD "${relativePath}"`, { cwd: workspacePath });
    return { success: true };
  } catch (error) {
    console.error('Error unstaging file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-commit', async (event, workspacePath, message) => {
  try {
    // Escape quotes in commit message
    const escapedMessage = message.replace(/"/g, '\\"');
    await execPromise(`git commit -m "${escapedMessage}"`, { cwd: workspacePath });
    return { success: true };
  } catch (error) {
    console.error('Error committing:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-push', async (event, workspacePath) => {
  try {
    // First try normal push
    try {
      await execPromise('git push', {
        cwd: workspacePath,
        timeout: 30000
      });
      return { success: true };
    } catch (pushError) {
      // If push fails because no upstream is set, try setting it
      if (pushError.message.includes('no upstream') ||
          pushError.message.includes('has no upstream branch')) {

        // Get current branch
        const { stdout: branch } = await execPromise('git branch --show-current', {
          cwd: workspacePath
        });

        const branchName = branch.trim();

        // Push with upstream set
        await execPromise(`git push -u origin ${branchName}`, {
          cwd: workspacePath,
          timeout: 30000
        });

        return { success: true, message: 'Pushed and set upstream' };
      }

      // If it's a different error, throw it
      throw pushError;
    }
  } catch (error) {
    console.error('Error pushing:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-pull', async (event, workspacePath) => {
  try {
    await execPromise('git pull', {
      cwd: workspacePath,
      timeout: 30000 // 30 second timeout
    });
    return { success: true };
  } catch (error) {
    console.error('Error pulling:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-current-branch', async (event, workspacePath) => {
  try {
    const { stdout } = await execPromise('git branch --show-current', {
      cwd: workspacePath
    });
    return stdout.trim();
  } catch (error) {
    console.error('Error getting current branch:', error);
    return 'main'; // fallback
  }
});

ipcMain.handle('get-all-branches', async (event, workspacePath) => {
  try {
    const { stdout } = await execPromise('git branch --all', {
      cwd: workspacePath
    });

    const branches = stdout
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('remotes/origin/HEAD'))
      .map(line => {
        const isCurrentBranch = line.startsWith('*');
        const branchName = line.replace(/^\*?\s+/, '').replace(/^remotes\/origin\//, '');
        const isRemote = line.includes('remotes/origin/');
        return {
          name: branchName,
          current: isCurrentBranch,
          remote: isRemote
        };
      });

    // Remove duplicates (local + remote with same name)
    const uniqueBranches = [];
    const seen = new Set();

    for (const branch of branches) {
      if (!seen.has(branch.name)) {
        seen.add(branch.name);
        uniqueBranches.push(branch);
      }
    }

    return uniqueBranches;
  } catch (error) {
    console.error('Error getting branches:', error);
    return [];
  }
});

ipcMain.handle('switch-branch', async (event, workspacePath, branchName) => {
  try {
    await execPromise(`git checkout ${branchName}`, {
      cwd: workspacePath
    });
    return { success: true };
  } catch (error) {
    console.error('Error switching branch:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-branch', async (event, workspacePath, branchName, switchToIt) => {
  try {
    const command = switchToIt
      ? `git checkout -b ${branchName}`
      : `git branch ${branchName}`;

    await execPromise(command, {
      cwd: workspacePath
    });
    return { success: true };
  } catch (error) {
    console.error('Error creating branch:', error);
    return { success: false, error: error.message };
  }
});

// LSP Operations
const { spawn } = require('child_process');
const lspServers = new Map(); // serverId -> { process, language, messageBuffer }
let lspServerIdCounter = 0;

// Check if an LSP server command is available
ipcMain.handle('check-lsp-server', async (event, command) => {
  try {
    // Check if command exists
    const checkCmd = process.platform === 'win32' ? 'where' : 'which';
    await execPromise(`${checkCmd} ${command}`);
    return true;
  } catch (error) {
    return false;
  }
});

// Start an LSP server
ipcMain.handle('start-lsp-server', async (event, language, command, args, workspacePath) => {
  try {
    const serverId = `lsp-${language}-${++lspServerIdCounter}`;

    console.log(`Starting LSP server ${serverId}: ${command} ${args.join(' ')}`);

    const lspProcess = spawn(command, args, {
      cwd: workspacePath,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (!lspProcess || !lspProcess.pid) {
      console.error(`Failed to start LSP server ${serverId}`);
      return null;
    }

    const serverData = {
      process: lspProcess,
      language,
      messageBuffer: '',
      pendingRequests: new Map(), // requestId -> { resolve, reject }
      requestIdCounter: 0
    };

    lspServers.set(serverId, serverData);

    // Handle stdout (LSP responses)
    lspProcess.stdout.on('data', (data) => {
      serverData.messageBuffer += data.toString();

      // Process complete messages
      let contentLengthMatch;
      while ((contentLengthMatch = serverData.messageBuffer.match(/Content-Length: (\d+)\r\n\r\n/))) {
        const contentLength = parseInt(contentLengthMatch[1]);
        const messageStart = serverData.messageBuffer.indexOf('\r\n\r\n') + 4;

        if (serverData.messageBuffer.length >= messageStart + contentLength) {
          const messageContent = serverData.messageBuffer.substring(messageStart, messageStart + contentLength);
          serverData.messageBuffer = serverData.messageBuffer.substring(messageStart + contentLength);

          try {
            const message = JSON.parse(messageContent);
            handleLSPMessage(serverId, message);
          } catch (error) {
            console.error('Error parsing LSP message:', error);
          }
        } else {
          break;
        }
      }
    });

    // Handle stderr
    lspProcess.stderr.on('data', (data) => {
      console.error(`LSP ${serverId} stderr:`, data.toString());
    });

    // Handle process exit
    lspProcess.on('exit', (code) => {
      console.log(`LSP server ${serverId} exited with code ${code}`);
      lspServers.delete(serverId);
    });

    console.log(`✅ LSP server ${serverId} started`);
    return serverId;
  } catch (error) {
    console.error('Error starting LSP server:', error);
    return null;
  }
});

// Handle LSP message (response or notification)
function handleLSPMessage(serverId, message) {
  const serverData = lspServers.get(serverId);
  if (!serverData) return;

  // Handle response to a request
  if (message.id !== undefined) {
    const pending = serverData.pendingRequests.get(message.id);
    if (pending) {
      serverData.pendingRequests.delete(message.id);

      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
    }
  }

  // Handle server notifications (diagnostics, etc.)
  if (message.method) {
    if (message.method === 'textDocument/publishDiagnostics') {
      // Send diagnostics to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('lsp-diagnostics', serverId, message.params);
      }
    }
  }
}

// Send LSP request
ipcMain.handle('send-lsp-request', async (event, serverId, method, params) => {
  const serverData = lspServers.get(serverId);
  if (!serverData) {
    throw new Error(`LSP server ${serverId} not found`);
  }

  const requestId = ++serverData.requestIdCounter;

  const request = {
    jsonrpc: '2.0',
    id: requestId,
    method,
    params
  };

  const requestContent = JSON.stringify(request);
  const requestMessage = `Content-Length: ${Buffer.byteLength(requestContent)}\r\n\r\n${requestContent}`;

  return new Promise((resolve, reject) => {
    serverData.pendingRequests.set(requestId, { resolve, reject });

    serverData.process.stdin.write(requestMessage, (error) => {
      if (error) {
        serverData.pendingRequests.delete(requestId);
        reject(error);
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (serverData.pendingRequests.has(requestId)) {
        serverData.pendingRequests.delete(requestId);
        reject(new Error('LSP request timeout'));
      }
    }, 30000);
  });
});

// Send LSP notification (no response expected)
ipcMain.handle('send-lsp-notification', async (event, serverId, method, params) => {
  const serverData = lspServers.get(serverId);
  if (!serverData) {
    throw new Error(`LSP server ${serverId} not found`);
  }

  const notification = {
    jsonrpc: '2.0',
    method,
    params
  };

  const notificationContent = JSON.stringify(notification);
  const notificationMessage = `Content-Length: ${Buffer.byteLength(notificationContent)}\r\n\r\n${notificationContent}`;

  serverData.process.stdin.write(notificationMessage);
});

// Stop LSP server
ipcMain.handle('stop-lsp-server', async (event, serverId) => {
  const serverData = lspServers.get(serverId);
  if (serverData) {
    serverData.process.kill();
    lspServers.delete(serverId);
  }
});
