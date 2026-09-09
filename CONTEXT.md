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

**Pi package gallery**:
The package discovery gallery at `pi.dev/packages`, populated from npm packages tagged with the `pi-package` keyword.
_Avoid_: pi extensions listing, extension registry
