import React, {useEffect, useRef, useState} from 'react';
import * as d3 from 'd3';
import CollapsibleViz from './collapsible-viz';
import {formatCityName} from './utils';
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

interface SankeyProps {
  leftLabel: string;
  rightLabel: string;
  getLeftData: (data: AirbnbData) => CityData[];
  getRightData: (data: AirbnbData) => CityData[];
  formatLeftLabel: (city: CityData) => string;
  formatRightLabel: (city: CityData) => string;
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

const Sankey: React.FC<SankeyProps> = ({
  leftLabel,
  rightLabel,
  getLeftData,
  getRightData,
  formatLeftLabel,
  formatRightLabel
}) => {
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

    const leftCities = getLeftData(data);
    const rightCities = getRightData(data);

    d3.select(svgRef.current).selectAll('*').remove();

    const containerWidth = containerRef.current.clientWidth;
    const isMobile = containerWidth < 768;
    const margin = isMobile
      ? {top: 50, right: 100, bottom: 20, left: 100}
      : {top: 60, right: 180, bottom: 20, left: 180};
    const width = Math.min(containerWidth, 1200) - margin.left - margin.right;
    const height = 50 + leftCities.length * 25;
    // Make the sankey narrower to leave room for labels, but center it
    const sankeyWidth = isMobile ? width * 0.5 : width * 0.6;
    const sankeyOffset = (width - sankeyWidth) / 2;
    const colWidth = sankeyWidth;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add column labels
    g.append('text')
      .attr('class', 'column-label')
      .attr('x', -margin.left)
      .attr('y', -30)
      .attr('text-anchor', 'start')
      .style('font-size', isMobile ? '11px' : '14px')
      .text(leftLabel);

    g.append('text')
      .attr('class', 'column-label')
      .attr('x', width + margin.right)
      .attr('y', -30)
      .attr('text-anchor', 'end')
      .style('font-size', isMobile ? '11px' : '14px')
      .text(rightLabel);

    const nodes: any[] = [];
    const links: any[] = [];

    // Left column nodes
    leftCities.forEach((city, i) => {
      nodes.push({
        id: `left_${city.location}`,
        location: city.location,
        data: city,
        rank: i + 1,
        column: 0,
        x: sankeyOffset,
        y: i * 25
      });
    });

    // Right column nodes
    rightCities.forEach((city, i) => {
      nodes.push({
        id: `right_${city.location}`,
        location: city.location,
        data: city,
        rank: i + 1,
        column: 1,
        x: sankeyOffset + colWidth,
        y: i * 25
      });
    });

    // Create links between matching cities
    leftCities.forEach(city => {
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
      const x0 = link.source.x;
      const y0 = link.source.y + 10;
      const x1 = link.target.x;
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
        .attr('transform', d => `translate(${d.x}, ${d.y})`);

      columnNodes.append('rect')
        .attr('x', -5).attr('y', 0).attr('width', 10).attr('height', 20).attr('fill', '#000');

      columnNodes.append('text')
        .attr('x', col === 0 ? -10 : 10)
        .attr('y', 10)
        .attr('dy', '.35em')
        .attr('text-anchor', col === 0 ? 'end' : 'start')
        .style('font-size', isMobile ? '9px' : '11px')
        .text(d => col === 0 ? formatLeftLabel(d.data) : formatRightLabel(d.data));
    }

  }, [data, leftLabel, rightLabel, getLeftData, getRightData, formatLeftLabel, formatRightLabel]);

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

export default Sankey;
