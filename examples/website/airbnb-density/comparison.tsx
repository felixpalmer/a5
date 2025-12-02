import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as d3 from 'd3';
import CollapsibleViz from './collapsible-viz';
import './styles.css';

interface CityData {
  location: string;
  max_density_per_km2: number;
  max_listings_per_cell: number;
  avg_cell_area_km2: number;
}

interface AirbnbData {
  a5: CityData[];
  h3: CityData[];
}

function formatCityName(location: string): string {
  return location.split('/').pop()!
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getRankChangeColor(rankDiff: number, sourceRank: number, targetRank: number): string {
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
}

const ComparisonView: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<AirbnbData | null>(null);

  useEffect(() => {
    fetch('/data/airbnb_density.json')
      .then(res => res.json())
      .then(setData)
      .catch(err => console.error('Error loading data:', err));
  }, []);

  useEffect(() => {
    if (!svgRef.current || !data || !containerRef.current) return;

    const a5Cities = data.a5;
    const h3Cities = data.h3;
    const topCities = [...a5Cities].sort((a, b) => b.max_density_per_km2 - a.max_density_per_km2);

    d3.select(svgRef.current).selectAll('*').remove();

    const containerWidth = containerRef.current.clientWidth;
    const margin = {top: 60, right: 180, bottom: 20, left: 180};
    const width = Math.min(containerWidth, 1200) - margin.left - margin.right;
    const height = 50 + topCities.length * 25;
    const colWidth = width;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const labels = ['A5 Cell Areas', 'H3 Cell Areas'];

    labels.forEach((label, i) => {
      g.append('text')
        .attr('class', 'column-label')
        .attr('x', i * colWidth)
        .attr('y', -30)
        .attr('text-anchor', 'middle')
        .text(label);
    });

    const nodes: any[] = [];
    const links: any[] = [];

    // A5 column - sorted by listings per cell
    const a5ByListings = [...topCities].sort((a, b) => b.max_listings_per_cell - a.max_listings_per_cell);
    a5ByListings.forEach((city, i) => {
      nodes.push({
        id: `col1_${city.location}`,
        location: city.location,
        cellArea: city.avg_cell_area_km2,
        rank: i + 1,
        column: 0,
        y: i * 25
      });
    });

    // H3 column - sorted by listings per cell
    const h3Sorted = h3Cities
      .filter(c => topCities.some(tc => tc.location === c.location))
      .sort((a, b) => b.max_listings_per_cell - a.max_listings_per_cell);

    h3Sorted.forEach((city, i) => {
      nodes.push({
        id: `col2_${city.location}`,
        location: city.location,
        cellArea: city.avg_cell_area_km2,
        rank: i + 1,
        column: 1,
        y: i * 25
      });
    });

    // Create links between matching cities
    a5ByListings.forEach(city => {
      const sourceNode = nodes.find(n => n.column === 0 && n.location === city.location);
      const targetNode = nodes.find(n => n.column === 1 && n.location === city.location);
      if (sourceNode && targetNode) {
        links.push({
          source: sourceNode,
          target: targetNode,
          rankDiff: Math.abs(sourceNode.rank - targetNode.rank)
        });
      }
    });

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
        .attr('data-location', link.source.location)
        .attr('d', path.toString())
        .attr('stroke', getRankChangeColor(link.rankDiff, link.source.rank, link.target.rank))
        .attr('stroke-width', 4)
        .attr('stroke-opacity', 0.4)
        .attr('fill', 'none')
        .style('cursor', 'pointer')
        .on('mouseover', function() {
          const location = d3.select(this).attr('data-location');
          const cityName = formatCityName(location);

          g.selectAll('.link')
            .attr('stroke-opacity', function() {
              return d3.select(this).attr('data-location') === location ? 1 : 0.2;
            })
            .attr('stroke-width', function() {
              return d3.select(this).attr('data-location') === location ? 8 : 4;
            });

          g.selectAll('text')
            .style('font-weight', function() {
              const text = d3.select(this).text();
              return text.includes(cityName) ? 'bold' : 'normal';
            })
            .style('opacity', function() {
              const text = d3.select(this).text();
              return text.includes(cityName) || d3.select(this).attr('class') === 'column-label' ? 1 : 0.3;
            });
        })
        .on('mouseout', function() {
          g.selectAll('.link').attr('stroke-opacity', 0.4).attr('stroke-width', 4);
          g.selectAll('text').style('font-weight', 'normal').style('opacity', 1);
        });
    });

    for (let col = 0; col < 2; col++) {
      const columnNodes = g.append('g')
        .selectAll('g')
        .data(nodes.filter(n => n.column === col))
        .join('g')
        .attr('transform', d => `translate(${d.column * colWidth}, ${d.y})`);

      columnNodes.append('rect')
        .attr('x', -5).attr('y', 0).attr('width', 10).attr('height', 20).attr('fill', '#000');

      columnNodes.append('text')
        .attr('x', col === 0 ? -10 : 10)
        .attr('y', 10)
        .attr('dy', '.35em')
        .attr('text-anchor', col === 0 ? 'end' : 'start')
        .style('font-size', '11px')
        .text(d => {
          const cityName = formatCityName(d.location);
          return `${cityName} (${d.cellArea.toFixed(2)}km²)`;
        });
    }

  }, [data]);

  if (!data) {
    return <div style={{padding: '20px'}}>Loading...</div>;
  }

  return (
    <CollapsibleViz>
      <div ref={containerRef} className="viz-container">
        <svg ref={svgRef} />
      </div>
    </CollapsibleViz>
  );
};

export default ComparisonView;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<ComparisonView />);
}
