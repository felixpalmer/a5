import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as d3 from 'd3';
import './styles.css';

interface CityData {
  location: string;
  max_density_per_km2: number;
  max_listings_per_cell: number;
  avg_cell_area_km2: number;
  density_rank: number;
  listings_rank: number;
}

const ScatterplotView: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<CityData[] | null>(null);

  useEffect(() => {
    fetch('/data/airbnb_density.json')
      .then(res => res.json())
      .then(data => setData(data.h3))
      .catch(err => console.error('Error loading data:', err));
  }, []);

  useEffect(() => {
    if (!svgRef.current || !data || !containerRef.current) return;

    const scatterData = data.map(city => ({
      location: city.location,
      cellAreaM2: city.avg_cell_area_km2 * 1000000,
      rankChange: city.density_rank - city.listings_rank,
    }));

    d3.select(svgRef.current).selectAll('*').remove();

    const containerWidth = containerRef.current.clientWidth;
    const margin = {top: 40, right: 40, bottom: 60, left: 60};
    const width = Math.min(containerWidth, 1000) - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear()
      .domain([d3.min(scatterData, d => d.cellAreaM2)! * 0.95, d3.max(scatterData, d => d.cellAreaM2)! * 1.05])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([-15, 15])
      .range([height, 0]);

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

    g.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', yScale(0))
      .attr('y2', yScale(0))
      .attr('stroke', '#999')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '5,5');

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

    g.append('text')
      .attr('x', width / 2)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .text('Ranking shift due to H3 cell area');

  }, [data]);

  if (!data) {
    return <div style={{padding: '20px'}}>Loading...</div>;
  }

  return (
    <div ref={containerRef} className="viz-container">
      <svg ref={svgRef} />
    </div>
  );
};

export default ScatterplotView;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<ScatterplotView />);
}
