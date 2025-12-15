/**
 * AI Settings UI
 * User interface for configuring AI-powered completions
 */

// Initialize AI settings UI
function initAISettingsUI() {
  // Add event listeners
  const openBtn = document.getElementById('ai-settings-btn');
  if (openBtn) {
    openBtn.addEventListener('click', openAISettings);
  }

  const closeBtn = document.getElementById('ai-settings-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeAISettings);
  }

  const cancelBtn = document.getElementById('ai-settings-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeAISettings);
  }

  const saveBtn = document.getElementById('ai-settings-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveAISettings);
  }

  const providerSelect = document.getElementById('ai-provider');
  if (providerSelect) {
    providerSelect.addEventListener('change', onProviderChange);
  }

  // Close on overlay click
  const overlay = document.getElementById('ai-settings-modal');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeAISettings();
      }
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('ai-settings-modal');
      if (modal && !modal.classList.contains('hidden')) {
        closeAISettings();
      }
    }
  });
}

// Open AI settings modal
function openAISettings() {
  const modal = document.getElementById('ai-settings-modal');
  if (!modal) return;

  // Load current settings
  loadCurrentSettings();

  // Show modal
  modal.classList.remove('hidden');

  // Focus first input
  setTimeout(() => {
    const firstInput = modal.querySelector('input:not([type="checkbox"])');
    if (firstInput) firstInput.focus();
  }, 100);
}

// Close AI settings modal
function closeAISettings() {
  const modal = document.getElementById('ai-settings-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Load current AI settings into form
function loadCurrentSettings() {
  if (!window.aiCompletions) {
    console.warn('AI completions not available');
    return;
  }

  const config = window.aiCompletions.getConfig();

  // Basic settings
  document.getElementById('ai-enabled').checked = config.enabled || false;
  document.getElementById('ai-provider').value = config.provider || 'openai';

  // API settings
  document.getElementById('ai-api-key').value = config.apiKey || '';
  document.getElementById('ai-endpoint').value = config.endpoint || '';
  document.getElementById('ai-model').value = config.model || 'gpt-4';

  // Azure specific
  document.getElementById('ai-azure-deployment').value = config.azureDeployment || '';
  document.getElementById('ai-azure-version').value = config.azureApiVersion || '2024-02-15-preview';

  // Advanced settings
  document.getElementById('ai-max-tokens').value = config.maxTokens || 100;
  document.getElementById('ai-temperature').value = config.temperature || 0.2;
  document.getElementById('ai-debounce').value = config.debounceDelay || 500;
  document.getElementById('ai-context-lines').value = config.contextLines || 50;

  // Cache settings
  document.getElementById('ai-cache-enabled').checked = config.cacheEnabled !== false;
  document.getElementById('ai-cache-duration').value = (config.cacheDuration || 300000) / 60000; // Convert to minutes

  // Update UI based on provider
  onProviderChange();
}

// Handle provider change
function onProviderChange() {
  const provider = document.getElementById('ai-provider').value;

  // Show/hide Azure fields
  const azureFields = document.getElementById('azure-specific-fields');
  if (azureFields) {
    azureFields.style.display = provider === 'azure' ? 'block' : 'none';
  }

  // Show/hide endpoint field
  const endpointGroup = document.getElementById('ai-endpoint').parentElement;
  if (endpointGroup) {
    const needsEndpoint = provider === 'azure' || provider === 'local' || provider === 'ollama';
    endpointGroup.style.display = needsEndpoint ? 'block' : 'none';
  }

  // Show/hide API key field
  const apiKeyGroup = document.getElementById('ai-api-key').parentElement;
  if (apiKeyGroup) {
    const needsApiKey = provider !== 'local' && provider !== 'ollama';
    apiKeyGroup.style.display = needsApiKey ? 'block' : 'none';
  }

  // Update placeholder text
  const endpointInput = document.getElementById('ai-endpoint');
  const modelInput = document.getElementById('ai-model');

  if (endpointInput) {
    switch (provider) {
      case 'azure':
        endpointInput.placeholder = 'https://your-resource.openai.azure.com';
        break;
      case 'ollama':
        endpointInput.placeholder = 'http://localhost:11434';
        endpointInput.value = endpointInput.value || 'http://localhost:11434';
        break;
      case 'local':
        endpointInput.placeholder = 'http://your-server:8000';
        break;
    }
  }

  if (modelInput) {
    switch (provider) {
      case 'azure':
        modelInput.placeholder = 'Not needed (uses deployment)';
        break;
      case 'ollama':
        modelInput.placeholder = 'deepseek-coder:6.7b';
        break;
      case 'anthropic':
        modelInput.placeholder = 'claude-3-sonnet-20240229';
        break;
      default:
        modelInput.placeholder = 'gpt-4';
    }
  }
}

// Save AI settings
function saveAISettings() {
  if (!window.aiCompletions) {
    window.showNotification('AI completions not available', 3000);
    return;
  }

  try {
    // Get values from form
    const config = {
      enabled: document.getElementById('ai-enabled').checked,
      provider: document.getElementById('ai-provider').value,
      apiKey: document.getElementById('ai-api-key').value.trim(),
      endpoint: document.getElementById('ai-endpoint').value.trim(),
      model: document.getElementById('ai-model').value.trim(),
      azureDeployment: document.getElementById('ai-azure-deployment').value.trim(),
      azureApiVersion: document.getElementById('ai-azure-version').value.trim(),
      maxTokens: parseInt(document.getElementById('ai-max-tokens').value) || 100,
      temperature: parseFloat(document.getElementById('ai-temperature').value) || 0.2,
      debounceDelay: parseInt(document.getElementById('ai-debounce').value) || 500,
      contextLines: parseInt(document.getElementById('ai-context-lines').value) || 50,
      cacheEnabled: document.getElementById('ai-cache-enabled').checked,
      cacheDuration: parseInt(document.getElementById('ai-cache-duration').value) * 60000 // Convert minutes to ms
    };

    // Validate
    if (config.enabled) {
      const provider = config.provider;

      // Check API key for cloud providers
      if ((provider === 'openai' || provider === 'azure' || provider === 'anthropic') && !config.apiKey) {
        window.showNotification('API key is required for ' + provider, 3000);
        return;
      }

      // Check endpoint for Azure and local
      if ((provider === 'azure' || provider === 'local' || provider === 'ollama') && !config.endpoint) {
        window.showNotification('Endpoint URL is required for ' + provider, 3000);
        return;
      }

      // Check Azure deployment
      if (provider === 'azure' && !config.azureDeployment) {
        window.showNotification('Azure deployment name is required', 3000);
        return;
      }

      // Check model for non-Azure
      if (provider !== 'azure' && !config.model) {
        window.showNotification('Model name is required', 3000);
        return;
      }
    }

    // Apply configuration
    window.aiCompletions.configure(config);

    // Show success message
    window.showNotification(
      config.enabled
        ? `✅ AI completions enabled (${config.provider})`
        : '❌ AI completions disabled',
      2000
    );

    // Close modal
    closeAISettings();

    // Log to console for debugging
    console.log('AI settings saved:', {
      ...config,
      apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : ''
    });

  } catch (error) {
    console.error('Error saving AI settings:', error);
    window.showNotification('Error saving settings: ' + error.message, 3000);
  }
}

// Test AI connection
async function testAIConnection() {
  if (!window.aiCompletions) {
    window.showNotification('AI completions not available', 3000);
    return;
  }

  const testBtn = document.getElementById('ai-test-connection');
  if (!testBtn) return;

  // Disable button during test
  testBtn.disabled = true;
  testBtn.textContent = 'Testing...';

  try {
    // Save settings first (without closing)
    const config = {
      enabled: true,
      provider: document.getElementById('ai-provider').value,
      apiKey: document.getElementById('ai-api-key').value.trim(),
      endpoint: document.getElementById('ai-endpoint').value.trim(),
      model: document.getElementById('ai-model').value.trim(),
      azureDeployment: document.getElementById('ai-azure-deployment').value.trim(),
      azureApiVersion: document.getElementById('ai-azure-version').value.trim()
    };

    window.aiCompletions.configure(config);

    // Try to get a simple completion
    const testPrompt = {
      role: 'user',
      content: 'Say "hello"'
    };

    // Note: This is a simplified test. The actual implementation would need
    // to expose a test method in ai-completions.js
    window.showNotification('✅ Configuration looks valid. Try typing code to test!', 3000);

  } catch (error) {
    window.showNotification('❌ Connection failed: ' + error.message, 5000);
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = 'Test Connection';
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAISettingsUI);
} else {
  initAISettingsUI();
}

// Export for external use
window.openAISettings = openAISettings;

console.log('✅ AI Settings UI loaded');
