import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as d3 from 'd3';
import CollapsibleViz from './collapsible-viz';
import './styles.css';

interface CityData {
  location: string;
  max_density_per_km2: number;
  max_listings_per_cell: number;
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

const SingleA5View: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<CityData[] | null>(null);

  useEffect(() => {
    fetch('/data/airbnb_density.json')
      .then(res => res.json())
      .then(data => setData(data.a5))
      .catch(err => console.error('Error loading data:', err));
  }, []);

  useEffect(() => {
    if (!svgRef.current || !data || !containerRef.current) return;

    const topCities = [...data].sort((a, b) => b.max_density_per_km2 - a.max_density_per_km2);
    d3.select(svgRef.current).selectAll('*').remove();

    const containerWidth = containerRef.current.clientWidth;
    const margin = {top: 40, right: 180, bottom: 20, left: 180};
    const width = Math.min(containerWidth, 1000) - margin.left - margin.right;
    const height = 50 + topCities.length * 25;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

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

    const nodes: any[] = [];
    const links: any[] = [];

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

    const sortedByListings = [...topCities].sort((a, b) => b.max_listings_per_cell - a.max_listings_per_cell);
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

    topCities.forEach(city => {
      const leftNode = nodes.find(n => n.id === `density_${city.location}`);
      const rightNode = nodes.find(n => n.id === `listings_${city.location}`);
      if (leftNode && rightNode) {
        links.push({
          source: leftNode,
          target: rightNode,
          rankDiff: Math.abs(leftNode.rank - rightNode.rank)
        });
      }
    });

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
            });
        })
        .on('mouseout', function() {
          g.selectAll('.link').attr('stroke-opacity', 0.4).attr('stroke-width', 4);
          g.selectAll('text').style('font-weight', 'normal');
        });
    });

    const leftNodes = g.append('g')
      .selectAll('g')
      .data(nodes.filter(n => n.side === 'left'))
      .join('g')
      .attr('transform', d => `translate(0, ${d.y})`);

    leftNodes.append('rect')
      .attr('x', -10).attr('y', 0).attr('width', 10).attr('height', 20).attr('fill', '#000');

    leftNodes.append('text')
      .attr('x', -15).attr('y', 10).attr('dy', '.35em')
      .attr('text-anchor', 'end').style('font-size', '11px')
      .text(d => `${formatCityName(d.location)} (${d.value.toFixed(1)})`);

    const rightNodes = g.append('g')
      .selectAll('g')
      .data(nodes.filter(n => n.side === 'right'))
      .join('g')
      .attr('transform', d => `translate(${width}, ${d.y})`);

    rightNodes.append('rect')
      .attr('x', 0).attr('y', 0).attr('width', 10).attr('height', 20).attr('fill', '#000');

    rightNodes.append('text')
      .attr('x', 15).attr('y', 10).attr('dy', '.35em')
      .attr('text-anchor', 'start').style('font-size', '11px')
      .text(d => `${formatCityName(d.location)} (${d.value.toFixed(1)})`);

  }, [data]);

  if (!data) {
    return <div style={{padding: '20px'}}>Loading...</div>;
  }

  return (
    <CollapsibleViz defaultHeight={400}>
      <div ref={containerRef} className="viz-container">
        <svg ref={svgRef} />
      </div>
    </CollapsibleViz>
  );
};

export default SingleA5View;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<SingleA5View />);
}
