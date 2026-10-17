# Coding Style and Standards

This document defines the naming conventions and coding patterns for this project. For commit conventions, see COMMIT_STYLE.md.

---

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Packages / modules | `lowercase_snake_case`, short, no underscores if avoidable | `helpers.py`, `data_loader.py` |
| Classes | `PascalCase` | `UserRepository`, `TrainingConfig` |
| Functions / methods | `snake_case`, verb-first | `load_data()`, `normalize_email()` |
| Variables | `snake_case`, descriptive over short (except loop counters/idioms: `i`, `df`, `x`) | `retry_count`, `is_active` |
| Constants | `UPPER_SNAKE_CASE`, module-level | `MAX_RETRIES = 3` |
| Private members | leading underscore | `_internal_cache` |
| "Magic"/dunder overrides | only implement what's needed; always `__repr__`/`__str__` over legacy equivalents | — |
| Booleans | prefix with `is_`, `has_`, `should_` | `is_valid`, `has_permission` |
| Type variables | single uppercase letter or `PascalCase` + `T` suffix | `T`, `ResultT` |

- Avoid abbreviations unless they're domain-standard (`df` for DataFrame, `cfg` for config are fine; `usr`, `cnt` are not).
- Name things for what they *are*, not how they're implemented (`users`, not `user_list_from_db`).

---

## Project Structure

- Prefer a `src/` layout for installable packages: `src/{package_name}/`, with tests outside it at the repo root.
- One clear entry point per deliverable (`__main__.py`, `cli.py`, `main.py`) — avoid scattering runnable scripts.
- Tests live in `tests/`, mirroring the source tree (`tests/api/`, `tests/models/`, etc. matching `src/api/`, `src/models/`).
- Shared/reusable test fixtures and factories live in a root `conftest.py` or `tests/factories/`; component-specific ones live alongside the component's tests.
- Notebooks (if used) live in `notebooks/`, are treated as exploratory/disposable, and are never imported into production code — extract reusable logic into `src/` modules instead.
- Keep configuration (settings, constants, paths) centralized rather than duplicated across modules.

---

## Environment Variables & Configuration

- Env var names: `UPPERCASE_SNAKE_CASE`, grouped by common prefix where it aids scanning (`DB_`, `AWS_`, `REDIS_`).
- Access env vars through a single centralized accessor/config object, never scattered `os.environ` / `os.getenv` calls throughout the codebase.
- Missing required configuration should fail loudly and early (raise on startup), not silently default.
- Secrets are never hardcoded or committed — use `.env` files (git-ignored) or a secrets manager, and keep an `.env.example` documenting required keys.

---

## Testing Conventions

| Element | Convention | Example |
|---|---|---|
| Test files | `test_{what}.py` | `test_data_loader.py` |
| Test classes (if used) | `Test{What}` | `TestDataLoader` |
| Test functions | `test_{behavior_being_verified}` | `test_normalize_email_lowercases_input` |
| Factories | `PascalCase` + `Factory` | `UserFactory` |

- Prefer plain `pytest` functions over test classes unless grouping genuinely aids readability.
- One logical assertion focus per test.
- Treat warnings as errors in test config for further investigation; never suppress warnings to make tests pass.

---

## Code Formatting & Linting

| Setting | Default |
|---|---|
| Formatter / linter | `ruff` (format + check) |
| Type checker | `mypy` (or `pyright` if the project already uses it — don't mix) |
| Test runner | `pytest` |
| Quote style | Double quotes |
| Import order | stdlib → third-party → first-party, enforced via `ruff`'s isort rules |

- Run `ruff check --fix .` and `ruff format .` before considering work done.
- Run `mypy` (or the project's configured type checker) and resolve new errors introduced by your changes.
- These formatting rules (line length, quote style, etc.) apply to source code only. Markdown files and prose are exempt — let paragraphs flow naturally, don't hard-wrap them.

---

## Docstrings

Use **Google-style** docstrings on all modules, classes, and functions.

```python
def normalize_email(email: str) -> str:
    """Lowercase and strip whitespace from an email address.

    Args:
        email: Raw email address as provided by the user.

    Returns:
        The normalized email address.

    Raises:
        ValueError: If the input is not a valid email format.
    """
```

- Document *why*, not just *what*, when the reasoning isn't obvious from the code itself.

---

## Error Handling

- Never use a bare `Exception` or `except:` — catch the specific exception type(s) expected.
- Never swallow exceptions silently — log or re-raise.

---

## General Principles

- Favor readability over cleverness; a slightly longer, obvious implementation beats a dense one-liner.
- Keep functions focused — if a function needs a "and" to describe what it does, consider splitting it.