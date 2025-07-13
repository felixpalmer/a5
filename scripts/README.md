# Projection Test Generator

This directory contains a generic test generator for projection classes that can be used to create comprehensive test data for any projection that implements the `forward` and `inverse` methods.

## Directory Structure

```
scripts/
├── generate-fixtures.cjs             # Unified fixture generator
└── fixtures/
    ├── projection-generator.cjs      # Generic projection test generator
    └── projections/
        ├── gnomonic.cjs              # Gnomonic projection generator
        └── authalic.cjs              # Authalic projection generator

tests/projections/
└── fixtures/
    ├── gnomonic.json                 # Generated test data
    └── authalic.json                 # Generated test data
```

## Generic Test Generator

The `fixtures/projection-generator.cjs` file provides a reusable framework for generating test data for projection classes. It handles:

- Generating random test inputs
- Including specific test cases
- Creating forward and inverse test data
- Updating existing test data when implementations change

## Usage

### Generate All Fixtures
```bash
yarn generate-fixtures
```