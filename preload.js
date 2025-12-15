const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // File operations
  openFile: () => ipcRenderer.invoke('open-file-dialog'),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
  saveFileAs: (content) => ipcRenderer.invoke('save-file-dialog', content),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  findFiles: (rootPath, pattern) => ipcRenderer.invoke('find-files', rootPath, pattern),

  // Folder/Workspace operations
  openFolder: () => ipcRenderer.invoke('open-folder-dialog'),
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  getWorkspace: () => ipcRenderer.invoke('get-workspace'),
  loadWorkspaceState: () => ipcRenderer.invoke('load-workspace-state'),
  saveWorkspaceState: (state) => ipcRenderer.invoke('save-workspace-state', state),
  getRecentWorkspaces: () => ipcRenderer.invoke('get-recent-workspaces'),

  // File Management operations
  createFile: (filePath, content) => ipcRenderer.invoke('create-file', filePath, content),
  createFolder: (folderPath) => ipcRenderer.invoke('create-folder', folderPath),
  deletePath: (targetPath) => ipcRenderer.invoke('delete-path', targetPath),
  renamePath: (oldPath, newPath) => ipcRenderer.invoke('rename-path', oldPath, newPath),
  pathExists: (targetPath) => ipcRenderer.invoke('path-exists', targetPath),

  // Terminal operations
  createTerminal: () => ipcRenderer.invoke('create-terminal'),
  terminalWrite: (terminalId, data) => ipcRenderer.invoke('terminal-write', terminalId, data),
  terminalResize: (terminalId, cols, rows) => ipcRenderer.invoke('terminal-resize', terminalId, cols, rows),
  terminalKill: (terminalId) => ipcRenderer.invoke('terminal-kill', terminalId),

  // Event listeners
  onTerminalData: (callback) => ipcRenderer.on('terminal-data', (event, terminalId, data) => callback(terminalId, data)),
  onTerminalExit: (callback) => ipcRenderer.on('terminal-exit', (event, terminalId) => callback(terminalId)),
  onMenuOpenFile: (callback) => ipcRenderer.on('menu-open-file', callback),
  onMenuOpenFolder: (callback) => ipcRenderer.on('menu-open-folder', callback),
  onMenuSaveFile: (callback) => ipcRenderer.on('menu-save-file', callback),
  onMenuSaveFileAs: (callback) => ipcRenderer.on('menu-save-file-as', callback),
  onMenuSaveAll: (callback) => ipcRenderer.on('menu-save-all', callback),
  onMenuCloseTab: (callback) => ipcRenderer.on('menu-close-tab', callback),
  onMenuToggleSidebar: (callback) => ipcRenderer.on('menu-toggle-sidebar', callback),
  onMenuToggleTerminal: (callback) => ipcRenderer.on('menu-toggle-terminal', callback),
  onMenuGotoFile: (callback) => ipcRenderer.on('menu-goto-file', callback),
  onMenuFind: (callback) => ipcRenderer.on('menu-find', callback),
  onMenuReplace: (callback) => ipcRenderer.on('menu-replace', callback),
  onMenuFindInFiles: (callback) => ipcRenderer.on('menu-find-in-files', callback),

  // Format menu listeners
  onMenuFormatDocument: (callback) => ipcRenderer.on('menu-format-document', callback),
  onMenuFormatSelection: (callback) => ipcRenderer.on('menu-format-selection', callback),

  // Comment menu listeners
  onMenuCommentLine: (callback) => ipcRenderer.on('menu-comment-line', callback),
  onMenuBlockComment: (callback) => ipcRenderer.on('menu-block-comment', callback),

  // Line manipulation listeners
  onMenuMoveLineUp: (callback) => ipcRenderer.on('menu-move-line-up', callback),
  onMenuMoveLineDown: (callback) => ipcRenderer.on('menu-move-line-down', callback),
  onMenuCopyLineUp: (callback) => ipcRenderer.on('menu-copy-line-up', callback),
  onMenuCopyLineDown: (callback) => ipcRenderer.on('menu-copy-line-down', callback),
  onMenuDeleteLine: (callback) => ipcRenderer.on('menu-delete-line', callback),

  // Transform listeners
  onMenuTransformUppercase: (callback) => ipcRenderer.on('menu-transform-uppercase', callback),
  onMenuTransformLowercase: (callback) => ipcRenderer.on('menu-transform-lowercase', callback),

  // Whitespace listener
  onMenuTrimWhitespace: (callback) => ipcRenderer.on('menu-trim-whitespace', callback),

  // Navigation listeners
  onMenuGotoSymbol: (callback) => ipcRenderer.on('menu-goto-symbol', callback),
  onMenuGotoSymbolWorkspace: (callback) => ipcRenderer.on('menu-goto-symbol-workspace', callback),
  onMenuGotoDefinition: (callback) => ipcRenderer.on('menu-goto-definition', callback),
  onMenuPeekDefinition: (callback) => ipcRenderer.on('menu-peek-definition', callback),
  onMenuGotoTypeDefinition: (callback) => ipcRenderer.on('menu-goto-type-definition', callback),
  onMenuGotoImplementation: (callback) => ipcRenderer.on('menu-goto-implementation', callback),
  onMenuFindReferences: (callback) => ipcRenderer.on('menu-find-references', callback),

  // Error navigation listeners
  onMenuNextError: (callback) => ipcRenderer.on('menu-next-error', callback),
  onMenuPrevError: (callback) => ipcRenderer.on('menu-prev-error', callback),

  // View toggle listeners
  onMenuToggleWordWrap: (callback) => ipcRenderer.on('menu-toggle-word-wrap', callback),
  onMenuToggleMinimap: (callback) => ipcRenderer.on('menu-toggle-minimap', callback),
  onMenuToggleBreadcrumbs: (callback) => ipcRenderer.on('menu-toggle-breadcrumbs', callback),
  onMenuOpenDiffEditor: (callback) => ipcRenderer.on('menu-open-diff-editor', callback),

  // Theme listeners
  onMenuThemeDark: (callback) => ipcRenderer.on('menu-theme-dark', callback),
  onMenuThemeLight: (callback) => ipcRenderer.on('menu-theme-light', callback),
  onMenuThemeHcBlack: (callback) => ipcRenderer.on('menu-theme-hc-black', callback),
  onMenuThemeHcLight: (callback) => ipcRenderer.on('menu-theme-hc-light', callback),

  // Selection listeners
  onMenuSelectAllOccurrences: (callback) => ipcRenderer.on('menu-select-all-occurrences', callback),
  onMenuAddCursorAbove: (callback) => ipcRenderer.on('menu-add-cursor-above', callback),
  onMenuAddCursorBelow: (callback) => ipcRenderer.on('menu-add-cursor-below', callback),
  onMenuExpandSelection: (callback) => ipcRenderer.on('menu-expand-selection', callback),
  onMenuShrinkSelection: (callback) => ipcRenderer.on('menu-shrink-selection', callback),

  // Git operations
  isGitRepository: (workspacePath) => ipcRenderer.invoke('is-git-repository', workspacePath),
  getGitStatus: (workspacePath) => ipcRenderer.invoke('get-git-status', workspacePath),
  getGitDiff: (workspacePath, filePath) => ipcRenderer.invoke('get-git-diff', workspacePath, filePath),
  gitAdd: (workspacePath, filePath) => ipcRenderer.invoke('git-add', workspacePath, filePath),
  gitReset: (workspacePath, filePath) => ipcRenderer.invoke('git-reset', workspacePath, filePath),
  gitCommit: (workspacePath, message) => ipcRenderer.invoke('git-commit', workspacePath, message),
  gitPush: (workspacePath) => ipcRenderer.invoke('git-push', workspacePath),
  gitPull: (workspacePath) => ipcRenderer.invoke('git-pull', workspacePath),
  getCurrentBranch: (workspacePath) => ipcRenderer.invoke('get-current-branch', workspacePath),
  getAllBranches: (workspacePath) => ipcRenderer.invoke('get-all-branches', workspacePath),
  switchBranch: (workspacePath, branchName) => ipcRenderer.invoke('switch-branch', workspacePath, branchName),
  createBranch: (workspacePath, branchName, switchToIt) => ipcRenderer.invoke('create-branch', workspacePath, branchName, switchToIt),

  // Git menu listeners
  onMenuGitRefresh: (callback) => ipcRenderer.on('menu-git-refresh', callback),
  onMenuGitStageFile: (callback) => ipcRenderer.on('menu-git-stage-file', callback),
  onMenuGitUnstageFile: (callback) => ipcRenderer.on('menu-git-unstage-file', callback),
  onMenuGitCommit: (callback) => ipcRenderer.on('menu-git-commit', callback),
  onMenuGitPush: (callback) => ipcRenderer.on('menu-git-push', callback),
  onMenuGitPull: (callback) => ipcRenderer.on('menu-git-pull', callback),

  // LSP operations
  checkLSPServer: (command) => ipcRenderer.invoke('check-lsp-server', command),
  startLSPServer: (language, command, args, workspacePath) =>
    ipcRenderer.invoke('start-lsp-server', language, command, args, workspacePath),
  sendLSPRequest: (serverId, method, params) =>
    ipcRenderer.invoke('send-lsp-request', serverId, method, params),
  sendLSPNotification: (serverId, method, params) =>
    ipcRenderer.invoke('send-lsp-notification', serverId, method, params),
  stopLSPServer: (serverId) => ipcRenderer.invoke('stop-lsp-server', serverId),
  onLSPDiagnostics: (callback) => ipcRenderer.on('lsp-diagnostics', (event, serverId, params) => callback(serverId, params)),

  // Remove listeners
  removeTerminalDataListener: () => ipcRenderer.removeAllListeners('terminal-data'),
  removeTerminalExitListener: () => ipcRenderer.removeAllListeners('terminal-exit')
});
