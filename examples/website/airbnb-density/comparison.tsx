import React from 'react';
import {createRoot} from 'react-dom/client';
import Sankey from './sankey';
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

const ComparisonView: React.FC = () => {
  return (
    <Sankey
      leftLabel="A5 (constant area)"
      rightLabel="H3 (variable area)"
      getLeftData={(data: AirbnbData) => {
        // Get top cities by A5 density
        const topCities = [...data.a5]
          .sort((a, b) => b.max_density_per_km2 - a.max_density_per_km2);

        // Return them sorted by listings per cell
        return [...topCities].sort((a, b) => b.max_listings_per_cell - a.max_listings_per_cell);
      }}
      getRightData={(data: AirbnbData) => {
        // Get top cities by A5 density
        const topCities = [...data.a5]
          .sort((a, b) => b.max_density_per_km2 - a.max_density_per_km2);

        // Get corresponding H3 data and sort by listings per cell
        const topLocations = new Set(topCities.map(c => c.location));
        return data.h3
          .filter(c => topLocations.has(c.location))
          .sort((a, b) => b.max_listings_per_cell - a.max_listings_per_cell);
      }}
      formatLeftLabel={(city: CityData) => {
        return `${formatCityName(city.location)} (${city.avg_cell_area_km2.toFixed(2)}km²)`;
      }}
      formatRightLabel={(city: CityData) => {
        return `${formatCityName(city.location)} (${city.avg_cell_area_km2.toFixed(2)}km²)`;
      }}
    />
  );
};

export default ComparisonView;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<ComparisonView />);
}
