// Markdown Preview - Robust Implementation
let previewVisible = false;
let currentMarkdownFile = null;
let mermaidInitialized = false;
let markdownPreviewInitialized = false; // Track initialization

// Web Worker for off-thread markdown parsing
let markdownWorker = null;
let workerInitialized = false;

// Initialize markdown worker for off-thread parsing
function initMarkdownWorker() {
  if (workerInitialized) return;

  try {
    markdownWorker = new Worker('markdown-worker.js');
    workerInitialized = true;
    console.log('✅ Markdown worker initialized');
  } catch (err) {
    console.error('Failed to initialize markdown worker:', err);
    // Fallback to main thread parsing
    markdownWorker = null;
  }
}

// Wait for all libraries to load (lazy loaded on demand)
async function initMarkdownLibraries() {
  // Initialize web worker for off-thread parsing
  initMarkdownWorker();

  // Load libraries on demand (for DOMPurify, KaTeX, Mermaid)
  // marked and highlight.js now load in the worker
  if (typeof window.loadMarkdownLibraries === 'function') {
    try {
      await window.loadMarkdownLibraries();
    } catch (err) {
      console.error('Failed to load markdown libraries:', err);
      return;
    }
  }

  // Check if required libraries are loaded (marked & hljs are in worker now)
  if (typeof DOMPurify === 'undefined' ||
      typeof katex === 'undefined' ||
      typeof mermaid === 'undefined') {
    console.log('Waiting for markdown libraries to load...');
    setTimeout(initMarkdownLibraries, 100);
    return;
  }

  console.log('All markdown libraries loaded successfully');

  // Configure mermaid (marked is configured in worker)
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'monospace'
    });
    mermaidInitialized = true;
  }

  // Check current file again after libraries load
  checkIfMarkdownFile();

  // If preview is visible, update it now that libraries are loaded
  if (previewVisible) {
    updatePreview();
  }
}

// Configure marked with all extensions and features
function configureMarmked() {
  try {
    // Initialize Mermaid
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        fontFamily: 'monospace'
      });
      mermaidInitialized = true;
    }

    // Configure marked options first
    marked.setOptions({
      breaks: true,
      gfm: true,
      pedantic: false,
      sanitize: false, // We'll use DOMPurify instead
      smartLists: true,
      smartypants: true,
      xhtml: false
    });

    // Use marked.use() to add custom renderer extensions
    marked.use({
      renderer: {
        // Enhanced link rendering - open external links in new tab
        link(token) {
          const href = token.href || '';
          const title = token.title || '';
          const text = token.text || '';

          const isExternal = href.startsWith('http://') || href.startsWith('https://');
          const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
          const titleAttr = title ? ` title="${title}"` : '';
          return `<a href="${href}"${titleAttr}${target}>${text}</a>`;
        },

        // Enhanced image rendering - handle relative paths
        image(token) {
          const href = token.href || '';
          const title = token.title || '';
          const text = token.text || '';

          // If it's a relative path and we have a current file, resolve it
          let imgSrc = href;
          if (href && !href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('data:')) {
            if (currentMarkdownFile) {
              const dirPath = currentMarkdownFile.substring(0, currentMarkdownFile.lastIndexOf('/'));
              imgSrc = `file://${dirPath}/${href}`;
            }
          }
          const titleAttr = title ? ` title="${title}"` : '';
          const altAttr = text ? ` alt="${text}"` : '';
          return `<img src="${imgSrc}"${altAttr}${titleAttr} loading="lazy">`;
        },

        // Enhanced code block rendering with copy button
        code(token) {
          const code = token.text || '';
          const language = token.lang || '';

          const validLanguage = language && hljs.getLanguage(language) ? language : 'plaintext';
          let highlighted;

          try {
            highlighted = hljs.highlight(code, { language: validLanguage }).value;
          } catch (err) {
            console.error('Highlight error:', err);
            highlighted = code;
          }

          // Check if it's a mermaid diagram
          if (language === 'mermaid') {
            const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
            return `<div class="mermaid-diagram" id="${id}">${code}</div>`;
          }

          return `
            <div class="code-block-wrapper">
              <div class="code-block-header">
                <span class="code-block-language">${validLanguage}</span>
                <button class="code-copy-btn" onclick="copyCodeToClipboard(this)" title="Copy code">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1z"/>
                    <path d="M2 5h1v6H2zm9-2h1v6h-1z"/>
                  </svg>
                </button>
              </div>
              <pre><code class="hljs language-${validLanguage}">${highlighted}</code></pre>
            </div>
          `;
        },

        // Task list rendering
        listitem(token) {
          const text = token.text || '';
          const task = token.task;
          const checked = token.checked;

          if (task) {
            const checkedAttr = checked ? ' checked' : '';
            const checkedClass = checked ? ' checked' : '';
            return `<li class="task-list-item${checkedClass}"><input type="checkbox"${checkedAttr} disabled> ${text}</li>`;
          }
          return `<li>${text}</li>`;
        }
      }
    });

    console.log('Marked configured with all extensions');
  } catch (err) {
    console.error('Error configuring marked:', err);
  }
}

// Don't initialize immediately - wait for markdown file to be opened (lazy loading)
// initMarkdownLibraries();

// Initialize markdown preview
function initMarkdownPreview() {
  // Prevent duplicate initialization
  if (markdownPreviewInitialized) {
    console.log('Markdown preview already initialized, skipping');
    return;
  }

  markdownPreviewInitialized = true;
  console.log('Markdown preview initialized');

  // Setup button handlers
  setupButtonHandlers();

  // Listen for tab changes to detect markdown files
  window.addEventListener('tab-changed', (e) => {
    checkIfMarkdownFile();
  });

  // Initial check with delay to ensure tabs.js is loaded
  setTimeout(() => {
    checkIfMarkdownFile();
  }, 500);
}

// Check if current file is markdown
function checkIfMarkdownFile() {
  // Check if getActiveTab function exists
  if (typeof window.getActiveTab !== 'function') {
    hideMarkdownButton();
    return;
  }

  const activeTab = window.getActiveTab();

  if (!activeTab || !activeTab.filePath) {
    hideMarkdownButton();
    return;
  }

  const filePath = activeTab.filePath;
  const ext = filePath.split('.').pop().toLowerCase();
  const isMarkdown = ext === 'md' || ext === 'markdown' || ext === 'mdown' || ext === 'mkd';

  if (isMarkdown) {
    currentMarkdownFile = filePath;

    // Lazy load markdown libraries on first markdown file
    if (!window.markdownLibsLoaded && !window.markdownLibsPromise) {
      initMarkdownLibraries();
    }

    showMarkdownButton();

    // If preview was open, update it
    if (previewVisible) {
      updatePreview();
    }
  } else {
    currentMarkdownFile = null;
    hideMarkdownButton();
    if (previewVisible) {
      hidePreview();
    }
  }
}

// Show markdown preview button
function showMarkdownButton() {
  const button = document.getElementById('markdown-preview-btn');
  if (button) {
    button.style.display = 'flex';
  }
}

// Hide markdown preview button
function hideMarkdownButton() {
  const button = document.getElementById('markdown-preview-btn');
  if (button) {
    button.style.display = 'none';
  }
}

// Toggle preview
function togglePreview() {
  if (previewVisible) {
    hidePreview();
  } else {
    showPreview();
  }
}

// Show preview
function showPreview() {
  const previewPanel = document.getElementById('markdown-preview-panel');
  const previewBtn = document.getElementById('markdown-preview-btn');

  if (!previewPanel || !previewBtn) return;

  previewPanel.classList.add('active');
  previewBtn.classList.add('active');

  previewVisible = true;

  // Trigger library loading if not started yet
  if (!window.markdownLibsLoaded && !window.markdownLibsPromise) {
    initMarkdownLibraries();
  }

  updatePreview();

  // Resize editor
  if (editor) {
    setTimeout(() => editor.layout(), 100);
  }
}

// Hide preview
function hidePreview() {
  const previewPanel = document.getElementById('markdown-preview-panel');
  const previewBtn = document.getElementById('markdown-preview-btn');

  if (!previewPanel || !previewBtn) return;

  previewPanel.classList.remove('active');
  previewBtn.classList.remove('active');

  previewVisible = false;

  // Resize editor
  if (editor) {
    setTimeout(() => editor.layout(), 100);
  }
}

// Render math equations in HTML using KaTeX
function renderMathInHtml(html) {
  if (typeof katex === 'undefined') {
    return html; // KaTeX not loaded, skip math rendering
  }

  try {
    // Render display math ($$...$$)
    html = html.replace(/\$\$([\s\S]+?)\$\$/g, (match, math) => {
      try {
        return katex.renderToString(math, {
          displayMode: true,
          throwOnError: false
        });
      } catch (err) {
        console.error('KaTeX display math error:', err);
        return match;
      }
    });

    // Render inline math ($...$)
    html = html.replace(/\$([^\$\n]+?)\$/g, (match, math) => {
      try {
        return katex.renderToString(math, {
          displayMode: false,
          throwOnError: false
        });
      } catch (err) {
        console.error('KaTeX inline math error:', err);
        return match;
      }
    });
  } catch (err) {
    console.error('KaTeX rendering error:', err);
  }

  return html;
}

// Update preview content with error handling
function updatePreview() {
  if (!editor || !currentMarkdownFile || !previewVisible) {
    return;
  }

  // Check if libraries are loaded (DOMPurify, KaTeX needed in main thread)
  if (typeof DOMPurify === 'undefined') {
    const previewContent = document.getElementById('markdown-preview-content');
    if (previewContent) {
      previewContent.innerHTML = '<div class="preview-loading">⚡ Loading markdown libraries...</div>';
    }
    // Libraries are still loading, preview will update when they're ready
    return;
  }

  try {
    const markdownContent = editor.getValue();

    // Handle empty content
    if (!markdownContent || markdownContent.trim() === '') {
      const previewContent = document.getElementById('markdown-preview-content');
      if (previewContent) {
        previewContent.innerHTML = '<div class="preview-empty">No content to preview</div>';
      }
      return;
    }

    // Use web worker for off-thread parsing (performance optimization)
    if (markdownWorker) {
      const previewContent = document.getElementById('markdown-preview-content');
      if (previewContent) {
        previewContent.innerHTML = '<div class="preview-loading">⚡ Rendering markdown...</div>';
      }

      // Send markdown to worker for parsing
      markdownWorker.postMessage({
        type: 'parse',
        content: markdownContent
      });

      // Listen for response (only once per render)
      markdownWorker.onmessage = (e) => {
        if (e.data.type === 'parsed' && e.data.success) {
          processWorkerResult(e.data.html);
        } else if (e.data.type === 'error') {
          showParseError(e.data.error);
        }
      };

      return;
    }

    // Fallback to main thread parsing if worker unavailable
    parseMarkdownMainThread(markdownContent);
  } catch (error) {
    console.error('Error updating preview:', error);
    showGeneralError(error.message);
  }
}

// Process markdown HTML from worker
function processWorkerResult(html) {
  try {
    // Render math equations with KaTeX (main thread only)
    html = renderMathInHtml(html);

    // Sanitize HTML with DOMPurify to prevent XSS
    let cleanHtml;
    try {
      cleanHtml = DOMPurify.sanitize(html, {
        ADD_TAGS: ['iframe'], // Allow iframes for embedded content
        ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling'],
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|file):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
      });
    } catch (sanitizeError) {
      console.error('DOMPurify sanitization error:', sanitizeError);
      // Fallback to using the html as-is if sanitization fails
      cleanHtml = html;
    }

    // Update preview content
    const previewContent = document.getElementById('markdown-preview-content');
    if (previewContent) {
      previewContent.innerHTML = cleanHtml;

      // Render mermaid diagrams
      renderMermaidDiagrams(previewContent);

      // Process task lists (add interactive behavior)
      processTaskLists(previewContent);

      // Add copy functionality to inline code
      addInlineCodeCopyButtons(previewContent);

      // Scroll sync
      syncScroll();
    }
  } catch (error) {
    console.error('Error processing worker result:', error);
    showGeneralError(error.message);
  }
}

// Fallback: Parse markdown on main thread (if worker unavailable)
function parseMarkdownMainThread(markdownContent) {
  try {
    // This only runs if worker failed to initialize
    console.warn('Using main thread parsing (worker unavailable)');

    if (typeof marked === 'undefined') {
      showParseError('Marked library not loaded');
      return;
    }

    const html = marked.parse(markdownContent);
    processWorkerResult(html); // Reuse the same processing logic
  } catch (error) {
    console.error('Main thread parse error:', error);
    showParseError(error.message);
  }
}

// Show parse error
function showParseError(errorMessage) {
  const previewContent = document.getElementById('markdown-preview-content');
  if (previewContent) {
    previewContent.innerHTML = `
      <div class="preview-error">
        <h3>Error parsing markdown</h3>
        <pre>${errorMessage}</pre>
      </div>
    `;
  }
}

// Show general error
function showGeneralError(errorMessage) {
  const previewContent = document.getElementById('markdown-preview-content');
  if (previewContent) {
    previewContent.innerHTML = `
      <div class="preview-error">
        <h3>Error rendering preview</h3>
        <pre>${errorMessage}</pre>
      </div>
    `;
  }
}

// Render mermaid diagrams
async function renderMermaidDiagrams(container) {
  const mermaidDivs = container.querySelectorAll('.mermaid-diagram');

  for (const div of mermaidDivs) {
    try {
      const code = div.textContent;
      const id = div.id;

      // Render with mermaid
      const { svg } = await mermaid.render(id + '-svg', code);
      div.innerHTML = svg;
      div.classList.add('mermaid-rendered');
    } catch (error) {
      console.error('Mermaid render error:', error);
      div.innerHTML = `<div class="mermaid-error">Error rendering diagram: ${error.message}</div>`;
    }
  }
}

// Process task lists for better UX
function processTaskLists(container) {
  const taskItems = container.querySelectorAll('.task-list-item');
  taskItems.forEach(item => {
    const checkbox = item.querySelector('input[type="checkbox"]');
    if (checkbox) {
      // Keep them disabled as they're just for preview
      checkbox.disabled = true;
    }
  });
}

// Add copy buttons to inline code (optional enhancement)
function addInlineCodeCopyButtons(container) {
  // This is optional - you could add small copy icons to inline code too
  // For now, we just have copy buttons on code blocks
}

// Copy code to clipboard (global function for onclick handler)
window.copyCodeToClipboard = function(button) {
  try {
    const codeBlock = button.closest('.code-block-wrapper').querySelector('code');
    const code = codeBlock.textContent;

    navigator.clipboard.writeText(code).then(() => {
      // Visual feedback
      const originalHTML = button.innerHTML;
      button.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.5 2l-7.5 7.5-3.5-3.5-1.5 1.5 5 5 9-9z"/>
        </svg>
      `;
      button.style.color = '#4CAF50';

      setTimeout(() => {
        button.innerHTML = originalHTML;
        button.style.color = '';
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy code:', err);
      alert('Failed to copy code to clipboard');
    });
  } catch (error) {
    console.error('Copy error:', error);
  }
};

// Sync scroll between editor and preview
function syncScroll() {
  if (!editor) return;

  try {
    // Get editor scroll position
    const editorScrollTop = editor.getScrollTop();
    const editorScrollHeight = editor.getScrollHeight();
    const editorContainerHeight = document.getElementById('editor-container')?.offsetHeight || 0;

    if (editorScrollHeight <= editorContainerHeight) return;

    // Calculate scroll percentage
    const scrollPercentage = editorScrollTop / (editorScrollHeight - editorContainerHeight);

    // Apply to preview
    const previewPanel = document.getElementById('markdown-preview-panel');
    const previewContent = document.getElementById('markdown-preview-content');

    if (!previewPanel || !previewContent) return;

    const previewScrollHeight = previewContent.scrollHeight;
    const previewHeight = previewPanel.offsetHeight;

    if (previewScrollHeight <= previewHeight) return;

    const previewScrollTop = scrollPercentage * (previewScrollHeight - previewHeight);
    previewPanel.scrollTop = previewScrollTop;
  } catch (error) {
    console.error('Scroll sync error:', error);
  }
}

// Debounce helper
function debouncePreview(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Listen to editor changes
const debouncedUpdate = debouncePreview(updatePreview, 300);

// Hook into Monaco editor changes
if (typeof window.addEventListener !== 'undefined') {
  window.addEventListener('editor-content-changed', debouncedUpdate);
}

// Export to HTML
async function exportToHTML() {
  if (!editor || !currentMarkdownFile) {
    alert('No markdown file is currently open');
    return;
  }

  try {
    const markdownContent = editor.getValue();
    const html = marked.parse(markdownContent);
    const cleanHtml = DOMPurify.sanitize(html);

    // Get filename for title
    const fileName = currentMarkdownFile.split('/').pop().replace(/\.(md|markdown)$/, '');

    // Create full HTML document with all styles and scripts
    const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 40px auto;
      padding: 0 20px;
      color: #e0e0e0;
      background-color: #1e1e1e;
    }

    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
      border-bottom: 1px solid #333;
      padding-bottom: 0.3em;
    }

    h1 { font-size: 2em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }

    a {
      color: #58a6ff;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    code {
      background: #2d2d2d;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 0.9em;
      color: #f0f0f0;
    }

    pre {
      background: #2d2d2d;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 16px 0;
    }

    pre code {
      background: none;
      padding: 0;
      font-size: 0.85em;
      line-height: 1.45;
    }

    blockquote {
      border-left: 4px solid #444;
      margin: 16px 0;
      padding-left: 16px;
      color: #999;
      font-style: italic;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
      overflow: hidden;
      border-radius: 6px;
    }

    th, td {
      border: 1px solid #444;
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background: #2d2d2d;
      font-weight: 600;
    }

    tr:nth-child(even) {
      background: #252525;
    }

    img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      margin: 16px 0;
    }

    hr {
      border: none;
      border-top: 2px solid #333;
      margin: 24px 0;
    }

    ul, ol {
      margin: 16px 0;
      padding-left: 2em;
    }

    li {
      margin: 8px 0;
    }

    .task-list-item {
      list-style: none;
      margin-left: -1.5em;
    }

    .task-list-item input[type="checkbox"] {
      margin-right: 8px;
    }

    .mermaid-diagram {
      text-align: center;
      margin: 20px 0;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'dark' });
  </script>
</head>
<body>
  ${cleanHtml}
</body>
</html>`;

    // Save to file
    const result = await window.api.saveFileAs(fullHTML);
    if (result) {
      alert('HTML exported successfully!');
    }
  } catch (error) {
    console.error('Export error:', error);
    alert('Failed to export HTML: ' + error.message);
  }
}

// Button click handlers - setup after DOM is ready
function setupButtonHandlers() {
  const previewBtn = document.getElementById('markdown-preview-btn');
  const exportHTMLBtn = document.getElementById('markdown-export-html');

  if (previewBtn) {
    previewBtn.addEventListener('click', togglePreview);
    console.log('Preview button handler attached');
  }

  if (exportHTMLBtn) {
    exportHTMLBtn.addEventListener('click', exportToHTML);
    console.log('Export HTML button handler attached');
  }
}

// Export functions
window.toggleMarkdownPreview = togglePreview;
window.exportMarkdownToHTML = exportToHTML;
window.updateMarkdownPreview = updatePreview;

// Initialize markdown preview system when DOM is ready
// Since script has defer attribute, DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMarkdownPreview);
} else {
  // DOM already loaded, initialize immediately
  initMarkdownPreview();
}
