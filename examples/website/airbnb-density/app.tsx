import React, {useState, useEffect, useRef} from 'react';
import {createRoot} from 'react-dom/client';
import * as d3 from 'd3';
import './styles.css';

// Import D3 sankey if needed
// @ts-ignore
import {sankey as d3Sankey, sankeyLinkHorizontal} from 'd3-sankey';

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

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('map');
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

// Utility function to format city names
function formatCityName(location: string): string {
  return location.split('/').pop()!
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const MapView: React.FC<{data: AirbnbData}> = ({data}) => {
  return (
    <div className="info">
      <strong>Map View</strong><br />
      Interactive map showing Airbnb listing density aggregated by A5 and H3 cells.
      Due to technical limitations in the documentation environment, the map view is not available here.
      See the standalone version for the full interactive map.
    </div>
  );
};

const SingleView: React.FC<{data: AirbnbData; indexType: 'a5' | 'h3'}> = ({data, indexType}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const cities = data[indexType];
    const topCities = cities.sort((a, b) => b.max_density_per_km2 - a.max_density_per_km2);

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

    // Create nodes and links
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

    // Create links between same cities
    topCities.forEach(city => {
      const leftNode = nodes.find(n => n.id === `density_${city.location}`);
      const rightNode = nodes.find(n => n.id === `listings_${city.location}`);

      if (leftNode && rightNode) {
        const rankDiff = Math.abs(leftNode.rank - rightNode.rank);
        links.push({
          source: leftNode,
          target: rightNode,
          value: 1,
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

      const getRankChangeColor = (rankDiff: number, sourceRank: number, targetRank: number) => {
        if (rankDiff === 0) return '#000000';
        const direction = targetRank < sourceRank ? 1 : -1;
        const maxDiff = 15;
        const intensity = Math.min(rankDiff / maxDiff, 1);

        if (direction > 0) {
          const g = Math.round(100 + (200 - 100) * intensity);
          return `rgb(0, ${g}, 0)`;
        } else {
          const r = Math.round(150 + (220 - 150) * intensity);
          return `rgb(${r}, 0, 0)`;
        }
      };

      linkGroup.append('path')
        .attr('class', 'link')
        .attr('d', path.toString())
        .attr('stroke', getRankChangeColor(link.rankDiff, link.source.rank, link.target.rank))
        .attr('stroke-width', 4);
    });

    // Draw left nodes
    const leftNodes = g.append('g')
      .attr('class', 'nodes-left')
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
      .attr('class', 'nodes-right')
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

  // Placeholder for now
  return (
    <>
      <div className="info" style={{marginBottom: '20px'}}>
        Shows the flow from A5 listings/cell → A5 listings/km² → H3 listings/km² → H3 listings/cell
      </div>
      <svg ref={svgRef} style={{display: 'block', margin: '0 auto', minHeight: '600px'}} />
    </>
  );
};

const ScatterplotView: React.FC<{data: AirbnbData}> = ({data}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Placeholder for now
  return (
    <>
      <div className="info" style={{marginBottom: '20px'}}>
        Shows how H3 cell area variations cause ranking bias
      </div>
      <svg ref={svgRef} style={{display: 'block', margin: '0 auto', minHeight: '600px'}} />
    </>
  );
};

export default App;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
}
