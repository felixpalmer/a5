# Airbnb Density Comparison: A5 vs H3

This recipe demonstrates how to analyze Airbnb listing density across global cities using both A5 and H3 geospatial indices, revealing important differences in how these systems handle equal-area aggregation.

## Overview

We analyze [Inside Airbnb](https://insideairbnb.com/get-the-data/) listing data aggregated using both A5 and H3 indices to compare density metrics across ~120 global cities. The analysis reveals a fundamental difference: **A5's equal-area cells provide consistent density rankings**, while **H3's variable cell areas introduce systematic latitude-dependent bias**.

## A5: Equal-Area Consistency

With A5, all cells at a given resolution have the same area (~0.13 km² at resolution 14). This means that rankings by "listings per cell" and "listings per km²" are **identical** — both metrics represent the same thing.

import SingleA5 from 'website-examples/airbnb-density/single-a5';

<div style={{margin: '20px 0'}}>
  <SingleA5 />
</div>

**Notice:** All the lines are black (no rank changes). The left and right rankings are identical because A5 cells are equal-area. A city with many listings per cell *necessarily* has high density per km², and vice versa.

## H3: Variable-Area Bias

With H3, cell areas vary by latitude (average ~0.09 km² at resolution 9, but ranges from ~0.07 km² to ~0.11 km²). This creates **different rankings** for "listings per cell" vs "listings per km²".

import SingleH3 from 'website-examples/airbnb-density/single-h3';

<div style={{margin: '20px 0'}}>
  <SingleH3 />
</div>

**Notice:** Many colored lines showing rank changes. Green lines indicate cities that rank higher in "listings per cell" than in true density, while red lines show cities that rank lower. The divergence reveals H3's variable cell areas creating measurement inconsistency.

## Direct Comparison: A5 vs H3

When we compare both indices side-by-side, we can see how rankings evolve from A5 → H3:

import Comparison from 'website-examples/airbnb-density/comparison';

<div style={{margin: '20px 0'}}>
  <Comparison />
</div>

The 4-column diagram shows:
1. **A5 Listings/Cell** → **A5 Listings/km²**: Identical (all black lines)
2. **A5 Listings/km²** → **H3 Listings/km²**: Similar rankings (mostly black/slight green)
3. **H3 Listings/km²** → **H3 Listings/Cell**: Significant divergence (many colored lines)

Cell areas are shown in columns 1 and 4. Notice that A5 has consistent ~0.13 km² cells, while H3 varies from ~0.07-0.11 km².

## The H3 Latitude Bias

The scatterplot reveals the systematic nature of H3's bias:

import Scatterplot from 'website-examples/airbnb-density/scatterplot';

<div style={{margin: '20px 0'}}>
  <Scatterplot />
</div>

**Key insight:** There's a clear correlation between H3 cell area and ranking shift:
- Cities with **larger H3 cells** (higher latitudes) rank **higher** in listings/cell than in true density (positive values, green)
- Cities with **smaller H3 cells** (lower latitudes) rank **lower** in listings/cell than in true density (negative values, red)

This creates a predictable, latitude-dependent bias that can misrepresent true density patterns when comparing cities across different latitudes.

## Why This Matters

When analyzing geospatial density:

- **Use A5** when you need consistent, comparable density measurements across latitudes
- **Be aware of H3 bias** when interpreting "per cell" metrics across different geographic regions
- **Always normalize to area** (per km²) when using variable-area indices like H3 for fair comparisons

Equal-area indices like A5 ensure that density metrics are fair and comparable regardless of geographic location.

## Data Processing Overview

The analysis involves:
1. Downloading Airbnb listing data for ~120 global cities from Inside Airbnb
2. Geocoding listings to A5 cells (resolution 14) and H3 cells (resolution 9)
3. Aggregating to find the densest 10km² area per city
4. Calculating rankings for both "listings per cell" and "listings per km²"
5. Comparing how rankings differ between the two geospatial indexing systems

This demonstrates the importance of equal-area properties in fair geospatial analysis.
