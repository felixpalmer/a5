# Polyglot Mirroring

A5 is developed using a **polyglot mirroring** - maintaining functionally equivalent implementations across multiple programming languages with automated synchronization of changes using LLMs.

## The A5 Ecosystem

The A5 project maintains three parallel implementations:

- [**a5**](https://github.com/felixpalmer/a5) - TypeScript/JavaScript (npm)
- [**a5-py**](https://github.com/felixpalmer/a5-py) - Python (PyPI) 
- [**a5-rs**](https://github.com/felixpalmer/a5-rs) - Rust (crates.io)

While the TypeScript version was written manually, the Python and Rust implementations were initially ported using Large Language Models (LLMs). Going forward, all three languages are treated as equal citizens in the ecosystem.

## How It Works

When a bugfix, feature, or improvement is contributed to any implementation:

1. **Changes are identified** in the source language
2. **LLMs translate** the changes to the other languages, preserving:
   - Functional behavior
   - API consistency
   - Language-specific idioms and patterns
3. **All implementations** are updated to maintain feature parity

This approach ensures that users of any language binding get the same functionality and benefit from improvements regardless of which implementation they originated from.

## Benefits

- **Consistent user experience** across all supported languages
- **Faster feature propagation** - improvements reach all users quickly
- **Reduced maintenance burden** - changes don't need to be manually ported
- **Language equality** - no "second-class citizen" implementations

## Challenges

- **API design complexity** - ensuring changes work idiomatically across languages
- **Testing synchronization** - maintaining equivalent test coverage
- **Version coordination** - keeping releases aligned across repositories
- **Quality assurance** - verifying automated translations preserve correctness

## Philosophy

Polyglot mirroring embodies the principle that **the choice of programming language should not limit access to functionality**. By treating all language implementations as equals, A5 ensures that developers can use their preferred language without compromising on features or stability.

This approach leverages modern AI tooling to make multi-language library maintenance practical and sustainable, enabling broader adoption while maintaining high quality standards across all implementations.