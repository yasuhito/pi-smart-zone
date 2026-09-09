# pi-smart-zone

A Pi extension that presents absolute context usage relative to a configurable smart-zone boundary.

## Language

**Context usage**:
The estimated number of tokens currently occupying the active model context. When unavailable, it cannot be classified as inside or beyond the smart-zone boundary.
_Avoid_: Context size

**Context window**:
The configured maximum token capacity of the active model.
_Avoid_: Context size, context limit

**Smart-zone boundary**:
The configurable absolute context usage threshold at or beyond which model reasoning is treated as degraded. It is independent of the active model's context window.
_Avoid_: Context limit, context-window boundary

**Context usage presentation**:
The human-readable representation of context usage, context window, and smart-zone classification, whether shown persistently or requested explicitly.
_Avoid_: Context status, usage formatting

**Dumb zone**:
The state at or beyond the smart-zone boundary, where model reasoning is treated as degraded.
_Avoid_: Degraded zone, error zone

**Pi package gallery**:
The package discovery gallery at `pi.dev/packages`, populated from npm packages tagged with the `pi-package` keyword.
_Avoid_: pi extensions listing, extension registry
