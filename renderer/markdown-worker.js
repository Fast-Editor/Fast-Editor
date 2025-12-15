// Markdown Worker - Parses markdown off the main thread
// This prevents UI freezes when rendering large markdown files

// Prevent AMD module loading issues
self.define = undefined;

let librariesLoaded = false;

// Listen for messages from main thread
self.addEventListener('message', async (e) => {
  const { type, content, options } = e.data;

  if (type === 'parse') {
    try {
      // Load libraries if not already loaded
      if (!librariesLoaded) {
        await loadLibraries();
      }

      // Parse markdown
      const html = marked.parse(content, options || {});

      // Send result back to main thread
      self.postMessage({
        type: 'parsed',
        html: html,
        success: true
      });
    } catch (error) {
      // Send error back to main thread
      self.postMessage({
        type: 'error',
        error: error.message,
        success: false
      });
    }
  }
});

// Load markdown libraries in worker context
async function loadLibraries() {
  try {
    // Prevent AMD module detection
    if (typeof define !== 'undefined') {
      self.define = undefined;
    }

    // Import marked and highlight.js
    importScripts(
      'https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js'
    );

    // Configure marked
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true,
        gfm: true,
        pedantic: false,
        sanitize: false, // DOMPurify will handle this in main thread
        smartLists: true,
        smartypants: true,
        xhtml: false,
        highlight: function(code, lang) {
          // Use highlight.js for syntax highlighting
          if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, { language: lang }).value;
            } catch (err) {
              console.error('Highlight error:', err);
            }
          }
          return code;
        }
      });

      librariesLoaded = true;
      console.log('✅ Markdown worker libraries loaded');
    } else {
      throw new Error('Failed to load marked library');
    }
  } catch (error) {
    console.error('Failed to load markdown libraries in worker:', error);
    throw error;
  }
}
