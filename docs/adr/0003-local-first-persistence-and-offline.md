# ADR 0003: Local-First Persistence and Offline Operation

Date: 2026-07-12
Status: Accepted

## Context

Accounts are not required, core gameplay must work offline after first load, and no confirmed mechanic needs a server. Save state is too structured for an unversioned localStorage blob.

## Decision

Use versioned IndexedDB saves with validation, atomic staging/current/backup records, explicit migrations, and recoverable normalization of runtime agents. Use a versioned service worker for the same-origin application shell and a safe save-and-reload update prompt. Do not add a gameplay backend, cloud save, login, analytics, or telemetry for 1.0.

## Consequences

- Saves are bound to the browser profile unless a later manual export is approved.
- Private mode, quota pressure, user-cleared site data, and browser eviction require clear failure/help UI.
- Cache and save versions are separate; worker activation never clears saves.
- Rollback must account for newer save versions and may require a repaired forward build.
- Offline, interrupted-save, corruption, migration, and update tests are release gates.

## Amendment (2026-10-17)

The implemented save sequence differs from the "atomic staging/current/backup records" in the decision above. There is no staging record: each save runs in one IndexedDB read-write transaction that copies the current `active` envelope to `backup` (when its version and checksum are valid) and then writes the new envelope to `active`. Atomicity comes from the single transaction rather than from a staged write and read-back. Loading tries `active`, then `backup`, then starts a new centre. The save layers, their version history and the persistence invariants are documented in [SAVE_FORMAT.md](../SAVE_FORMAT.md).
