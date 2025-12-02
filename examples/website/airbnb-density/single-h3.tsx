import React from 'react';
import {createRoot} from 'react-dom/client';
import Sankey from './sankey';
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

const SingleH3View: React.FC = () => {
  return (
    <Sankey
      leftLabel="H3: Ranked by Listings / km²"
      rightLabel="H3: Ranked by Listings / Cell"
      getLeftData={(data: AirbnbData) => {
        return [...data.h3].sort((a, b) => b.max_density_per_km2 - a.max_density_per_km2);
      }}
      getRightData={(data: AirbnbData) => {
        return [...data.h3].sort((a, b) => b.max_listings_per_cell - a.max_listings_per_cell);
      }}
      formatLeftLabel={(city: CityData) => {
        return `${formatCityName(city.location)} (${city.max_density_per_km2.toFixed(1)})`;
      }}
      formatRightLabel={(city: CityData) => {
        return `${formatCityName(city.location)} (${city.max_listings_per_cell.toFixed(1)})`;
      }}
    />
  );
};

export default SingleH3View;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<SingleH3View />);
}
