/**
 * LSP (Language Server Protocol) Integration
 * Provides language intelligence for Rust and Python
 */

let lspEnabled = false;
let languageServers = new Map(); // language -> server connection
let documentVersions = new Map(); // file path -> version number
let lspWorkspacePath = null;

// LSP server configurations
const LSP_CONFIGS = {
  rust: {
    name: 'rust-analyzer',
    command: 'rust-analyzer',
    fileExtensions: ['.rs'],
    languageId: 'rust',
    initializationOptions: {
      cargo: {
        loadOutDirsFromCheck: true
      },
      procMacro: {
        enable: true
      }
    }
  },
  python: {
    name: 'pyright',
    command: 'pyright-langserver',
    args: ['--stdio'],
    fileExtensions: ['.py'],
    languageId: 'python',
    initializationOptions: {}
  }
};

/**
 * Initialize LSP integration for workspace
 */
async function initLSP(workspacePath) {
  if (!workspacePath) {
    lspEnabled = false;
    return;
  }

  lspWorkspacePath = workspacePath;
  console.log('🔧 Initializing LSP for workspace:', workspacePath);

  // Check which language servers are available
  for (const [language, config] of Object.entries(LSP_CONFIGS)) {
    const isAvailable = await window.api.checkLSPServer(config.command);
    if (isAvailable) {
      await startLanguageServer(language, config);
    } else {
      console.warn(`⚠️ ${config.name} not found. Install it to get ${language} language support.`);
    }
  }

  lspEnabled = languageServers.size > 0;
  if (lspEnabled) {
    console.log('✅ LSP integration enabled with servers:', Array.from(languageServers.keys()));
  } else {
    console.log('ℹ️ No LSP servers available');
  }
}

/**
 * Start a language server
 */
async function startLanguageServer(language, config) {
  try {
    console.log(`Starting ${config.name}...`);

    const serverId = await window.api.startLSPServer(
      language,
      config.command,
      config.args || [],
      lspWorkspacePath
    );

    if (!serverId) {
      console.error(`Failed to start ${config.name}`);
      return;
    }

    // Initialize the server
    const initParams = {
      processId: null,
      clientInfo: {
        name: 'Fast Editor',
        version: '1.0.0'
      },
      rootUri: `file://${lspWorkspacePath}`,
      capabilities: {
        textDocument: {
          synchronization: {
            didOpen: true,
            didChange: true,
            didSave: true,
            didClose: true
          },
          completion: {
            completionItem: {
              snippetSupport: true,
              documentationFormat: ['markdown', 'plaintext']
            }
          },
          hover: {
            contentFormat: ['markdown', 'plaintext']
          },
          definition: {
            linkSupport: true
          },
          references: {},
          documentSymbol: {},
          codeAction: {},
          formatting: {}
        },
        workspace: {
          workspaceFolders: true,
          configuration: true
        }
      },
      initializationOptions: config.initializationOptions,
      workspaceFolders: [
        {
          uri: `file://${lspWorkspacePath}`,
          name: lspWorkspacePath.split('/').pop()
        }
      ]
    };

    const initResult = await window.api.sendLSPRequest(serverId, 'initialize', initParams);

    if (initResult) {
      // Send initialized notification
      await window.api.sendLSPNotification(serverId, 'initialized', {});

      languageServers.set(language, {
        id: serverId,
        config,
        capabilities: initResult.capabilities
      });

      console.log(`✅ ${config.name} started successfully`);
    }
  } catch (error) {
    console.error(`Error starting ${config.name}:`, error);
  }
}

/**
 * Get language server for file
 */
function getServerForFile(filePath) {
  if (!filePath) return null;

  for (const [language, server] of languageServers.entries()) {
    const config = server.config;
    if (config.fileExtensions.some(ext => filePath.endsWith(ext))) {
      return server;
    }
  }

  return null;
}

/**
 * Notify LSP that a document was opened
 */
async function didOpenDocument(filePath, languageId, content) {
  const server = getServerForFile(filePath);
  if (!server) return;

  const version = 1;
  documentVersions.set(filePath, version);

  await window.api.sendLSPNotification(server.id, 'textDocument/didOpen', {
    textDocument: {
      uri: `file://${filePath}`,
      languageId,
      version,
      text: content
    }
  });
}

/**
 * Notify LSP that a document changed
 */
async function didChangeDocument(filePath, content) {
  const server = getServerForFile(filePath);
  if (!server) return;

  let version = documentVersions.get(filePath) || 1;
  version++;
  documentVersions.set(filePath, version);

  await window.api.sendLSPNotification(server.id, 'textDocument/didChange', {
    textDocument: {
      uri: `file://${filePath}`,
      version
    },
    contentChanges: [
      {
        text: content
      }
    ]
  });
}

/**
 * Notify LSP that a document was saved
 */
async function didSaveDocument(filePath, content) {
  const server = getServerForFile(filePath);
  if (!server) return;

  await window.api.sendLSPNotification(server.id, 'textDocument/didSave', {
    textDocument: {
      uri: `file://${filePath}`
    },
    text: content
  });
}

/**
 * Notify LSP that a document was closed
 */
async function didCloseDocument(filePath) {
  const server = getServerForFile(filePath);
  if (!server) return;

  documentVersions.delete(filePath);

  await window.api.sendLSPNotification(server.id, 'textDocument/didClose', {
    textDocument: {
      uri: `file://${filePath}`
    }
  });
}

/**
 * Request completion at position
 */
async function getCompletions(filePath, position) {
  const server = getServerForFile(filePath);
  if (!server) return null;

  try {
    const result = await window.api.sendLSPRequest(server.id, 'textDocument/completion', {
      textDocument: {
        uri: `file://${filePath}`
      },
      position
    });

    return result;
  } catch (error) {
    console.error('Error getting completions:', error);
    return null;
  }
}

/**
 * Request hover information
 */
async function getHover(filePath, position) {
  const server = getServerForFile(filePath);
  if (!server) return null;

  try {
    const result = await window.api.sendLSPRequest(server.id, 'textDocument/hover', {
      textDocument: {
        uri: `file://${filePath}`
      },
      position
    });

    return result;
  } catch (error) {
    console.error('Error getting hover:', error);
    return null;
  }
}

/**
 * Request definition location
 */
async function getDefinition(filePath, position) {
  const server = getServerForFile(filePath);
  if (!server) return null;

  try {
    const result = await window.api.sendLSPRequest(server.id, 'textDocument/definition', {
      textDocument: {
        uri: `file://${filePath}`
      },
      position
    });

    return result;
  } catch (error) {
    console.error('Error getting definition:', error);
    return null;
  }
}

/**
 * Request references
 */
async function getReferences(filePath, position) {
  const server = getServerForFile(filePath);
  if (!server) return null;

  try {
    const result = await window.api.sendLSPRequest(server.id, 'textDocument/references', {
      textDocument: {
        uri: `file://${filePath}`
      },
      position,
      context: {
        includeDeclaration: true
      }
    });

    return result;
  } catch (error) {
    console.error('Error getting references:', error);
    return null;
  }
}

/**
 * Request document formatting
 */
async function formatDocument(filePath) {
  const server = getServerForFile(filePath);
  if (!server) return null;

  try {
    const result = await window.api.sendLSPRequest(server.id, 'textDocument/formatting', {
      textDocument: {
        uri: `file://${filePath}`
      },
      options: {
        tabSize: 4,
        insertSpaces: true
      }
    });

    return result;
  } catch (error) {
    console.error('Error formatting document:', error);
    return null;
  }
}

/**
 * Cleanup on workspace change
 */
async function cleanupLSP() {
  for (const [language, server] of languageServers.entries()) {
    try {
      await window.api.sendLSPRequest(server.id, 'shutdown', {});
      await window.api.sendLSPNotification(server.id, 'exit', {});
      await window.api.stopLSPServer(server.id);
    } catch (error) {
      console.error(`Error stopping ${language} server:`, error);
    }
  }

  languageServers.clear();
  documentVersions.clear();
  lspEnabled = false;
  lspWorkspacePath = null;
}

// Export functions
window.lsp = {
  init: initLSP,
  cleanup: cleanupLSP,
  isEnabled: () => lspEnabled,

  // Document lifecycle
  didOpen: didOpenDocument,
  didChange: didChangeDocument,
  didSave: didSaveDocument,
  didClose: didCloseDocument,

  // LSP features
  getCompletions,
  getHover,
  getDefinition,
  getReferences,
  formatDocument,

  // Utilities
  getServerForFile
};
