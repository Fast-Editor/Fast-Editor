// IntelliSense and Auto-Completion System
// VS Code-inspired intelligent code completion

let completionProviders = [];
let hoverProviders = [];
let signatureHelpProviders = [];

// Initialize IntelliSense providers after editor is ready
function initIntelliSense() {
  if (typeof monaco === 'undefined' || !editor) {
    console.warn('Monaco or editor not ready for IntelliSense');
    return;
  }

  console.log('🧠 Initializing IntelliSense providers...');

  // Register completion providers for various languages
  registerJavaScriptCompletions();
  registerTypeScriptCompletions();
  registerPythonCompletions();
  registerHTMLCompletions();
  registerCSSCompletions();
  registerCommonSnippets();

  // Register hover providers
  registerHoverProviders();

  // Register signature help providers
  registerSignatureHelpProviders();

  console.log('✅ IntelliSense providers initialized');
}

// JavaScript/TypeScript Completions
function registerJavaScriptCompletions() {
  const jsCompletionProvider = monaco.languages.registerCompletionItemProvider(['javascript', 'typescript'], {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };

      const suggestions = [
        // Console methods
        {
          label: 'console.log',
          kind: monaco.languages.CompletionItemKind.Method,
          documentation: 'Outputs a message to the console',
          insertText: 'console.log(${1:message});',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'console.error',
          kind: monaco.languages.CompletionItemKind.Method,
          documentation: 'Outputs an error message to the console',
          insertText: 'console.error(${1:error});',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'console.warn',
          kind: monaco.languages.CompletionItemKind.Method,
          documentation: 'Outputs a warning message to the console',
          insertText: 'console.warn(${1:warning});',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },

        // Function declarations
        {
          label: 'function',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Function declaration',
          insertText: 'function ${1:name}(${2:params}) {\n\t${3:// code}\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'arrow function',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Arrow function',
          insertText: 'const ${1:name} = (${2:params}) => {\n\t${3:// code}\n};',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'async function',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Async function declaration',
          insertText: 'async function ${1:name}(${2:params}) {\n\t${3:// code}\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'async arrow',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Async arrow function',
          insertText: 'const ${1:name} = async (${2:params}) => {\n\t${3:// code}\n};',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },

        // Class and OOP
        {
          label: 'class',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Class declaration',
          insertText: 'class ${1:ClassName} {\n\tconstructor(${2:params}) {\n\t\t${3:// code}\n\t}\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },

        // Control flow
        {
          label: 'if',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'If statement',
          insertText: 'if (${1:condition}) {\n\t${2:// code}\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'if...else',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'If-else statement',
          insertText: 'if (${1:condition}) {\n\t${2:// code}\n} else {\n\t${3:// code}\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'for',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'For loop',
          insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\t${3:// code}\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'for...of',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'For-of loop',
          insertText: 'for (const ${1:item} of ${2:array}) {\n\t${3:// code}\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'for...in',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'For-in loop',
          insertText: 'for (const ${1:key} in ${2:object}) {\n\t${3:// code}\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'while',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'While loop',
          insertText: 'while (${1:condition}) {\n\t${2:// code}\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },

        // Try-catch
        {
          label: 'try...catch',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Try-catch block',
          insertText: 'try {\n\t${1:// code}\n} catch (${2:error}) {\n\t${3:// handle error}\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },

        // Promise and async
        {
          label: 'promise',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Promise',
          insertText: 'new Promise((resolve, reject) => {\n\t${1:// code}\n})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'await',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Await expression',
          insertText: 'await ${1:promise}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },

        // Array methods
        {
          label: 'map',
          kind: monaco.languages.CompletionItemKind.Method,
          documentation: 'Array.map() - Creates a new array with the results of calling a function',
          insertText: 'map(${1:item} => ${2:item})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'filter',
          kind: monaco.languages.CompletionItemKind.Method,
          documentation: 'Array.filter() - Creates a new array with elements that pass the test',
          insertText: 'filter(${1:item} => ${2:condition})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'reduce',
          kind: monaco.languages.CompletionItemKind.Method,
          documentation: 'Array.reduce() - Reduces array to a single value',
          insertText: 'reduce((${1:acc}, ${2:item}) => ${3:acc + item}, ${4:0})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'forEach',
          kind: monaco.languages.CompletionItemKind.Method,
          documentation: 'Array.forEach() - Executes a function for each array element',
          insertText: 'forEach(${1:item} => {\n\t${2:// code}\n})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        }
      ];

      return { suggestions };
    }
  });

  completionProviders.push(jsCompletionProvider);
}

// TypeScript Completions (additional TS-specific)
function registerTypeScriptCompletions() {
  const tsCompletionProvider = monaco.languages.registerCompletionItemProvider(['typescript'], {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };

      const suggestions = [
        {
          label: 'interface',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Interface declaration',
          insertText: 'interface ${1:InterfaceName} {\n\t${2:property}: ${3:type};\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'type',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Type alias',
          insertText: 'type ${1:TypeName} = ${2:type};',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'enum',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Enum declaration',
          insertText: 'enum ${1:EnumName} {\n\t${2:Member} = ${3:value}\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        }
      ];

      return { suggestions };
    }
  });

  completionProviders.push(tsCompletionProvider);
}

// Python Completions
function registerPythonCompletions() {
  const pyCompletionProvider = monaco.languages.registerCompletionItemProvider(['python'], {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };

      const suggestions = [
        {
          label: 'def',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Function definition',
          insertText: 'def ${1:function_name}(${2:params}):\n\t${3:pass}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'class',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Class definition',
          insertText: 'class ${1:ClassName}:\n\tdef __init__(self, ${2:params}):\n\t\t${3:pass}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'if',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'If statement',
          insertText: 'if ${1:condition}:\n\t${2:pass}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'for',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'For loop',
          insertText: 'for ${1:item} in ${2:iterable}:\n\t${3:pass}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'while',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'While loop',
          insertText: 'while ${1:condition}:\n\t${2:pass}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'try...except',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Try-except block',
          insertText: 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:pass}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        }
      ];

      return { suggestions };
    }
  });

  completionProviders.push(pyCompletionProvider);
}

// HTML Completions
function registerHTMLCompletions() {
  const htmlCompletionProvider = monaco.languages.registerCompletionItemProvider(['html'], {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };

      const suggestions = [
        {
          label: 'div',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Div element',
          insertText: '<div${1: class="${2:}"}>\n\t${3:}\n</div>',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'button',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Button element',
          insertText: '<button${1: type="${2:button}"}>${3:Click me}</button>',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'input',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Input element',
          insertText: '<input type="${1:text}" ${2:placeholder="${3:}"}/>',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        }
      ];

      return { suggestions };
    }
  });

  completionProviders.push(htmlCompletionProvider);
}

// CSS Completions
function registerCSSCompletions() {
  const cssCompletionProvider = monaco.languages.registerCompletionItemProvider(['css', 'scss', 'less'], {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };

      const suggestions = [
        {
          label: 'flexbox',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Flexbox container',
          insertText: 'display: flex;\njustify-content: ${1:center};\nalign-items: ${2:center};',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        },
        {
          label: 'grid',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Grid container',
          insertText: 'display: grid;\ngrid-template-columns: ${1:repeat(3, 1fr)};\ngap: ${2:1rem};',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        }
      ];

      return { suggestions };
    }
  });

  completionProviders.push(cssCompletionProvider);
}

// Common snippets across languages
function registerCommonSnippets() {
  // Can add more common snippets here
  console.log('📝 Common snippets registered');
}

// Hover providers for documentation
function registerHoverProviders() {
  const jsHoverProvider = monaco.languages.registerHoverProvider(['javascript', 'typescript'], {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      // Add documentation for common JavaScript methods
      const documentation = {
        'console': {
          contents: [
            { value: '**Console API**' },
            { value: 'The Console API provides access to the browser\'s debugging console.' }
          ]
        },
        'map': {
          contents: [
            { value: '**Array.map()**' },
            { value: 'Creates a new array with the results of calling a provided function on every element.' }
          ]
        },
        'filter': {
          contents: [
            { value: '**Array.filter()**' },
            { value: 'Creates a new array with all elements that pass the test implemented by the provided function.' }
          ]
        },
        'reduce': {
          contents: [
            { value: '**Array.reduce()**' },
            { value: 'Executes a reducer function on each element, resulting in a single output value.' }
          ]
        }
      };

      if (documentation[word.word]) {
        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn
          ),
          contents: documentation[word.word].contents
        };
      }

      return null;
    }
  });

  hoverProviders.push(jsHoverProvider);
}

// Signature help providers for parameter hints
function registerSignatureHelpProviders() {
  const jsSignatureProvider = monaco.languages.registerSignatureHelpProvider(['javascript', 'typescript'], {
    signatureHelpTriggerCharacters: ['(', ','],
    provideSignatureHelp: (model, position) => {
      // Add signature help for common functions
      return {
        dispose: () => {},
        value: {
          signatures: [
            {
              label: 'console.log(message: any, ...optionalParams: any[]): void',
              documentation: 'Outputs a message to the console',
              parameters: [
                {
                  label: 'message',
                  documentation: 'The message to output'
                }
              ]
            }
          ],
          activeSignature: 0,
          activeParameter: 0
        }
      };
    }
  });

  signatureHelpProviders.push(jsSignatureProvider);
}

// Initialize when editor is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for editor to be fully initialized
    setTimeout(initIntelliSense, 500);
  });
} else {
  setTimeout(initIntelliSense, 500);
}

// Export for external use
window.initIntelliSense = initIntelliSense;
