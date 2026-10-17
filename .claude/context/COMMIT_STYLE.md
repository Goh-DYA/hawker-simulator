# Commit Style Guide

This document defines the commit message conventions used in this repository.

The goal is to produce commits that are:

* Easy to review & well documented
* Easy to revert
* Easy to navigate in history

---

## 1. Commit Structure

Every commit message must follow this strict syntax:
`[<scope>] <Short imperative description>`

If the commit introduces a breaking change, prepend `BREAKING:` to the description:
`[<scope>] BREAKING: <Short imperative description>`

### Structural Components

* **`[<scope>]`**: Enclosed in square brackets, specifying the exact structural area affected.
* **`<Description>`**: Imperative mood, sentence case, no trailing period.

Do not use line breaks for text within the same paragraph. There is no character-count line limit on
the description — write it as a normal sentence and let it flow; don't hard-wrap it.

---

## 2. Scope Rules (`[...]`)

The scope is **always required** and defines the precise boundary of the change.

### Scope Priority Hierarchy

1. **Single File (Preferred)**: Target the specific file for isolated atomic changes.
```text
[core/tools/search.py] Add domain allowlist enforcement
```

2. **Directory**: Target the directory when multiple related files within it change.
```text
[core/services/payment/] Add retry logic for failed charges
```

3. **Multiple Directories**: Use a comma-separated list for cross-cutting changes.
```text
[core/services/payment, webhooks] Handle async payment events
```

4. **Repo-wide**: Use `[repo]` strictly for top-level, global configurations or dependency bumps.
```text
[repo] Upgrade dependencies to Python 3.12
```

---

## 3. Core Philosophy: Atomic Commits

A commit is the fundamental unit of work. Every single commit must stand on its own.

* **Logical Cohesion**: A commit must represent exactly **one** logical change. Do not bundle unrelated fixes and features.
* **Revertability**: If `git revert` is run on the commit, the codebase must remain stable and functional.
* **Inline Tests**: Include tests within the same commit as the code changes they validate to maintain verification alongside implementation.
* **Size**: Keep commits small enough to be thoroughly reviewed in under 5 minutes.