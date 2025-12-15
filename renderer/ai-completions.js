/**
 * AI-Powered Code Completions
 * Foundation for integrating AI models (OpenAI, Anthropic, local models) for intelligent code suggestions
 */

// Configuration
const AI_CONFIG = {
  enabled: false,
  provider: 'openai', // 'openai', 'azure', 'anthropic', 'local', 'ollama'
  apiKey: '',
  model: 'gpt-4',
  endpoint: '', // Custom endpoint for local models or Azure resource URL

  // Azure OpenAI specific
  azureDeployment: '', // Azure OpenAI deployment name
  azureApiVersion: '2024-02-15-preview', // Azure API version

  maxTokens: 100,
  temperature: 0.2,
  debounceDelay: 500, // ms to wait before sending request
  cacheEnabled: true,
  cacheDuration: 300000, // 5 minutes
  contextLines: 50 // Lines of code to send as context
};

// Cache for AI completions
const completionCache = new Map();

// Debounce timer
let completionTimer = null;

// Loading state
let isLoadingAICompletion = false;

/**
 * Load AI completion settings from localStorage
 */
function loadAISettings() {
  try {
    const settings = localStorage.getItem('aiCompletionSettings');
    if (settings) {
      const parsed = JSON.parse(settings);
      Object.assign(AI_CONFIG, parsed);
    }
  } catch (err) {
    console.error('Error loading AI completion settings:', err);
  }
}

/**
 * Save AI completion settings to localStorage
 */
function saveAISettings() {
  try {
    localStorage.setItem('aiCompletionSettings', JSON.stringify(AI_CONFIG));
  } catch (err) {
    console.error('Error saving AI completion settings:', err);
  }
}

/**
 * Generate cache key for completion request
 */
function getCacheKey(context, position) {
  return `${context.substring(0, 100)}_${position.lineNumber}_${position.column}`;
}

/**
 * Check if cached completion is still valid
 */
function getCachedCompletion(key) {
  if (!AI_CONFIG.cacheEnabled) return null;

  const cached = completionCache.get(key);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > AI_CONFIG.cacheDuration) {
    completionCache.delete(key);
    return null;
  }

  return cached.suggestions;
}

/**
 * Cache completion suggestions
 */
function cacheCompletion(key, suggestions) {
  if (!AI_CONFIG.cacheEnabled) return;

  completionCache.set(key, {
    suggestions,
    timestamp: Date.now()
  });

  // Limit cache size to prevent memory issues
  if (completionCache.size > 100) {
    const firstKey = completionCache.keys().next().value;
    completionCache.delete(firstKey);
  }
}

/**
 * Extract code context around cursor position
 */
function getCodeContext(model, position) {
  const totalLines = model.getLineCount();
  const startLine = Math.max(1, position.lineNumber - AI_CONFIG.contextLines);
  const endLine = Math.min(totalLines, position.lineNumber + AI_CONFIG.contextLines);

  const beforeCursor = model.getValueInRange({
    startLineNumber: startLine,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column
  });

  const afterCursor = model.getValueInRange({
    startLineNumber: position.lineNumber,
    endColumn: position.column,
    endLineNumber: endLine,
    endColumn: model.getLineMaxColumn(endLine)
  });

  return {
    before: beforeCursor,
    after: afterCursor,
    currentLine: model.getLineContent(position.lineNumber),
    language: model.getLanguageId()
  };
}

/**
 * Build prompt for AI completion
 */
function buildCompletionPrompt(context) {
  return {
    role: 'user',
    content: `You are a code completion assistant. Given the following code context, provide a concise completion suggestion.

Language: ${context.language}

Code before cursor:
\`\`\`${context.language}
${context.before}
\`\`\`

Code after cursor:
\`\`\`${context.language}
${context.after}
\`\`\`

Provide only the completion text without explanations. Focus on the most likely continuation based on the context.`
  };
}

/**
 * Request completion from OpenAI
 */
async function requestOpenAICompletion(prompt) {
  if (!AI_CONFIG.apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_CONFIG.apiKey}`
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      messages: [prompt],
      max_tokens: AI_CONFIG.maxTokens,
      temperature: AI_CONFIG.temperature,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Request completion from Azure OpenAI
 */
async function requestAzureOpenAICompletion(prompt) {
  if (!AI_CONFIG.apiKey) {
    throw new Error('Azure OpenAI API key not configured');
  }

  if (!AI_CONFIG.endpoint) {
    throw new Error('Azure OpenAI endpoint not configured (e.g., https://your-resource.openai.azure.com)');
  }

  if (!AI_CONFIG.azureDeployment) {
    throw new Error('Azure OpenAI deployment name not configured');
  }

  // Build Azure OpenAI endpoint URL
  const endpoint = AI_CONFIG.endpoint.replace(/\/$/, ''); // Remove trailing slash
  const url = `${endpoint}/openai/deployments/${AI_CONFIG.azureDeployment}/chat/completions?api-version=${AI_CONFIG.azureApiVersion}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': AI_CONFIG.apiKey
    },
    body: JSON.stringify({
      messages: [prompt],
      max_tokens: AI_CONFIG.maxTokens,
      temperature: AI_CONFIG.temperature,
      stream: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Request completion from Anthropic Claude
 */
async function requestAnthropicCompletion(prompt) {
  if (!AI_CONFIG.apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': AI_CONFIG.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: AI_CONFIG.model || 'claude-3-sonnet-20240229',
      max_tokens: AI_CONFIG.maxTokens,
      messages: [prompt],
      temperature: AI_CONFIG.temperature
    })
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.content[0]?.text || '';
}

/**
 * Request completion from local/Ollama model
 */
async function requestLocalCompletion(prompt) {
  if (!AI_CONFIG.endpoint) {
    throw new Error('Local model endpoint not configured');
  }

  const response = await fetch(`${AI_CONFIG.endpoint}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      prompt: prompt.content,
      stream: false,
      options: {
        temperature: AI_CONFIG.temperature,
        num_predict: AI_CONFIG.maxTokens
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Local model error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.response || '';
}

/**
 * Request AI completion based on configured provider
 */
async function requestAICompletion(context) {
  const prompt = buildCompletionPrompt(context);

  switch (AI_CONFIG.provider) {
    case 'openai':
      return await requestOpenAICompletion(prompt);

    case 'azure':
      return await requestAzureOpenAICompletion(prompt);

    case 'anthropic':
      return await requestAnthropicCompletion(prompt);

    case 'local':
    case 'ollama':
      return await requestLocalCompletion(prompt);

    default:
      throw new Error(`Unknown AI provider: ${AI_CONFIG.provider}`);
  }
}

/**
 * Parse AI response into Monaco completion items
 */
function parseAICompletionResponse(response, range) {
  const suggestions = [];

  // Clean up the response (remove code fences, extra whitespace)
  let cleanedResponse = response
    .replace(/```[\w]*\n?/g, '')
    .trim();

  // Split into multiple suggestions if response contains multiple options
  const options = cleanedResponse.split('\n\n').filter(opt => opt.trim());

  options.forEach((option, index) => {
    suggestions.push({
      label: `✨ AI: ${option.substring(0, 50)}${option.length > 50 ? '...' : ''}`,
      kind: monaco.languages.CompletionItemKind.Snippet,
      documentation: {
        value: `**AI-Generated Suggestion**\n\n${option}`,
        isTrusted: true
      },
      insertText: option,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range: range,
      sortText: `0${index}`, // Show at top
      preselect: index === 0, // Preselect first suggestion
      detail: `AI (${AI_CONFIG.provider})`
    });
  });

  return suggestions;
}

/**
 * Register AI completion provider for Monaco
 */
function registerAICompletionProvider() {
  if (!window.monaco) {
    console.warn('Monaco editor not available, skipping AI completion provider');
    return;
  }

  // Register for all languages
  const provider = monaco.languages.registerCompletionItemProvider(['*'], {
    triggerCharacters: ['.', ' ', '\n'],

    provideCompletionItems: async (model, position, context, token) => {
      // Don't provide AI completions if disabled
      if (!AI_CONFIG.enabled || !AI_CONFIG.apiKey) {
        return { suggestions: [] };
      }

      // Don't trigger on manual invoke (Ctrl+Space) - let built-in completions handle that
      if (context.triggerKind === monaco.languages.CompletionTriggerKind.Invoke) {
        return { suggestions: [] };
      }

      const codeContext = getCodeContext(model, position);
      const cacheKey = getCacheKey(codeContext.before, position);

      // Check cache first
      const cached = getCachedCompletion(cacheKey);
      if (cached) {
        console.log('✅ Using cached AI completion');
        return { suggestions: cached };
      }

      // Debounce AI requests
      return new Promise((resolve) => {
        if (completionTimer) {
          clearTimeout(completionTimer);
        }

        completionTimer = setTimeout(async () => {
          if (isLoadingAICompletion) {
            resolve({ suggestions: [] });
            return;
          }

          try {
            isLoadingAICompletion = true;
            console.log('🤖 Requesting AI completion...');

            const response = await requestAICompletion(codeContext);

            const range = {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            };

            const suggestions = parseAICompletionResponse(response, range);

            // Cache the suggestions
            cacheCompletion(cacheKey, suggestions);

            console.log(`✅ AI completion received: ${suggestions.length} suggestions`);
            resolve({ suggestions });

          } catch (error) {
            console.error('❌ AI completion error:', error);
            resolve({ suggestions: [] });
          } finally {
            isLoadingAICompletion = false;
          }
        }, AI_CONFIG.debounceDelay);
      });
    }
  });

  console.log('✅ AI completion provider registered');
  return provider;
}

/**
 * Enable AI completions
 */
function enableAICompletions() {
  AI_CONFIG.enabled = true;
  saveAISettings();
  console.log('✅ AI completions enabled');
}

/**
 * Disable AI completions
 */
function disableAICompletions() {
  AI_CONFIG.enabled = false;
  saveAISettings();
  console.log('❌ AI completions disabled');
}

/**
 * Configure AI completions
 */
function configureAI(config) {
  Object.assign(AI_CONFIG, config);
  saveAISettings();
  console.log('✅ AI configuration updated:', config);
}

/**
 * Get current AI configuration (safe - no API key exposed)
 */
function getAIConfig() {
  return {
    ...AI_CONFIG,
    apiKey: AI_CONFIG.apiKey ? '***' + AI_CONFIG.apiKey.slice(-4) : '' // Masked
  };
}

/**
 * Clear completion cache
 */
function clearAICache() {
  completionCache.clear();
  console.log('✅ AI completion cache cleared');
}

// Initialize on load
loadAISettings();

// Register provider when Monaco is ready
if (window.monaco) {
  registerAICompletionProvider();
} else {
  // Wait for Monaco to be ready
  window.addEventListener('load', () => {
    if (window.monaco) {
      registerAICompletionProvider();
    }
  });
}

// Export functions for external use
window.aiCompletions = {
  enable: enableAICompletions,
  disable: disableAICompletions,
  configure: configureAI,
  getConfig: getAIConfig,
  clearCache: clearAICache,
  isEnabled: () => AI_CONFIG.enabled
};

// Log initialization
console.log('🤖 AI Completions module loaded');
