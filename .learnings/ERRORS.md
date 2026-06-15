# Errors

Command failures and integration errors.

---

## [ERR-20260615-001] shell glob expansion blocked search

**Logged**: 2026-06-15T00:00:00+08:00
**Priority**: low
**Status**: pending
**Area**: tooling

### Summary
`zsh` can fail `rg` commands before execution when an unquoted glob has no matches.

### Details
The command `rg -n "..." src tailwind.config.* app -S` failed with `zsh: no matches found: tailwind.config.*` because the shell expanded the glob before `rg` ran.

### Suggested Action
Quote optional globs or search fixed directories/files separately when running shell commands under `zsh`.

### Metadata
- Source: error
- Tags: shell, zsh, rg
