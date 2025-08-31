# Polyglot Mirroring

A5 is developed using a technique called **Polyglot Mirroring** - maintaining functionally equivalent implementations across multiple programming languages with automated synchronization of changes using LLMs.

## Philosophy

**Polyglot mirroring** embodies the principle that **the choice of programming language should not limit access to functionality**. By treating all language implementations as equals, developers can use their preferred language without compromising on features or stability. It also means that contributions to the project can come from any language, with the mirroring to the other languages being automated.

## How it works

3 versions of the codebase: [TypeScript](https://github.com/felixpalmer/a5), [Python](https://github.com/felixpalmer/a5-py) & [Rust](https://github.com/felixpalmer/a5-rs), are currently maintained. Every time a change is made in one, the change is propagated to the others using LLM tools.

Becuase all the mirror codebases share the same high-level structure (function names, variables etc), LLM tools are very effective at adding new code or making changes as they have an example of a working implementation and an established set of patterns to match against.

import PolyglotDiagram from './polyglot-mirroring.png';

<img src={PolyglotDiagram} style={{width: "100%", maxWidth: "400px"}}/>

## Benefits

- **Consistent user experience** - all mirrors have same familiar API
- **Inclusive ecosystem** - contributions can come from any language
- **Faster feature propagation** - improvements reach all users quickly
- **Reduced maintenance burden** - changes don't need to be manually ported
- **Code quality** - mirror implementations can reveal bugs/precision issues that might otherwise be missed

## Why not use bindings?

A traditional approach would be to use bindings, to bind the high level API written in one language to invoke the function implementation in another. There are several downsides to using bindings:

- Performance overhead and API limitations
- Core functionality is a "black box", making it much harder for developers to contribute to the project
- Harder to debug crashes/bugs
- Larger code footprint, by bundling a built binary

## Implementation tips

The **Polyglot Mirroring** technique relies on using LLMs to keep multiple mirrors of a codebase in sync. In order to be effective, the code needs to be organized such that the LLM can work with it effectively. Many of these are already accepted as good programming practices.

### Granular unit tests

- The code base needs to have small, well-tested functions with clear inputs and outputs
- Tests should be driven by external fixtures (e.g. JSON files) so the inputs & outputs can be easily moved between codebases

### Minimal dependencies

- The codebase should not have any large external dependencies, as this will create friction with the ports
- An exception is if the dependencies are also available in all the mirror langauges

### Clear source file hierarchy

- Circular imports are not allowed (many languages do not support them)
- A [helper script](https://github.com/felixpalmer/a5/blob/main/analyze_imports.py) is used to extract a porting order, so the LLM knows where best to start

### Specification for LLMs

A5 uses [Claude Code](https://www.anthropic.com/claude-code) tool to perform the mirroring of the codebases. The spec:

- Explains the concept of **Polyglot Mirroring** and the goal of keeping all codebases in sync
- Gives the locations of all the mirrors so the tool knows where to find the code
- Lists how each codebase can be built, tested, linted and formatted using command line tools. This enables the tool to iterate until it has a working solution.

A new change can then be mirrored either by asking the tool to check to see what has changed, or by referencing a pull request or git commit.
