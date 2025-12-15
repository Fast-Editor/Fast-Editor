// Terminal State - Multiple terminal support
let terminals = new Map(); // Map of terminalId -> { term, fitAddon, backendId, name }
let activeTerminalId = null;
let terminalCounter = 0;

// Initialize first terminal when panel opens
async function initTerminalPanel() {
  const container = document.getElementById('terminal-container');
  if (container.classList.contains('hidden')) {
    container.classList.remove('hidden');
  }

  // Create first terminal if none exist
  if (terminals.size === 0) {
    await createNewTerminal();
  }
}

// Create a new terminal instance
async function createNewTerminal() {
  try {
    // Check if xterm is loaded
    if (!window.Terminal) {
      console.error('Xterm not loaded');
      return null;
    }

    terminalCounter++;
    const terminalId = `term-${Date.now()}-${terminalCounter}`;
    const terminalName = `Terminal ${terminalCounter}`;

    // Create terminal instance
    const term = new window.Terminal({
      fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#cccccc',
        cursorAccent: '#1e1e1e',
        selection: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff'
      },
      cursorBlink: true,
      cursorStyle: 'block',
      // Performance: Limit scrollback to prevent memory issues (Phase 3)
      scrollback: 1000, // Reduced from 10000 to 1000 lines
      fastScrollModifier: 'shift'
    });

    // Add fit addon
    let fitAddon = null;
    if (window.FitAddon) {
      fitAddon = new window.FitAddon.FitAddon();
      term.loadAddon(fitAddon);
    }

    // Add web links support
    if (window.WebLinksAddon) {
      term.loadAddon(new window.WebLinksAddon.WebLinksAddon());
    }

    // Create DOM element for this terminal
    const terminalElement = document.createElement('div');
    terminalElement.className = 'terminal-instance';
    terminalElement.id = terminalId;
    document.getElementById('terminal-content').appendChild(terminalElement);

    // Open terminal in DOM
    term.open(terminalElement);

    // Show loading message while backend terminal is being created
    term.write('\r\n\x1b[36m⚡ Starting terminal...\x1b[0m\r\n');

    // Store terminal info early (without backendId yet)
    terminals.set(terminalId, {
      term,
      fitAddon,
      backendId: null, // Will be set once backend is ready
      name: terminalName
    });

    // Render tabs immediately (responsive UI)
    renderTerminalTabs();

    // Switch to this terminal immediately
    switchToTerminal(terminalId);

    // Fit terminal immediately
    setTimeout(() => {
      if (fitAddon) {
        fitAddon.fit();
      }
      term.focus();
    }, 10);

    // Create backend terminal asynchronously (non-blocking)
    window.api.createTerminal().then(backendId => {
      if (!backendId) {
        term.write('\r\n\x1b[31mError: Failed to create terminal\x1b[0m\r\n');
        console.error('Failed to create terminal - backendId is null');
        return;
      }

      console.log('Terminal created with ID:', terminalId, 'Backend ID:', backendId);

      // Update terminal info with backendId
      const terminalInfo = terminals.get(terminalId);
      if (terminalInfo) {
        terminalInfo.backendId = backendId;
      }

      // Clear loading message
      term.write('\r\x1b[K'); // Clear current line

      // Set up event listeners now that backend is ready
      setupTerminalListeners(terminalId, term, backendId);
    }).catch(error => {
      console.error('Error creating backend terminal:', error);
      term.write('\r\n\x1b[31mError: ' + error.message + '\x1b[0m\r\n');
    });

    return terminalId;
  } catch (error) {
    console.error('Error creating terminal:', error);
    return null;
  }
}

// Setup terminal event listeners (called after backend is ready)
function setupTerminalListeners(terminalId, term, backendId) {
  const terminalInfo = terminals.get(terminalId);
  if (!terminalInfo) return;

  // Send input to backend
  term.onData((data) => {
    // Only send if backend is ready
    if (backendId) {
      window.api.terminalWrite(backendId, data);
    }
  });

  // Handle terminal resize
  term.onResize(({ cols, rows }) => {
    window.api.terminalResize(backendId, cols, rows);
  });
}

// Switch to a specific terminal
function switchToTerminal(terminalId) {
  const terminalInfo = terminals.get(terminalId);
  if (!terminalInfo) return;

  activeTerminalId = terminalId;

  // Update UI
  terminals.forEach((info, id) => {
    const element = document.getElementById(id);
    if (element) {
      if (id === terminalId) {
        element.classList.add('active');
      } else {
        element.classList.remove('active');
      }
    }
  });

  // Refit and focus active terminal
  if (terminalInfo.fitAddon) {
    setTimeout(() => {
      terminalInfo.fitAddon.fit();
    }, 10);
  }
  terminalInfo.term.focus();

  renderTerminalTabs();
}

// Close a specific terminal
async function closeTerminal(terminalId) {
  const terminalInfo = terminals.get(terminalId);
  if (!terminalInfo) return;

  // Kill backend process
  if (terminalInfo.backendId) {
    await window.api.terminalKill(terminalInfo.backendId);
  }

  // Dispose terminal
  if (terminalInfo.term) {
    terminalInfo.term.dispose();
  }

  // Remove DOM element
  const element = document.getElementById(terminalId);
  if (element) {
    element.remove();
  }

  // Remove from map
  terminals.delete(terminalId);

  // If this was active, switch to another terminal
  if (activeTerminalId === terminalId) {
    const remainingTerminals = Array.from(terminals.keys());
    if (remainingTerminals.length > 0) {
      switchToTerminal(remainingTerminals[0]);
    } else {
      activeTerminalId = null;
      // Hide terminal panel if no terminals left
      closeTerminalPanel();
    }
  }

  renderTerminalTabs();
}

// Close the entire terminal panel
function closeTerminalPanel() {
  const container = document.getElementById('terminal-container');
  container.classList.add('hidden');

  // Return focus to editor
  if (editor) {
    editor.focus();
  }
}

// Toggle terminal panel visibility
function toggleTerminal() {
  const container = document.getElementById('terminal-container');
  const isHidden = container.classList.contains('hidden');

  if (isHidden) {
    initTerminalPanel();
  } else {
    closeTerminalPanel();
  }
}

// Render terminal tabs
function renderTerminalTabs() {
  const tabsContainer = document.getElementById('terminal-tabs');
  tabsContainer.innerHTML = '';

  terminals.forEach((info, id) => {
    const tab = document.createElement('div');
    tab.className = 'terminal-tab';
    if (id === activeTerminalId) {
      tab.classList.add('active');
    }

    tab.innerHTML = `
      <span class="terminal-tab-name">${info.name}</span>
      <button class="terminal-tab-close" data-terminal-id="${id}">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M7.99998 8.70708L11.6464 12.3535L12.3535 11.6464L8.70708 7.99998L12.3535 4.35353L11.6464 3.64642L7.99998 7.29287L4.35353 3.64642L3.64642 4.35353L7.29287 7.99998L3.64642 11.6464L4.35353 12.3535L7.99998 8.70708Z" fill="currentColor"/>
        </svg>
      </button>
    `;

    // Click to switch
    tab.addEventListener('click', (e) => {
      // Check if click is on close button or its children (SVG)
      if (!e.target.closest('.terminal-tab-close')) {
        switchToTerminal(id);
      }
    });

    // Close button
    const closeBtn = tab.querySelector('.terminal-tab-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTerminal(id);
    });

    tabsContainer.appendChild(tab);
  });
}

// Handle terminal data from backend - register once
window.api.onTerminalData((backendId, data) => {
  // Find which terminal this data belongs to
  terminals.forEach((info) => {
    if (info.backendId === backendId && info.term) {
      info.term.write(data);
    }
  });
});

// Handle terminal exit from backend
window.api.onTerminalExit((backendId) => {
  // Find which terminal exited
  terminals.forEach((info, id) => {
    if (info.backendId === backendId) {
      if (info.term) {
        info.term.write('\r\n\x1b[31mTerminal process exited\x1b[0m\r\n');
      }
      // Optionally auto-close the terminal
      // setTimeout(() => closeTerminal(id), 2000);
    }
  });
});

// Refit all terminals on window resize
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (!document.getElementById('terminal-container').classList.contains('hidden')) {
      terminals.forEach((info) => {
        if (info.fitAddon) {
          info.fitAddon.fit();
        }
      });
    }
  }, 100);
});

// Event listeners
document.getElementById('toggle-terminal').addEventListener('click', toggleTerminal);
document.getElementById('new-terminal-btn').addEventListener('click', () => {
  createNewTerminal();
});
document.getElementById('close-terminal-panel').addEventListener('click', closeTerminalPanel);

window.api.onMenuToggleTerminal(() => toggleTerminal());

// Keyboard shortcut: Ctrl+` to toggle terminal
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === '`') {
    e.preventDefault();
    toggleTerminal();
  }
});
