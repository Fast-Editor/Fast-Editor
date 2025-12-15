/**
 * Language Server Protocol (LSP) Integration Example
 * This file demonstrates how LSP integration would work in Fast Editor
 *
 * NOTE: This is a proof-of-concept. Full implementation coming in v1.1
 */

// ============================================
// MAIN PROCESS (main.js)
// ============================================

const { spawn } = require('child_process');
const path = require('path');

class LanguageServerManager {
  constructor() {
    this.servers = new Map();
  }

  /**
   * Start a language server for a specific language
   */
  startServer(language, command, args = []) {
    if (this.servers.has(language)) {
      return this.servers.get(language);
    }

    console.log(`Starting ${language} language server: ${command}`);

    const server = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    // Handle server output
    server.stdout.on('data', (data) => {
      const messages = this.parseMessages(data.toString());
      messages.forEach(msg => {
        // Forward to renderer process
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('lsp-response', {
            language,
            message: msg
          });
        }
      });
    });

    server.stderr.on('data', (data) => {
      console.error(`${language} LSP error:`, data.toString());
    });

    server.on('close', (code) => {
      console.log(`${language} language server exited with code ${code}`);
      this.servers.delete(language);
    });

    this.servers.set(language, server);
    return server;
  }

  /**
   * Send message to language server
   */
  sendMessage(language, message) {
    const server = this.servers.get(language);
    if (!server) {
      console.error(`No language server running for ${language}`);
      return;
    }

    const json = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n`;
    server.stdin.write(header + json);
  }

  /**
   * Parse LSP messages (they have Content-Length header)
   */
  parseMessages(data) {
    const messages = [];
    const lines = data.split('\r\n\r\n');

    for (let i = 0; i < lines.length - 1; i += 2) {
      const header = lines[i];
      const content = lines[i + 1];

      if (header && content) {
        try {
          messages.push(JSON.parse(content));
        } catch (e) {
          console.error('Failed to parse LSP message:', e);
        }
      }
    }

    return messages;
  }

  /**
   * Stop all language servers
   */
  stopAll() {
    this.servers.forEach((server, language) => {
      console.log(`Stopping ${language} language server`);
      server.kill();
    });
    this.servers.clear();
  }
}

// Create manager instance
const lspManager = new LanguageServerManager();

// IPC handlers
ipcMain.handle('lsp-start-server', async (event, { language, command, args }) => {
  try {
    lspManager.startServer(language, command, args);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('lsp-send-message', async (event, { language, message }) => {
  try {
    lspManager.sendMessage(language, message);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Cleanup on quit
app.on('before-quit', () => {
  lspManager.stopAll();
});

// ============================================
// RENDERER PROCESS (lsp-client.js)
// ============================================

class LSPClient {
  constructor(language, serverCommand, serverArgs = []) {
    this.language = language;
    this.serverCommand = serverCommand;
    this.serverArgs = serverArgs;
    this.requestId = 0;
    this.pendingRequests = new Map();

    this.initialize();
  }

  /**
   * Initialize language server
   */
  async initialize() {
    // Start server
    await window.api.lspStartServer({
      language: this.language,
      command: this.serverCommand,
      args: this.serverArgs
    });

    // Listen for responses
    window.api.onLSPResponse((response) => {
      if (response.language !== this.language) return;

      this.handleResponse(response.message);
    });

    // Send initialize request
    const workspaceFolder = await window.api.getWorkspace();

    await this.sendRequest('initialize', {
      processId: null,
      clientInfo: {
        name: 'Fast Editor',
        version: '1.0.0'
      },
      rootUri: workspaceFolder ? `file://${workspaceFolder}` : null,
      capabilities: {
        textDocument: {
          completion: {
            completionItem: {
              snippetSupport: true,
              documentationFormat: ['markdown', 'plaintext']
            }
          },
          hover: {
            contentFormat: ['markdown', 'plaintext']
          },
          signatureHelp: {
            signatureInformation: {
              documentationFormat: ['markdown', 'plaintext']
            }
          }
        }
      }
    });

    // Send initialized notification
    this.sendNotification('initialized', {});
  }

  /**
   * Send request to language server
   */
  async sendRequest(method, params) {
    const id = ++this.requestId;

    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    await window.api.lspSendMessage({
      language: this.language,
      message
    });

    // Return promise that resolves when response arrives
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
    });
  }

  /**
   * Send notification (no response expected)
   */
  async sendNotification(method, params) {
    const message = {
      jsonrpc: '2.0',
      method,
      params
    };

    await window.api.lspSendMessage({
      language: this.language,
      message
    });
  }

  /**
   * Handle response from language server
   */
  handleResponse(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(message.error);
      } else {
        resolve(message.result);
      }
    }
  }

  /**
   * Notify server that document opened
   */
  async didOpenTextDocument(uri, languageId, version, text) {
    await this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId,
        version,
        text
      }
    });
  }

  /**
   * Notify server that document changed
   */
  async didChangeTextDocument(uri, version, changes) {
    await this.sendNotification('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: changes
    });
  }

  /**
   * Request completion
   */
  async completion(uri, position) {
    return await this.sendRequest('textDocument/completion', {
      textDocument: { uri },
      position: {
        line: position.lineNumber - 1,
        character: position.column - 1
      }
    });
  }

  /**
   * Request hover information
   */
  async hover(uri, position) {
    return await this.sendRequest('textDocument/hover', {
      textDocument: { uri },
      position: {
        line: position.lineNumber - 1,
        character: position.column - 1
      }
    });
  }

  /**
   * Request go to definition
   */
  async definition(uri, position) {
    return await this.sendRequest('textDocument/definition', {
      textDocument: { uri },
      position: {
        line: position.lineNumber - 1,
        character: position.column - 1
      }
    });
  }
}

// ============================================
// MONACO INTEGRATION
// ============================================

/**
 * Register LSP completion provider with Monaco
 */
function registerLSPCompletionProvider(languageId, lspClient) {
  monaco.languages.registerCompletionItemProvider(languageId, {
    triggerCharacters: ['.', ':', '<'],

    provideCompletionItems: async (model, position) => {
      const uri = model.uri.toString();

      try {
        const result = await lspClient.completion(uri, position);

        if (!result || !result.items) {
          return { suggestions: [] };
        }

        const suggestions = result.items.map(item => ({
          label: item.label,
          kind: mapCompletionItemKind(item.kind),
          detail: item.detail,
          documentation: item.documentation,
          insertText: item.insertText || item.label,
          insertTextRules: item.insertTextFormat === 2
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : undefined,
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          }
        }));

        return { suggestions };
      } catch (error) {
        console.error('LSP completion error:', error);
        return { suggestions: [] };
      }
    }
  });
}

/**
 * Register LSP hover provider with Monaco
 */
function registerLSPHoverProvider(languageId, lspClient) {
  monaco.languages.registerHoverProvider(languageId, {
    provideHover: async (model, position) => {
      const uri = model.uri.toString();

      try {
        const result = await lspClient.hover(uri, position);

        if (!result || !result.contents) {
          return null;
        }

        const contents = Array.isArray(result.contents)
          ? result.contents
          : [result.contents];

        return {
          contents: contents.map(c => ({
            value: typeof c === 'string' ? c : c.value
          }))
        };
      } catch (error) {
        console.error('LSP hover error:', error);
        return null;
      }
    }
  });
}

/**
 * Map LSP completion item kinds to Monaco kinds
 */
function mapCompletionItemKind(kind) {
  const mapping = {
    1: monaco.languages.CompletionItemKind.Text,
    2: monaco.languages.CompletionItemKind.Method,
    3: monaco.languages.CompletionItemKind.Function,
    4: monaco.languages.CompletionItemKind.Constructor,
    5: monaco.languages.CompletionItemKind.Field,
    6: monaco.languages.CompletionItemKind.Variable,
    7: monaco.languages.CompletionItemKind.Class,
    8: monaco.languages.CompletionItemKind.Interface,
    9: monaco.languages.CompletionItemKind.Module,
    10: monaco.languages.CompletionItemKind.Property,
    11: monaco.languages.CompletionItemKind.Unit,
    12: monaco.languages.CompletionItemKind.Value,
    13: monaco.languages.CompletionItemKind.Enum,
    14: monaco.languages.CompletionItemKind.Keyword,
    15: monaco.languages.CompletionItemKind.Snippet,
    // ... more mappings
  };

  return mapping[kind] || monaco.languages.CompletionItemKind.Text;
}

// ============================================
// USAGE EXAMPLE
// ============================================

/**
 * Initialize Rust LSP support
 */
async function initializeRustLSP() {
  // Create LSP client for Rust
  const rustClient = new LSPClient('rust', 'rust-analyzer');

  // Register with Monaco
  registerLSPCompletionProvider('rust', rustClient);
  registerLSPHoverProvider('rust', rustClient);

  // Notify when document opens
  editor.onDidChangeModel((e) => {
    const model = editor.getModel();
    if (model && model.getLanguageId() === 'rust') {
      const uri = model.uri.toString();
      const text = model.getValue();

      rustClient.didOpenTextDocument(uri, 'rust', 1, text);
    }
  });

  // Notify on changes
  editor.onDidChangeModelContent((e) => {
    const model = editor.getModel();
    if (model && model.getLanguageId() === 'rust') {
      const uri = model.uri.toString();
      const version = model.getVersionId();

      const changes = e.changes.map(change => ({
        text: change.text,
        range: {
          start: {
            line: change.range.startLineNumber - 1,
            character: change.range.startColumn - 1
          },
          end: {
            line: change.range.endLineNumber - 1,
            character: change.range.endColumn - 1
          }
        }
      }));

      rustClient.didChangeTextDocument(uri, version, changes);
    }
  });

  console.log('✅ Rust LSP initialized');
}

// ============================================
// PRELOAD.JS ADDITIONS
// ============================================

// Add to preload.js:
contextBridge.exposeInMainWorld('api', {
  // ... existing methods ...

  // LSP methods
  lspStartServer: (config) => ipcRenderer.invoke('lsp-start-server', config),
  lspSendMessage: (message) => ipcRenderer.invoke('lsp-send-message', message),
  onLSPResponse: (callback) => ipcRenderer.on('lsp-response', (event, response) => callback(response)),
});

// ============================================
// TESTING
// ============================================

/**
 * Test the implementation
 */
async function testRustLSP() {
  // Initialize Rust LSP
  await initializeRustLSP();

  // Create a Rust file
  const model = monaco.editor.createModel(`
pub struct User {
    pub name: String,
    pub age: u32,
}

impl User {
    pub fn new(name: String, age: u32) -> Self {
        Self { name, age }
    }
}

fn main() {
    let user = User::new("Alice".to_string(), 30);
    user. // <- IntelliSense should show: name, age
}
  `.trim(), 'rust', monaco.Uri.parse('file:///test.rs'));

  editor.setModel(model);

  console.log('✅ Test complete - try typing after "user."');
}

// Export for use
window.testRustLSP = testRustLSP;
window.initializeRustLSP = initializeRustLSP;
