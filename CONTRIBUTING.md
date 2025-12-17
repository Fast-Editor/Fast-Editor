# Contributing to Fast Editor

Thank you for your interest in contributing to Fast Editor! We welcome contributions from everyone.

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ and npm
- Git
- Basic knowledge of Electron and JavaScript

### Setting Up Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/fast-editor.git
   cd fast-editor
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/fast-editor.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Start in development mode**:
   ```bash
   npm run dev
   ```

## 🔧 Development Workflow

### Making Changes

1. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-number-description
   ```

2. **Make your changes** following our coding standards

3. **Test your changes** thoroughly:
   - Test the feature/fix manually
   - Ensure no existing features are broken
   - Test on different file types if applicable

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Add: brief description of your changes"
   ```

   Commit message format:
   - `Add: ...` for new features
   - `Fix: ...` for bug fixes
   - `Update: ...` for improvements to existing features
   - `Refactor: ...` for code refactoring
   - `Docs: ...` for documentation changes

5. **Keep your branch updated**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request** on GitHub

## 📝 Code Style Guidelines

### JavaScript Style

- Use **2 spaces** for indentation
- Use **semicolons** consistently
- Use **camelCase** for variables and functions
- Use **PascalCase** for classes
- Use **UPPER_SNAKE_CASE** for constants
- Add **JSDoc comments** for functions:
  ```javascript
  /**
   * Brief description of function
   * @param {string} filePath - Description of parameter
   * @returns {Promise<Object>} Description of return value
   */
  async function myFunction(filePath) {
    // Implementation
  }
  ```

### File Organization

- **Main Process**: Add IPC handlers to `main.js`
- **Renderer Process**: Create new files in `renderer/` directory
- **Shared Constants**: Define at the top of files
- **Helper Functions**: Group related functions together

### Naming Conventions

- **Files**: Use kebab-case (e.g., `git-integration.js`)
- **Functions**: Use descriptive names (e.g., `loadFileTree`, not `load`)
- **Variables**: Use meaningful names (e.g., `currentFilePath`, not `path`)
- **Event Handlers**: Prefix with `on` or `handle` (e.g., `onFileClick`)

## 🏗️ Architecture Guidelines

### IPC Communication

When adding features that require main-renderer communication:

1. **Add handler in main.js**:
   ```javascript
   ipcMain.handle('my-feature', async (event, arg1, arg2) => {
     // Implementation
     return result;
   });
   ```

2. **Add API in preload.js**:
   ```javascript
   myFeature: (arg1, arg2) => ipcRenderer.invoke('my-feature', arg1, arg2)
   ```

3. **Use in renderer**:
   ```javascript
   const result = await window.api.myFeature(arg1, arg2);
   ```

### Performance Considerations

- Use **async/await** for I/O operations
- **Debounce** frequent events (e.g., input, scroll)
- **Cache** expensive computations
- Use **Web Workers** for CPU-intensive tasks
- Implement **virtual scrolling** for large lists
- Batch operations when possible

See [docs/PERFORMANCE_OPTIMIZATIONS.md](./docs/PERFORMANCE_OPTIMIZATIONS.md) for detailed guidelines.

### Error Handling

Always handle errors gracefully:

```javascript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  console.error('Error in operation:', error);
  showNotification('Operation failed: ' + error.message);
  return null;
}
```

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Description**: Clear description of the bug
2. **Steps to Reproduce**: Detailed steps to reproduce
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**:
   - OS and version
   - Fast Editor version
   - Node.js version
6. **Screenshots/Logs**: If applicable
7. **Minimal Reproduction**: Simplest way to reproduce

### Bug Report Template

```markdown
## Description
Brief description of the bug

## Steps to Reproduce
1. Open file X
2. Click on Y
3. See error

## Expected Behavior
Should do X

## Actual Behavior
Does Y instead

## Environment
- OS: macOS 14.0
- Fast Editor: 1.0.0
- Node.js: 18.0.0

## Additional Context
Any additional information
```

## 💡 Feature Requests

When suggesting features, please include:

1. **Use Case**: Why is this feature needed?
2. **Proposed Solution**: How should it work?
3. **Alternatives**: What alternatives have you considered?
4. **Additional Context**: Mockups, examples, etc.

### Feature Request Template

```markdown
## Feature Description
Clear description of the proposed feature

## Use Case
Why is this feature valuable?

## Proposed Solution
How should this work?

## Alternatives Considered
What other approaches did you consider?

## Additional Context
Mockups, examples, or references
```

## 🧪 Testing

### Manual Testing Checklist

Before submitting a PR, test:

- [ ] Feature works as expected
- [ ] No console errors
- [ ] No visual regressions
- [ ] Works with different file types
- [ ] Works in different screen sizes
- [ ] Keyboard shortcuts work
- [ ] Doesn't break existing features

### Testing Git Features

- Test with real git repositories
- Test edge cases (empty repos, merge conflicts, etc.)
- Verify error messages are clear

### Testing LSP Features

- Test with multiple languages
- Test with large files
- Verify completions work correctly

## 📚 Documentation

When adding features, update:

- **README.md**: Add feature description
- **Code Comments**: Explain complex logic
- **JSDoc**: Document public APIs
- **docs/PERFORMANCE_OPTIMIZATIONS.md**: If performance-related

## 🔍 Code Review Process

### What Reviewers Look For

- Code quality and readability
- Performance implications
- Security considerations
- Proper error handling
- Consistency with existing code
- Test coverage
- Documentation updates

### Review Checklist

- [ ] Code follows style guidelines
- [ ] No console.log left in production code
- [ ] Error handling is appropriate
- [ ] Performance is considered
- [ ] Documentation is updated
- [ ] Commit messages are clear

## 🎯 Areas for Contribution

### Good First Issues

- Documentation improvements
- UI/UX enhancements
- Bug fixes
- Adding keyboard shortcuts
- Improving error messages

### Advanced Contributions

- LSP features
- Git integration enhancements
- Performance optimizations
- Web Worker implementations
- New language support

### High Priority

- Extension/plugin system
- Debugging integration
- Remote development support
- Symbol indexing
- AI features

See our [Roadmap](./README.md#-roadmap) for more ideas.

## 📞 Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open a GitHub Issue
- **Chat**: Join our community (link TBD)
- **Security**: Email security@fasteditor.dev (do not open public issues)

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Our website (coming soon)

Thank you for making Fast Editor better!

---

**Questions?** Feel free to ask in GitHub Discussions or open an issue.
