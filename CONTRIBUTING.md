# 🤝 Contributing to SPM

First off, thanks for considering contributing to SPM (Sistema de Solicitudes de Materiales)! It's people like you that make SPM such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title**
* **Describe the exact steps which reproduce the problem** in as many details as possible
* **Provide specific examples to demonstrate the steps**
* **Describe the behavior you observed after following the steps**
* **Explain which behavior you expected to see instead and why**
* **Include screenshots and animated GIFs if possible**
* **Include your environment details** (OS, Python version, Node version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title**
* **Provide a step-by-step description of the suggested enhancement**
* **Provide specific examples to demonstrate the steps**
* **Describe the current behavior** and **the expected behavior**
* **Include mockups/wireframes for UI changes if applicable**

### Pull Requests

* Fill in the required template
* Follow the Python and JavaScript style guides (see below)
* End all files with a newline
* Avoid platform-dependent code
* Document new code
* Add tests for new functionality

## Development Setup

### Prerequisites
- Python 3.11 or higher
- Node.js 18 or higher
- Git

### Local Development

1. **Fork and Clone the Repository**
```bash
git clone https://github.com/YOUR_USERNAME/SPMv1.0.git
cd SPMv1.0
```

2. **Create Virtual Environment (Python)**
```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/macOS
source .venv/bin/activate
```

3. **Install Python Dependencies**
```bash
pip install -r requirements-dev.txt
```

4. **Install Node Dependencies**
```bash
npm install
```

5. **Create Environment File**
```bash
cp .env.example .env.local
# Edit .env.local with your settings
```

6. **Run Backend**
```bash
python src/backend/app.py
# Backend runs on http://localhost:5000
```

7. **Run Frontend (in another terminal)**
```bash
npm run dev
# Frontend runs on http://localhost:5173
```

8. **Run Tests**
```bash
# Python tests
pytest

# JavaScript tests
npm test
```

## Style Guides

### Python Style Guide

We follow [PEP 8](https://www.python.org/dev/peps/pep-0008/) with some modifications:

* Line length: 100 characters (configured in `pyproject.toml`)
* Use type hints for function signatures
* Document functions and classes with docstrings
* Use `black` for formatting
* Use `ruff` for linting

**Format code before committing:**
```bash
black .
ruff check . --fix
```

### JavaScript Style Guide

* Use ES6+ features
* Use 4 spaces for indentation (configured in `.editorconfig`)
* Use meaningful variable names
* Document complex logic with comments
* Use `prettier` for formatting
* Use `eslint` for linting (when configured)

**Format code before committing:**
```bash
npm run format
npm run lint
```

## Commit Messages

* Use the present tense ("add feature" not "added feature")
* Use the imperative mood ("move cursor to..." not "moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line
* Follow the format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat(api): add material status endpoint

Implement new endpoint to get all material statuses.
Includes pagination and filtering support.

Fixes #123
```

## Testing

* Write tests for new code
* Keep test names descriptive
* Test both happy path and edge cases
* Maintain test coverage above 80%

```bash
# Run with coverage
pytest --cov=src/backend tests/
```

## Documentation

* Update README.md if you change API or features
* Add docstrings to new functions/classes
* Update relevant documentation files in `docs/`
* Include examples for new features

## Questions?

* Check existing issues and documentation
* Create an issue with the `question` label
* Contact maintainers directly

## Recognition

Contributors will be recognized in:
* GitHub contributors list
* Release notes for major contributions
* Project README (for significant contributions)

Thank you for contributing! 🎉
