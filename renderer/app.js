// App initialization and global event handlers

// Prevent default drag and drop behavior
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

// Handle window focus/blur for better performance
let isWindowFocused = true;

window.addEventListener('focus', () => {
  isWindowFocused = true;
  if (typeof editor !== 'undefined' && editor) {
    editor.focus();
  }
});

window.addEventListener('blur', () => {
  isWindowFocused = false;
});

console.log('Fast Editor initialized');
