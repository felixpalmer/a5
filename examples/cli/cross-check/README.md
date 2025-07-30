# A5 Cross-Check CLI

This CLI tool generates A5 cells using both the TypeScript and Python implementations and compares the results to ensure consistency between the two versions.

## Usage

```bash
./test.sh
```

## What it does

1. **TypeScript Generation**: Generates all A5 cells at the specified resolution using the TypeScript implementation
2. **Python Generation**: Runs the equivalent Python script to generate cells using the Python implementation
3. **Comparison**: Compares the two outputs, accounting for minor floating-point differences
4. **Output**: Disaplys any differences

## Comparison Logic

The tool normalizes floating-point numbers to 12 decimal places to account for expected differences between JavaScript and Python floating-point arithmetic. It compares:

- Feature count
- Cell IDs (hex strings)
- Coordinate arrays
- Overall structure