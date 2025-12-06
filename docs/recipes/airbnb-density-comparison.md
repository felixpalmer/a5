# A5 vs H3 comparison

The analysis ranks locations worldwide to establish which have the highest density of Airbnb listings. It is an extension of the idea illustrated in the [Airbnb example](/examples/airbnb).

We analyze [Inside Airbnb](https://insideairbnb.com/get-the-data/) listing data aggregated using an equal-area grid system (A5) compared to a non-equal-area system (H3).

The analysis across 120 global locations reveals a fundamental difference: **A5's equal-area cells provide consistent density rankings**, while **H3's variable cell areas introduce systematic bias**.

## Method

- Aggregate listing data into roughly 0.1 km² cells using both systems (A5 / H3)
- For each location, order the cells by count to obtain density values per cell
- For each location, take top N cells (by density) such that the area sums to 10 km²
- Sum the count over N cells for each location to obtain density value per location
- Order locations by density to obtain global ordering

## Results

import Top10Comparison from 'website-examples/airbnb-density/top10-comparison';

<div style={{margin: '20px 0'}}>
  <Top10Comparison />
</div>

Notice how Buenos Aires has disappeared in the H3 ranking, and Hawaii and Rome have swapped places. Why is this happening?

## Cause: Density calculation

The root cause is that when talking about density, our units need to be **listings/km²**. For an equal-area system like A5 this is equivalent to **listings/cell** (up to a constant scaling factor). However for other systems like H3 or S2, which have variable cell areas it is not.

It is a common error with H3 to assume that the cells have equal areas and to treat them as such. In fact to obtain a correct result, the density should be normalized to be **listings/km²** rather than **listings/cell**, but in practice this is often omitted.

The benefit of an equal-area system is that there is no need to normalize, which simplifies the analysis and reduces the scope for error.

## Density comparisons

The following sections dive deeper into how the systems calculate density, to show that the above effect is not just theoritical, but has a real impact on the result of our analysis.

### A5: Equal-Area Consistency

In this analysis, we have used A5 cells at resolution 14. All cells have the same area (~0.13 km²), which means that ranking by **listings/cell** and **listings/km²** gives the same result.

import SingleA5 from 'website-examples/airbnb-density/single-a5';

<div style={{margin: '20px 0'}}>
  <SingleA5 />
</div>

### H3: Variable-Area Bias

With H3, cell areas vary by across the globe. To understand how exactly, see the [Area Variance](examples/area) example.

_Note: It is a common misconception that H3 cell areas vary by latitude and thus are "only small on the north pole/equator". This is completely wrong_

In this analysis, we have used H3 cells at resolution 9. The cells have an **average area** of ~0.09 km², but vary from ~0.07 km² to ~0.13 km². These are not theoretical limits, the full range is present in our real-world data.

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

**Key observation**: A5 has consistent ~0.13 km² cells across all cities, while H3 cell areas vary significantly from ~0.07 km² to ~0.13 km². This leads to Buenos Aires dropping down the ranking due to the small cell sizes there (0.07 km²), while Hawaii is pushed up due to a large cell size (0.12 km²).


### H3 Size Bias

The scatterplot reveals the systematic nature of H3's bias, showing how the cell size is correlated with the shift in the rankings:

import Scatterplot from 'website-examples/airbnb-density/scatterplot';

<div style={{margin: '20px 0'}}>
  <Scatterplot />
</div>

## Why This Matters

The above example illustrates a clear case where variable cell sizes will result in an analysis producing an inaccurate result. While the effect may not always be so strong, it is always there - so it is good to be mindful of it when using variable-area system (and normalizing by cell area), or to use an equal-area system for analysis involving density.

### Other examples

Some examples where error will be introduced for a similar reason:

- **H3 global population maps**. Aggregating population per-cell and then directly applying a gradient is inaccurate (unless normalized by cell area)
- **Bucketing using S2**. Assigning land-use values to cells and then producing a histogram is inaccurate as the bucket (cell) sizes are not uniform

### Takeaway

When analyzing geospatial density:

- **Use A5** when you need consistent, comparable density measurements globally
- **Be aware of H3/S2 bias** when interpreting "per cell" metrics across different geographic regions
- **Always normalize to area** (per km²) when using variable-area systems like H3/S2