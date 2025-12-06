# A5 vs H3 Comparison

This analysis ranks locations worldwide to identify which have the highest density of Airbnb listings. It extends the concept illustrated in the [Airbnb example](/examples/airbnb).

We analyze [Inside Airbnb](https://insideairbnb.com/get-the-data/) listing data aggregated using an equal-area grid system (A5) compared to a variable-area system (H3).

The analysis across 120 global locations reveals a fundamental difference: **A5's equal-area cells provide consistent density rankings**, while **H3's variable cell areas introduce systematic bias**.

## Method

- Aggregate listing data into cells of roughly 0.1 km² using both systems (A5 and H3)
- For each location, order cells by listing count to obtain density values per cell
- For each location, select the top N cells (by density) such that their combined area totals 10 km²
- Sum the listing count across these N cells to obtain a density value per location
- Rank locations by density to establish a global ordering

## Results

import Top10Comparison from 'website-examples/airbnb-density/top10-comparison';

<div style={{margin: '20px 0'}}>
  <Top10Comparison />
</div>

Notice how Buenos Aires has disappeared in the H3 ranking, and Hawaii and Rome have swapped places. Why is this happening?

## Cause: Density Calculation

The root cause is that density measurements require units of **listings/km²**. For an equal-area system like A5, this is equivalent to **listings/cell** (up to a constant scaling factor). However, for variable-area systems like H3 or S2, this equivalence does not hold.

A common error with H3 is to assume cells have equal areas and treat them as such. To obtain accurate results, density must be normalized to **listings/km²** rather than **listings/cell**, but this normalization is often omitted in practice.

The benefit of an equal-area system is that normalization is unnecessary, which simplifies analysis and reduces the potential for errors.

## Density Comparisons

The following sections examine how the systems calculate density, demonstrating that the above effect is not merely theoretical but has a measurable impact on analysis results.

### A5: Equal-Area Consistency

In this analysis, we have used A5 cells at resolution 14. All cells have the same area (~0.13 km²), which means that ranking by **listings/cell** and **listings/km²** gives the same result.

import SingleA5 from 'website-examples/airbnb-density/single-a5';

<div style={{margin: '20px 0'}}>
  <SingleA5 />
</div>

### H3: Variable-Area Bias

With H3, cell areas vary across the globe. To understand the details, see the [Area Variance](/examples/area) example.

_Note: A common misconception is that H3 cell areas vary predictably by latitude (e.g., "cells are only small near the poles/equator"). This is incorrect - variation occurs across all latitudes._

In this analysis, we used H3 cells at resolution 9. The cells have an **average area** of ~0.09 km², but range from ~0.07 km² to ~0.13 km². These are not theoretical limits - the full range appears in our real-world dataset.

Due to size variation, we get a different ordering depending on whether we order by **listings/cell** vs **listings/km²**.

import SingleH3 from 'website-examples/airbnb-density/single-h3';

<div style={{margin: '20px 0'}}>
  <SingleH3 />
</div>

**Notice:** Many colored lines showing rank changes. Green lines indicate cities that rank higher in **listings/cell** than in true density, while red lines show cities that rank lower.

### Comparison: A5 vs H3

When we compare both indices side-by-side, we can see how cell areas affect the rankings:

import Comparison from 'website-examples/airbnb-density/comparison';

<div style={{margin: '20px 0'}}>
  <Comparison />
</div>

**Key observation**: A5 maintains consistent ~0.13 km² cells across all cities, while H3 cell areas vary significantly from ~0.07 km² to ~0.13 km². This causes Buenos Aires to drop in the rankings due to smaller cell sizes there (~0.07 km²), while Hawaii ranks higher due to larger cell sizes (~0.12 km²).


### H3 Size Bias

The scatterplot reveals the systematic nature of H3's bias, showing how the cell size is correlated with the shift in the rankings:

import Scatterplot from 'website-examples/airbnb-density/scatterplot';

<div style={{margin: '20px 0'}}>
  <Scatterplot />
</div>

## Why This Matters

The above example demonstrates how variable cell sizes can produce inaccurate analysis results. While the effect may not always be this pronounced, it is always present. When performing density analysis, either use an equal-area system or carefully normalize by cell area when using variable-area systems.

### Other Examples

Similar errors can occur in:

- **H3 global population maps**: Aggregating population per cell and directly applying a color gradient is inaccurate unless normalized by cell area
- **S2 bucketing**: Assigning land-use values to cells and producing histograms is inaccurate because bucket (cell) sizes are non-uniform

### Takeaway

When analyzing geospatial density:

- **Use A5** when you need consistent, comparable density measurements globally
- **Be aware of H3/S2 bias** when interpreting "per cell" metrics across different geographic regions
- **Always normalize to area** (per km²) when using variable-area systems like H3/S2