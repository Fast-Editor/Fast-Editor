/**
 * TypeScript Definition Files (.d.ts) Manager
 * Extends IntelliSense by loading type definitions for libraries and frameworks
 */

// Storage for loaded definitions
const loadedDefinitions = new Map();

// Common library definitions from CDN
const LIBRARY_DEFINITIONS = {
  // React
  'react': {
    name: 'React',
    files: [
      'https://unpkg.com/@types/react@18/index.d.ts',
      'https://unpkg.com/@types/react@18/global.d.ts'
    ]
  },
  'react-dom': {
    name: 'React DOM',
    files: [
      'https://unpkg.com/@types/react-dom@18/index.d.ts'
    ]
  },

  // Node.js
  'node': {
    name: 'Node.js',
    files: [
      'https://unpkg.com/@types/node@20/index.d.ts'
    ]
  },

  // Express
  'express': {
    name: 'Express',
    files: [
      'https://unpkg.com/@types/express@4/index.d.ts'
    ]
  },

  // Lodash
  'lodash': {
    name: 'Lodash',
    files: [
      'https://unpkg.com/@types/lodash@4/index.d.ts'
    ]
  },

  // jQuery
  'jquery': {
    name: 'jQuery',
    files: [
      'https://unpkg.com/@types/jquery@3/index.d.ts'
    ]
  },

  // Vue
  'vue': {
    name: 'Vue 3',
    files: [
      'https://unpkg.com/@types/vue@3/index.d.ts'
    ]
  },

  // Jest
  'jest': {
    name: 'Jest',
    files: [
      'https://unpkg.com/@types/jest@29/index.d.ts'
    ]
  },

  // Axios
  'axios': {
    name: 'Axios',
    files: [
      'https://unpkg.com/axios@1/index.d.ts'
    ]
  }
};

/**
 * Load a .d.ts file from URL
 */
async function loadDefinitionFromURL(url, filePath = null) {
  try {
    console.log(`📥 Loading type definitions from ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const content = await response.text();
    const path = filePath || `file:///node_modules/@types/${url.split('/').pop()}`;

    await addTypeDefinition(path, content);

    console.log(`✅ Loaded type definitions: ${path}`);
    return { success: true, path, content };

  } catch (error) {
    console.error(`❌ Failed to load type definitions from ${url}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Add type definition content to Monaco
 */
async function addTypeDefinition(filePath, content) {
  if (!window.monaco) {
    throw new Error('Monaco editor not initialized');
  }

  // Check if already loaded
  if (loadedDefinitions.has(filePath)) {
    console.log(`⚠️  Definition already loaded: ${filePath}`);
    return;
  }

  // Add to Monaco's TypeScript/JavaScript language service
  monaco.languages.typescript.javascriptDefaults.addExtraLib(content, filePath);
  monaco.languages.typescript.typescriptDefaults.addExtraLib(content, filePath);

  // Store reference
  loadedDefinitions.set(filePath, {
    content,
    loadedAt: Date.now()
  });

  console.log(`✅ Added type definition: ${filePath}`);
}

/**
 * Load type definitions for a library
 */
async function loadLibrary(libraryName) {
  const library = LIBRARY_DEFINITIONS[libraryName];

  if (!library) {
    throw new Error(`Unknown library: ${libraryName}. Available: ${Object.keys(LIBRARY_DEFINITIONS).join(', ')}`);
  }

  console.log(`📚 Loading ${library.name} type definitions...`);

  const results = [];
  for (const url of library.files) {
    const result = await loadDefinitionFromURL(url);
    results.push(result);
  }

  const allSuccess = results.every(r => r.success);
  if (allSuccess) {
    console.log(`✅ Successfully loaded ${library.name} type definitions`);
  } else {
    console.warn(`⚠️  Some ${library.name} definitions failed to load`);
  }

  return results;
}

/**
 * Load multiple libraries at once
 */
async function loadLibraries(libraryNames) {
  console.log(`📚 Loading type definitions for: ${libraryNames.join(', ')}`);

  const results = {};
  for (const name of libraryNames) {
    try {
      results[name] = await loadLibrary(name);
    } catch (error) {
      console.error(`❌ Failed to load ${name}:`, error);
      results[name] = { success: false, error: error.message };
    }
  }

  return results;
}

/**
 * Load custom .d.ts content directly
 */
async function addCustomDefinition(name, content) {
  const filePath = `file:///custom/${name}.d.ts`;
  await addTypeDefinition(filePath, content);
  console.log(`✅ Added custom definition: ${name}`);
}

/**
 * Load .d.ts file from workspace
 */
async function loadLocalDefinitionFile(filePath) {
  try {
    console.log(`📥 Loading local type definition: ${filePath}`);

    // Read file via IPC
    const result = await window.api.readFile(filePath);

    if (!result || !result.content) {
      throw new Error('Failed to read file');
    }

    // Use actual file path for better IntelliSense navigation
    await addTypeDefinition(`file://${filePath}`, result.content);

    console.log(`✅ Loaded local type definition: ${filePath}`);
    return { success: true, filePath };

  } catch (error) {
    console.error(`❌ Failed to load local definition:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Scan workspace for .d.ts files and auto-load them
 */
async function scanAndLoadWorkspaceDefinitions(workspacePath) {
  if (!workspacePath) {
    console.log('No workspace open');
    return;
  }

  try {
    console.log(`🔍 Scanning workspace for .d.ts files...`);

    // Get all .d.ts files in workspace
    const dtsFiles = await window.api.findFiles(workspacePath, '**/*.d.ts');

    if (!dtsFiles || dtsFiles.length === 0) {
      console.log('No .d.ts files found in workspace');
      return;
    }

    console.log(`📚 Found ${dtsFiles.length} .d.ts files`);

    // Load each file
    const results = [];
    for (const filePath of dtsFiles) {
      const result = await loadLocalDefinitionFile(filePath);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Loaded ${successCount}/${dtsFiles.length} type definition files`);

    return results;

  } catch (error) {
    console.error('❌ Failed to scan workspace:', error);
    return [];
  }
}

/**
 * Configure TypeScript compiler options
 */
function configureTypeScriptOptions(options = {}) {
  if (!window.monaco) {
    throw new Error('Monaco editor not initialized');
  }

  const defaultOptions = {
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.CommonJS,
    noEmit: true,
    esModuleInterop: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    reactNamespace: 'React',
    allowJs: true,
    typeRoots: ['node_modules/@types'],
    ...options
  };

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(defaultOptions);
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions(defaultOptions);

  console.log('✅ TypeScript compiler options configured');
}

/**
 * Enable semantic diagnostics (type checking)
 */
function enableDiagnostics(enabled = true) {
  if (!window.monaco) {
    throw new Error('Monaco editor not initialized');
  }

  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: !enabled,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false
  });

  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: !enabled,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false
  });

  console.log(`✅ Type checking ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Get list of loaded definitions
 */
function getLoadedDefinitions() {
  return Array.from(loadedDefinitions.entries()).map(([path, data]) => ({
    path,
    loadedAt: new Date(data.loadedAt).toISOString(),
    size: data.content.length
  }));
}

/**
 * Clear all loaded definitions
 */
function clearAllDefinitions() {
  loadedDefinitions.clear();

  // Reset Monaco's extra libs
  monaco.languages.typescript.typescriptDefaults.setExtraLibs([]);
  monaco.languages.typescript.javascriptDefaults.setExtraLibs([]);

  console.log('✅ Cleared all type definitions');
}

/**
 * Get available library presets
 */
function getAvailableLibraries() {
  return Object.entries(LIBRARY_DEFINITIONS).map(([id, lib]) => ({
    id,
    name: lib.name,
    files: lib.files.length
  }));
}

/**
 * Initialize type definitions system
 */
function initTypeDefinitions() {
  if (!window.monaco) {
    console.warn('Monaco not available, delaying type definitions initialization');
    return;
  }

  // Configure TypeScript options
  configureTypeScriptOptions();

  // Enable diagnostics
  enableDiagnostics(true);

  console.log('✅ Type definitions system initialized');
  console.log(`📚 Available libraries: ${Object.keys(LIBRARY_DEFINITIONS).join(', ')}`);
}

// Initialize when Monaco is ready
if (window.monaco) {
  initTypeDefinitions();
} else {
  window.addEventListener('load', () => {
    if (window.monaco) {
      initTypeDefinitions();
    }
  });
}

// Export API
window.typeDefinitions = {
  // Load definitions
  loadLibrary,
  loadLibraries,
  loadFromURL: loadDefinitionFromURL,
  addCustom: addCustomDefinition,
  loadLocalFile: loadLocalDefinitionFile,
  scanWorkspace: scanAndLoadWorkspaceDefinitions,

  // Configuration
  configure: configureTypeScriptOptions,
  enableDiagnostics,

  // Info
  getLoaded: getLoadedDefinitions,
  getAvailable: getAvailableLibraries,
  clear: clearAllDefinitions
};

console.log('📦 Type definitions module loaded');
console.log('💡 Usage: window.typeDefinitions.loadLibrary("react")');
