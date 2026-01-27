---
name: modern-python
description: Apply Trail of Bits “modern python” conventions (uv, ruff, ty, pytest, prek, pyproject.toml-first). Use when editing/adding Python code in this repo or when the user asks to modernize Python tooling. Avoid reformatting vendored Python under lib/** unless explicitly requested.
---

# Modern Python (Trail of Bits style)

Based on the Trail of Bits `modern-python` plugin patterns (uv + ruff + ty + pytest + prek) described in their README: `https://raw.githubusercontent.com/trailofbits/skills/main/plugins/modern-python/README.md`.

## Scope rules for this repo

- **Do apply** to first-party Python files (project code, scripts, tooling).
- **Do NOT apply** to vendored/third-party Python under `lib/**` (and other vendor dirs like `node_modules/**`) unless the user explicitly asks. If asked, keep changes minimal and avoid sweeping formatting.

## Defaults (recommended)

- **Python**: require **3.11+**
- **Dependency management**: `uv` (`uv sync`, `uv add`, `uv run`)
- **Lint/format**: `ruff` (format + lint)
- **Type checking**: `ty` (fast type checker) if acceptable; otherwise `mypy`/`pyright` only if user asks
- **Tests**: `pytest` (+ coverage gate if project is test-heavy)
- **Hooks**: `prek` (or `pre-commit` if already in use)
- **Config**: prefer `pyproject.toml` as the single source of truth

## Command translation (legacy → modern)

- `python …` → `uv run python …` (or `uv run …` for scripts)
- `pip install X` → `uv add X` (project dep) or `uv run --with X …` (one-off)
- `pip uninstall X` → `uv remove X`
- `pip freeze` → `uv export`

## When creating or modernizing a Python package

1. **Detect existing tooling**: check for `pyproject.toml`, `requirements*.txt`, `setup.cfg`, `tox.ini`, `.pre-commit-config.yaml` and decide whether to migrate or keep compatible.
2. **Add/standardize `pyproject.toml`**:
   - add tool configs for ruff (format + lint) and pytest
   - keep settings minimal and consistent (no redundant formatters)
3. **Use `src/` layout** for importable packages when appropriate.
4. **Add CI hooks only when requested** (don’t spam checks).

## When reviewing Python changes

- Prefer **small diffs**: functional changes separate from formatting/tooling changes.
- If introducing new tools, ensure they’re runnable with simple commands (`uv run …`, `uv sync`).
- Avoid pinning excessive versions unless the repo already pins; keep constraints compatible.

