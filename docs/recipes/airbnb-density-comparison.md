# Airbnb Density Comparison: A5 vs H3

This recipe demonstrates how to analyze Airbnb listing density across global cities using both A5 and H3 geospatial indices, revealing important differences in how these systems handle equal-area aggregation.

## Overview

In this example, we:
1. Aggregate [Inside Airbnb](https://insideairbnb.com/get-the-data/) listing data using both A5 and H3 indices
2. Calculate density metrics (listings per cell and listings per km²)
3. Compare city rankings to reveal systematic biases in H3's variable cell areas
4. Visualize the differences through interactive diagrams

## Key Finding

**A5's equal-area cells provide consistent density rankings**, while **H3's variable cell areas introduce systematic bias** that can misrepresent true density patterns.

## Interactive Visualization

import AirbnbDensityDemo from 'website-examples/airbnb-density/app';

<div style={{margin: '20px 0', height: '700px', position: 'relative'}}>
  <AirbnbDensityDemo />
</div>

## Understanding the Results

### A5: Equal-Area Consistency

With A5, all cells at a given resolution have the same area (~0.13 km² at resolution 14). This means:
- Rankings by "listings per cell" and "listings per km²" are **identical**
- Density comparisons across latitudes are **fair and accurate**
- No systematic bias based on geographic location

### H3: Variable-Area Bias

With H3, cell areas vary by latitude (~0.09 km² average at resolution 9). This creates:
- **Different rankings** for "listings per cell" vs "listings per km²"
- **Systematic bias**: Cities at higher latitudes have larger cells, inflating their "per cell" counts
- Rankings that don't accurately reflect true density when comparing across latitudes

### The H3 Bias Plot

The scatterplot view reveals the correlation between H3 cell area and ranking shift:
- Cities with **larger cells** (higher latitudes) rank **higher** in listings/cell than in true density
- Cities with **smaller cells** (lower latitudes) rank **lower** in listings/cell than in true density
- This creates a predictable, latitude-dependent bias in rankings

## Data Processing

The analysis involves:
1. **Downloading listing data** from Inside Airbnb for ~120 global cities
2. **Geocoding listings** to A5 (resolution 14) and H3 (resolution 9) cells
3. **Aggregating** to find the densest 10km² area per city
4. **Calculating rankings** for both "listings per cell" and "listings per km²"
5. **Comparing** how rankings differ between A5 and H3

## Why This Matters

When analyzing geospatial density:
- **Use A5** when you need consistent, comparable density measurements across latitudes
- **Be aware of H3 bias** when interpreting "per cell" metrics across different geographic regions
- **Always normalize to area** (per km²) when using variable-area indices like H3

This example demonstrates why equal-area indices like A5 are preferable for density analysis and fair geographic comparisons.

## Next Steps

- Try applying this analysis to other geospatial datasets (restaurants, POIs, population)
- Explore how the bias manifests at different resolutions
- Compare density patterns within a single latitude band (where H3 bias is minimal)
