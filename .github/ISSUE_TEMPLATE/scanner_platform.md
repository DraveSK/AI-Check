---
name: Scanner platform work
about: Propose or track scanner implementation work for a specific OS
title: "[Scanner] "
labels: scanner
---

**Platform**
- [ ] macOS
- [ ] Windows
- [ ] Linux

**Collector**
- [ ] Storage
- [ ] Security
- [ ] Performance
- [ ] Developer environment
- [ ] Crypto wallet detection

**Relevant spec section**
Link the exact table row in [docs/SCANNER_SPEC.md](../../docs/SCANNER_SPEC.md)
this work implements.

**Privacy check**
Confirm this collector only reads metadata, never file contents or secret
values, per [PRIVACY.md](../../PRIVACY.md). Describe exactly what is read.

**Testing plan**
How will this be verified across OS versions without needing access to
every possible machine configuration?
