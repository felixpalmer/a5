import React, {useState, useEffect, useRef} from 'react';
import {createRoot} from 'react-dom/client';
import * as d3 from 'd3';
import './styles.css';

type ViewType = 'map' | 'single_a5' | 'single_h3' | 'comparison' | 'scatterplot';

interface CityData {
  location: string;
  max_density_per_km2: number;
  max_listings_per_cell: number;
  avg_cell_area_km2: number;
  density_rank: number;
  listings_rank: number;
}

interface AirbnbData {
  a5: CityData[];
  h3: CityData[];
  a5_cells: any[];
  h3_cells: any[];
}

// Utility function to format city names
function formatCityName(location: string): string {
  return location.split('/').pop()!
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Get color for rank changes
function getRankChangeColor(rankDiff: number, sourceRank: number, targetRank: number): string {
  if (rankDiff === 0) return '#000000';
  const direction = targetRank < sourceRank ? 1 : -1;
  const maxDiff = 15;
  const intensity = Math.min(rankDiff / maxDiff, 1);

  if (direction > 0) {
    // Rising (getting better rank) = green
    const g = Math.round(100 + (200 - 100) * intensity);
    return `rgb(0, ${g}, 0)`;
  } else {
    // Sinking (getting worse rank) = red
    const r = Math.round(150 + (220 - 150) * intensity);
    return `rgb(${r}, 0, 0)`;
  }
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('single_a5');
  const [data, setData] = useState<AirbnbData | null>(null);

  useEffect(() => {
    fetch('/data/airbnb_density.json')
      .then(res => res.json())
      .then(setData)
      .catch(err => console.error('Error loading data:', err));
  }, []);

  if (!data) {
    return <div style={{padding: '20px'}}>Loading...</div>;
  }

  return (
    <div className="airbnb-density-container">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px'}}>
        <div>
          <h1>Airbnb density analysis</h1>
          <p className="subtitle">Data aggregated using A5/H3 and densest 10km² used for comparison</p>
        </div>
        <div style={{textAlign: 'right', fontSize: '14px', color: '#666', marginTop: '10px'}}>
          Data: <a href="https://insideairbnb.com/get-the-data/" target="_blank" rel="noopener">Inside Airbnb</a>
        </div>
      </div>

      <div className="controls">
        <strong>View:</strong>
        {[
          {value: 'map', label: 'Map'},
          {value: 'single_a5', label: 'Ranking using A5'},
          {value: 'single_h3', label: 'Ranking using H3'},
          {value: 'comparison', label: 'Ranking Comparison: A5 vs H3'},
          {value: 'scatterplot', label: 'H3 Bias Plot'}
        ].map(({value, label}) => (
          <label key={value}>
            <input
              type="radio"
              name="view"
              value={value}
              checked={currentView === value}
              onChange={() => setCurrentView(value as ViewType)}
            />
            {label}
          </label>
        ))}
      </div>

      {currentView === 'map' && <MapView data={data} />}
      {currentView === 'single_a5' && <SingleView data={data} indexType="a5" />}
      {currentView === 'single_h3' && <SingleView data={data} indexType="h3" />}
      {currentView === 'comparison' && <ComparisonView data={data} />}
      {currentView === 'scatterplot' && <ScatterplotView data={data} />}
    </div>
  );
};

const MapView: React.FC<{data: AirbnbData}> = ({data}) => {
  return (
    <div className="info">
      <strong>Map View</strong><br />
      Interactive 3D map showing Airbnb listing density aggregated by A5 and H3 cells across global cities.
      The map view with deck.gl is not available in the embedded documentation.
      See the standalone demo for the full interactive experience.
    </div>
  );
};

const SingleView: React.FC<{data: AirbnbData; indexType: 'a5' | 'h3'}> = ({data, indexType}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const cities = data[indexType];
    const topCities = [...cities].sort((a, b) => b.max_density_per_km2 - a.max_density_per_km2);

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove();

    const margin = {top: 40, right: 200, bottom: 20, left: 200};
    const width = 1200 - margin.left - margin.right;
    const height = 50 + topCities.length * 25;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add column labels
    g.append('text')
      .attr('class', 'column-label')
      .attr('x', 0)
      .attr('y', -20)
      .attr('text-anchor', 'end')
      .text('Ranked by Listings / km²');

    g.append('text')
      .attr('class', 'column-label')
      .attr('x', width)
      .attr('y', -20)
      .attr('text-anchor', 'start')
      .text('Ranked by Listings / Cell');

    // Create nodes
    const nodes: any[] = [];
    const links: any[] = [];

    // Left side: ranked by density
    topCities.forEach((city, i) => {
      nodes.push({
        id: `density_${city.location}`,
        location: city.location,
        value: city.max_density_per_km2,
        rank: i + 1,
        side: 'left',
        y: i * 25
      });
    });

    // Right side: ranked by listings per cell
    const sortedByListings = [...topCities]
      .sort((a, b) => b.max_listings_per_cell - a.max_listings_per_cell);

    sortedByListings.forEach((city, i) => {
      nodes.push({
        id: `listings_${city.location}`,
        location: city.location,
        value: city.max_listings_per_cell,
        rank: i + 1,
        side: 'right',
        y: i * 25
      });
    });

    // Create links
    topCities.forEach(city => {
      const leftNode = nodes.find(n => n.id === `density_${city.location}`);
      const rightNode = nodes.find(n => n.id === `listings_${city.location}`);

      if (leftNode && rightNode) {
        const rankDiff = Math.abs(leftNode.rank - rightNode.rank);
        links.push({
          source: leftNode,
          target: rightNode,
          rankDiff: rankDiff
        });
      }
    });

    // Draw links
    const linkGroup = g.append('g').attr('class', 'links');

    links.forEach(link => {
      const path = d3.path();
      const x0 = 0, y0 = link.source.y + 10;
      const x1 = width, y1 = link.target.y + 10;
      const xi = d3.interpolateNumber(x0, x1);
      const x2 = xi(0.5), x3 = xi(0.5);

      path.moveTo(x0, y0);
      path.bezierCurveTo(x2, y0, x3, y1, x1, y1);

      linkGroup.append('path')
        .attr('class', 'link')
        .attr('d', path.toString())
        .attr('stroke', getRankChangeColor(link.rankDiff, link.source.rank, link.target.rank))
        .attr('stroke-width', 4);
    });

    // Draw left nodes
    const leftNodes = g.append('g')
      .selectAll('g')
      .data(nodes.filter(n => n.side === 'left'))
      .join('g')
      .attr('transform', d => `translate(0, ${d.y})`);

    leftNodes.append('rect')
      .attr('x', -10)
      .attr('y', 0)
      .attr('width', 10)
      .attr('height', 20)
      .attr('fill', '#000');

    leftNodes.append('text')
      .attr('x', -15)
      .attr('y', 10)
      .attr('dy', '.35em')
      .attr('text-anchor', 'end')
      .style('font-size', '11px')
      .text(d => `${formatCityName(d.location)} (${d.value.toFixed(1)})`);

    // Draw right nodes
    const rightNodes = g.append('g')
      .selectAll('g')
      .data(nodes.filter(n => n.side === 'right'))
      .join('g')
      .attr('transform', d => `translate(${width}, ${d.y})`);

    rightNodes.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 10)
      .attr('height', 20)
      .attr('fill', '#000');

    rightNodes.append('text')
      .attr('x', 15)
      .attr('y', 10)
      .attr('dy', '.35em')
      .attr('text-anchor', 'start')
      .style('font-size', '11px')
      .text(d => `${formatCityName(d.location)} (${d.value.toFixed(1)})`);

  }, [data, indexType]);

  return (
    <>
      <div className="info" style={{marginBottom: '20px', padding: '15px', background: indexType === 'a5' ? '#f0f7ff' : '#fff4e6', borderLeft: `4px solid ${indexType === 'a5' ? '#2196F3' : '#ff9800'}`}}>
        {indexType === 'a5'
          ? 'A5 cells are equal area and thus the Listings / cell and Listings / km² rankings are the same.'
          : 'H3 cells are different areas and thus the Listings / cell and Listings / km² rankings are different.'}
      </div>
      <svg ref={svgRef} style={{display: 'block', margin: '0 auto'}} />
      <div className="info">
        <strong>How to read this diagram:</strong><br />
        • Left side shows locations ranked by listings/km²<br />
        • Right side shows locations ranked by listings/cell<br />
        • Lines connect the same city between the two rankings<br />
        • Black = no rank change, Green = improved rank, Red = worse rank<br />
        • Line intensity shows magnitude of rank change
      </div>
    </>
  );
};

const ComparisonView: React.FC<{data: AirbnbData}> = ({data}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const a5Cities = data.a5;
    const h3Cities = data.h3;
    const topCities = [...a5Cities].sort((a, b) => b.max_density_per_km2 - a.max_density_per_km2);

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove();

    const margin = {top: 60, right: 200, bottom: 20, left: 200};
    const width = 1200 - margin.left - margin.right;
    const height = 50 + topCities.length * 25;
    const colWidth = width / 3;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Column labels
    const labels = [
      'A5\nListings / Cell',
      'A5\nListings / km²',
      'H3\nListings / km²',
      'H3\nListings / Cell'
    ];

    labels.forEach((label, i) => {
      const lines = label.split('\n');
      const textGroup = g.append('g');
      lines.forEach((line, j) => {
        textGroup.append('text')
          .attr('class', 'column-label')
          .attr('x', i * colWidth)
          .attr('y', -30 + j * 15)
          .attr('text-anchor', 'middle')
          .text(line);
      });
    });

    const nodes: any[] = [];
    const links: any[] = [];

    // Column 1: A5 by listings per cell
    const a5ByListings = [...topCities].sort((a, b) => b.max_listings_per_cell - a.max_listings_per_cell);
    a5ByListings.forEach((city, i) => {
      nodes.push({
        id: `col1_${city.location}`,
        location: city.location,
        value: city.max_listings_per_cell,
        cellArea: city.avg_cell_area_km2,
        rank: i + 1,
        column: 0,
        y: i * 25
      });
    });

    // Column 2: A5 by density
    topCities.forEach((city, i) => {
      nodes.push({
        id: `col2_${city.location}`,
        location: city.location,
        value: city.max_density_per_km2,
        rank: i + 1,
        column: 1,
        y: i * 25
      });
    });

    // Column 3: H3 by density
    const h3Sorted = h3Cities
      .filter(c => topCities.some(tc => tc.location === c.location))
      .sort((a, b) => b.max_density_per_km2 - a.max_density_per_km2);

    h3Sorted.forEach((city, i) => {
      nodes.push({
        id: `col3_${city.location}`,
        location: city.location,
        value: city.max_density_per_km2,
        rank: i + 1,
        column: 2,
        y: i * 25
      });
    });

    // Column 4: H3 by listings per cell
    const h3ByListings = [...h3Sorted].sort((a, b) => b.max_listings_per_cell - a.max_listings_per_cell);
    h3ByListings.forEach((city, i) => {
      nodes.push({
        id: `col4_${city.location}`,
        location: city.location,
        value: city.max_listings_per_cell,
        cellArea: city.avg_cell_area_km2,
        rank: i + 1,
        column: 3,
        y: i * 25
      });
    });

    // Create links
    for (let col = 0; col < 3; col++) {
      topCities.forEach(city => {
        const sourceNode = nodes.find(n => n.column === col && n.location === city.location);
        const targetNode = nodes.find(n => n.column === col + 1 && n.location === city.location);

        if (sourceNode && targetNode) {
          const rankDiff = Math.abs(sourceNode.rank - targetNode.rank);
          links.push({
            source: sourceNode,
            target: targetNode,
            rankDiff: rankDiff
          });
        }
      });
    }

    // Draw links
    const linkGroup = g.append('g');
    links.forEach(link => {
      const path = d3.path();
      const x0 = link.source.column * colWidth;
      const y0 = link.source.y + 10;
      const x1 = link.target.column * colWidth;
      const y1 = link.target.y + 10;
      const xi = d3.interpolateNumber(x0, x1);
      const x2 = xi(0.5), x3 = xi(0.5);

      path.moveTo(x0, y0);
      path.bezierCurveTo(x2, y0, x3, y1, x1, y1);

      linkGroup.append('path')
        .attr('class', 'link')
        .attr('d', path.toString())
        .attr('stroke', getRankChangeColor(link.rankDiff, link.source.rank, link.target.rank))
        .attr('stroke-width', 1);
    });

    // Draw nodes for each column
    for (let col = 0; col < 4; col++) {
      const columnNodes = g.append('g')
        .selectAll('g')
        .data(nodes.filter(n => n.column === col))
        .join('g')
        .attr('transform', d => `translate(${d.column * colWidth}, ${d.y})`);

      columnNodes.append('rect')
        .attr('x', -5)
        .attr('y', 0)
        .attr('width', 10)
        .attr('height', 20)
        .attr('fill', '#000');

      columnNodes.append('text')
        .attr('x', col < 2 ? -10 : 10)
        .attr('y', 10)
        .attr('dy', '.35em')
        .attr('text-anchor', col < 2 ? 'end' : 'start')
        .style('font-size', '12px')
        .text(d => {
          const cityName = formatCityName(d.location);
          if (col === 0 || col === 3) {
            return `${cityName} (${d.value.toFixed(1)} / ${d.cellArea.toFixed(2)}km²)`;
          } else {
            return `${cityName} (${d.value.toFixed(1)})`;
          }
        });
    }

  }, [data]);

  return (
    <>
      <div className="info" style={{marginBottom: '20px', padding: '15px', background: '#fff4e6', borderLeft: '4px solid #ff9800'}}>
        When normalized to Listings / km² the rankings are similar, H3 Listings / cell diverge. H3 overestimates density in large cells.
      </div>
      <svg ref={svgRef} style={{display: 'block', margin: '0 auto'}} />
      <div className="info">
        <strong>How to read this diagram:</strong><br />
        • Shows the flow from A5 listings/cell → A5 listings/km² → H3 listings/km² → H3 listings/cell<br />
        • Each column ranks locations by a different metric<br />
        • Lines connect the same city across different rankings<br />
        • Cell areas shown in first and last columns (A5: ~0.13 km², H3: ~0.09 km²)<br />
        • Black = no rank change, Green = improved rank, Red = worse rank
      </div>
    </>
  );
};

const ScatterplotView: React.FC<{data: AirbnbData}> = ({data}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const h3Cities = data.h3;

    // Calculate scatter data
    const scatterData = h3Cities.map(city => ({
      location: city.location,
      cellAreaM2: city.avg_cell_area_km2 * 1000000,
      rankChange: city.density_rank - city.listings_rank,
      listingsRank: city.listings_rank,
      densityRank: city.density_rank,
      listings: city.max_listings_per_cell,
      density: city.max_density_per_km2
    }));

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove();

    const margin = {top: 40, right: 200, bottom: 60, left: 60};
    const width = 1200 - margin.left - margin.right;
    const height = 700 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([d3.min(scatterData, d => d.cellAreaM2)! * 0.95, d3.max(scatterData, d => d.cellAreaM2)! * 1.05])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([-15, 15])
      .range([height, 0]);

    // Color scale
    const colorScale = (d: any) => {
      if (d.rankChange === 0) return '#000000';
      if (d.rankChange > 0) {
        const intensity = Math.min(Math.abs(d.rankChange) / 20, 1);
        const g = Math.round(100 + (200 - 100) * intensity);
        return `rgb(0, ${g}, 0)`;
      } else {
        const intensity = Math.min(Math.abs(d.rankChange) / 20, 1);
        const r = Math.round(150 + (220 - 150) * intensity);
        return `rgb(${r}, 0, 0)`;
      }
    };

    // Add axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(10)
      .tickFormat(d => `${(Number(d) / 1000).toFixed(0)}k`);

    const yAxis = d3.axisLeft(yScale).ticks(10);

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .append('text')
      .attr('x', width / 2)
      .attr('y', 40)
      .attr('fill', '#000')
      .attr('font-size', '14px')
      .attr('text-anchor', 'middle')
      .text('Average Cell Area (m²)');

    g.append('g')
      .call(yAxis)
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -45)
      .attr('fill', '#000')
      .attr('font-size', '14px')
      .attr('text-anchor', 'middle')
      .text('Rank Change (Density Rank - Listings Rank)');

    // Add zero line
    g.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', yScale(0))
      .attr('y2', yScale(0))
      .attr('stroke', '#999')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '5,5');

    // Add points
    g.selectAll('circle')
      .data(scatterData)
      .join('circle')
      .attr('cx', d => xScale(d.cellAreaM2))
      .attr('cy', d => yScale(d.rankChange))
      .attr('r', 5)
      .attr('fill', colorScale)
      .attr('opacity', 0.7)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1);

    // Add title
    g.append('text')
      .attr('x', width / 2)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .text('Ranking shift due to H3 cell area');

  }, [data]);

  return (
    <>
      <div className="info" style={{marginBottom: '20px', padding: '15px', background: '#fff4e6', borderLeft: '4px solid #ff9800'}}>
        H3 cell areas vary across the globe. Locations with small H3 cell areas are pushed down the list, while those with large areas are pushed up.
      </div>
      <svg ref={svgRef} style={{display: 'block', margin: '0 auto'}} />
      <div className="info">
        <strong>How to read this diagram:</strong><br />
        • Each point represents a city in the H3 system<br />
        • X-axis: Average cell area in m² (varies by latitude)<br />
        • Y-axis: Rank change from listings/cell ranking to density/km² ranking<br />
        • Positive values (above 0) = city rose in density ranking<br />
        • Negative values (below 0) = city dropped in density ranking<br />
        • Green = improved rank, Red = worse rank, Black = no change
      </div>
    </>
  );
};

export default App;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
}
