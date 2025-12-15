/**
 * LSP-Monaco Integration
 * Connects LSP features to Monaco Editor providers
 */

let lspMonacoInitialized = false;

/**
 * Initialize LSP-Monaco integration
 */
function initLSPMonaco() {
  if (lspMonacoInitialized || typeof monaco === 'undefined') {
    return;
  }

  console.log('🔧 Initializing LSP-Monaco integration...');

  // Register completion provider for Rust
  monaco.languages.registerCompletionItemProvider('rust', {
    triggerCharacters: ['.', ':', '<'],
    async provideCompletionItems(model, position) {
      const filePath = model.uri.path;

      if (!window.lsp || !window.lsp.isEnabled()) {
        return { suggestions: [] };
      }

      const completions = await window.lsp.getCompletions(filePath, {
        line: position.lineNumber - 1,
        character: position.column - 1
      });

      if (!completions) {
        return { suggestions: [] };
      }

      const items = completions.items || completions;
      const suggestions = items.map((item) => {
        // Map LSP CompletionItemKind to Monaco CompletionItemKind
        let kind = monaco.languages.CompletionItemKind.Text;
        if (item.kind) {
          const kindMap = {
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
            12: monaco.languages.CompletionItemKind.Value,
            13: monaco.languages.CompletionItemKind.Enum,
            14: monaco.languages.CompletionItemKind.Keyword,
            15: monaco.languages.CompletionItemKind.Snippet,
            18: monaco.languages.CompletionItemKind.File,
            21: monaco.languages.CompletionItemKind.Constant,
            22: monaco.languages.CompletionItemKind.Struct,
            23: monaco.languages.CompletionItemKind.Event,
            25: monaco.languages.CompletionItemKind.TypeParameter
          };
          kind = kindMap[item.kind] || monaco.languages.CompletionItemKind.Text;
        }

        return {
          label: item.label,
          kind,
          documentation: item.documentation?.value || item.documentation,
          detail: item.detail,
          insertText: item.insertText || item.label,
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          }
        };
      });

      return { suggestions };
    }
  });

  // Register completion provider for Python
  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.', '('],
    async provideCompletionItems(model, position) {
      const filePath = model.uri.path;

      if (!window.lsp || !window.lsp.isEnabled()) {
        return { suggestions: [] };
      }

      const completions = await window.lsp.getCompletions(filePath, {
        line: position.lineNumber - 1,
        character: position.column - 1
      });

      if (!completions) {
        return { suggestions: [] };
      }

      const items = completions.items || completions;
      const suggestions = items.map((item) => {
        let kind = monaco.languages.CompletionItemKind.Text;
        if (item.kind) {
          const kindMap = {
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
            12: monaco.languages.CompletionItemKind.Value,
            13: monaco.languages.CompletionItemKind.Enum,
            14: monaco.languages.CompletionItemKind.Keyword,
            15: monaco.languages.CompletionItemKind.Snippet
          };
          kind = kindMap[item.kind] || monaco.languages.CompletionItemKind.Text;
        }

        return {
          label: item.label,
          kind,
          documentation: item.documentation?.value || item.documentation,
          detail: item.detail,
          insertText: item.insertText || item.label,
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          }
        };
      });

      return { suggestions };
    }
  });

  // Register hover provider for Rust
  monaco.languages.registerHoverProvider('rust', {
    async provideHover(model, position) {
      const filePath = model.uri.path;

      if (!window.lsp || !window.lsp.isEnabled()) {
        return null;
      }

      const hover = await window.lsp.getHover(filePath, {
        line: position.lineNumber - 1,
        character: position.column - 1
      });

      if (!hover || !hover.contents) {
        return null;
      }

      const contents = Array.isArray(hover.contents) ? hover.contents : [hover.contents];
      const values = contents.map(content => {
        if (typeof content === 'string') {
          return { value: content };
        } else if (content.value) {
          return { value: content.value };
        } else if (content.language && content.value) {
          return { value: '```' + content.language + '\n' + content.value + '\n```' };
        }
        return { value: '' };
      }).filter(v => v.value);

      if (values.length === 0) {
        return null;
      }

      return {
        contents: values,
        range: hover.range
      };
    }
  });

  // Register hover provider for Python
  monaco.languages.registerHoverProvider('python', {
    async provideHover(model, position) {
      const filePath = model.uri.path;

      if (!window.lsp || !window.lsp.isEnabled()) {
        return null;
      }

      const hover = await window.lsp.getHover(filePath, {
        line: position.lineNumber - 1,
        character: position.column - 1
      });

      if (!hover || !hover.contents) {
        return null;
      }

      const contents = Array.isArray(hover.contents) ? hover.contents : [hover.contents];
      const values = contents.map(content => {
        if (typeof content === 'string') {
          return { value: content };
        } else if (content.value) {
          return { value: content.value };
        } else if (content.language && content.value) {
          return { value: '```' + content.language + '\n' + content.value + '\n```' };
        }
        return { value: '' };
      }).filter(v => v.value);

      if (values.length === 0) {
        return null;
      }

      return {
        contents: values,
        range: hover.range
      };
    }
  });

  // Register definition provider for Rust
  monaco.languages.registerDefinitionProvider('rust', {
    async provideDefinition(model, position) {
      const filePath = model.uri.path;

      if (!window.lsp || !window.lsp.isEnabled()) {
        return null;
      }

      const definitions = await window.lsp.getDefinition(filePath, {
        line: position.lineNumber - 1,
        character: position.column - 1
      });

      if (!definitions) {
        return null;
      }

      const defs = Array.isArray(definitions) ? definitions : [definitions];
      return defs.map(def => ({
        uri: monaco.Uri.parse(def.uri),
        range: {
          startLineNumber: def.range.start.line + 1,
          startColumn: def.range.start.character + 1,
          endLineNumber: def.range.end.line + 1,
          endColumn: def.range.end.character + 1
        }
      }));
    }
  });

  // Register definition provider for Python
  monaco.languages.registerDefinitionProvider('python', {
    async provideDefinition(model, position) {
      const filePath = model.uri.path;

      if (!window.lsp || !window.lsp.isEnabled()) {
        return null;
      }

      const definitions = await window.lsp.getDefinition(filePath, {
        line: position.lineNumber - 1,
        character: position.column - 1
      });

      if (!definitions) {
        return null;
      }

      const defs = Array.isArray(definitions) ? definitions : [definitions];
      return defs.map(def => ({
        uri: monaco.Uri.parse(def.uri),
        range: {
          startLineNumber: def.range.start.line + 1,
          startColumn: def.range.start.character + 1,
          endLineNumber: def.range.end.line + 1,
          endColumn: def.range.end.character + 1
        }
      }));
    }
  });

  // Register references provider for Rust
  monaco.languages.registerReferenceProvider('rust', {
    async provideReferences(model, position, context) {
      const filePath = model.uri.path;

      if (!window.lsp || !window.lsp.isEnabled()) {
        return null;
      }

      const references = await window.lsp.getReferences(filePath, {
        line: position.lineNumber - 1,
        character: position.column - 1
      });

      if (!references) {
        return null;
      }

      return references.map(ref => ({
        uri: monaco.Uri.parse(ref.uri),
        range: {
          startLineNumber: ref.range.start.line + 1,
          startColumn: ref.range.start.character + 1,
          endLineNumber: ref.range.end.line + 1,
          endColumn: ref.range.end.character + 1
        }
      }));
    }
  });

  // Register references provider for Python
  monaco.languages.registerReferenceProvider('python', {
    async provideReferences(model, position, context) {
      const filePath = model.uri.path;

      if (!window.lsp || !window.lsp.isEnabled()) {
        return null;
      }

      const references = await window.lsp.getReferences(filePath, {
        line: position.lineNumber - 1,
        character: position.column - 1
      });

      if (!references) {
        return null;
      }

      return references.map(ref => ({
        uri: monaco.Uri.parse(ref.uri),
        range: {
          startLineNumber: ref.range.start.line + 1,
          startColumn: ref.range.start.character + 1,
          endLineNumber: ref.range.end.line + 1,
          endColumn: ref.range.end.character + 1
        }
      }));
    }
  });

  // Register document formatting provider for Rust
  monaco.languages.registerDocumentFormattingEditProvider('rust', {
    async provideDocumentFormattingEdits(model) {
      const filePath = model.uri.path;

      if (!window.lsp || !window.lsp.isEnabled()) {
        return null;
      }

      const edits = await window.lsp.formatDocument(filePath);
      if (!edits) {
        return null;
      }

      return edits.map(edit => ({
        range: {
          startLineNumber: edit.range.start.line + 1,
          startColumn: edit.range.start.character + 1,
          endLineNumber: edit.range.end.line + 1,
          endColumn: edit.range.end.character + 1
        },
        text: edit.newText
      }));
    }
  });

  // Register document formatting provider for Python
  monaco.languages.registerDocumentFormattingEditProvider('python', {
    async provideDocumentFormattingEdits(model) {
      const filePath = model.uri.path;

      if (!window.lsp || !window.lsp.isEnabled()) {
        return null;
      }

      const edits = await window.lsp.formatDocument(filePath);
      if (!edits) {
        return null;
      }

      return edits.map(edit => ({
        range: {
          startLineNumber: edit.range.start.line + 1,
          startColumn: edit.range.start.character + 1,
          endLineNumber: edit.range.end.line + 1,
          endColumn: edit.range.end.character + 1
        },
        text: edit.newText
      }));
    }
  });

  lspMonacoInitialized = true;
  console.log('✅ LSP-Monaco integration initialized');
}

// Initialize when Monaco is ready
if (typeof monaco !== 'undefined') {
  initLSPMonaco();
} else {
  // Wait for Monaco to load
  window.addEventListener('monaco-loaded', initLSPMonaco);
}

window.lspMonaco = {
  init: initLSPMonaco
};
