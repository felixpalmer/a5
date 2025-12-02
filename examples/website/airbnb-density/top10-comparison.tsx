import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {formatCityName} from './utils';
import './styles.css';

interface CityData {
  location: string;
  max_density_per_km2: number;
  max_listings_per_cell: number;
}

interface AirbnbData {
  a5: CityData[];
  h3: CityData[];
}

const countryFlags: {[key: string]: string} = {
  'france': '🇫🇷',
  'brazil': '🇧🇷',
  'italy': '🇮🇹',
  'argentina': '🇦🇷',
  'united-states': '🌊',
  'turkey': '🇹🇷',
  'portugal': '🇵🇹',
  'spain': '🇪🇸',
  'united-kingdom': '🇬🇧',
  'greece': '🇬🇷',
  'mexico': '🇲🇽',
  'hungary': '🇭🇺',
  'thailand': '🇹🇭',
  'south-africa': '🇿🇦',
  'denmark': '🇩🇰'
};

function getCountryFromLocation(location: string): string {
  const parts = location.split('/');
  return parts[0] || '';
}

const Top10Comparison: React.FC = () => {
  const [data, setData] = useState<AirbnbData | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    fetch('/data/airbnb_density.json')
      .then(res => res.json())
      .then(setData)
      .catch(err => console.error('Error loading data:', err));
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!data) {
    return <div style={{padding: '20px'}}>Loading...</div>;
  }

  const a5Top10 = [...data.a5]
    .sort((a, b) => b.max_listings_per_cell - a.max_listings_per_cell)
    .slice(0, 10);

  const h3Top10 = [...data.h3]
    .sort((a, b) => b.max_listings_per_cell - a.max_listings_per_cell)
    .slice(0, 10);

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? '20px' : '40px',
      margin: '30px 0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
    }}>
      <div style={{flex: 1}}>
        <h3 style={{
          margin: '0 0 16px 0',
          fontSize: '18px',
          fontWeight: '600',
          color: '#10b981'
        }}>A5 Top 10</h3>
        <div style={{
          background: '#f9fafb',
          borderRadius: '8px',
          padding: '12px 16px',
          border: '1px solid #e5e7eb'
        }}>
          {a5Top10.map((city, index) => {
            const country = getCountryFromLocation(city.location);
            const flag = countryFlags[country] || '🌍';
            return (
              <div
                key={city.location}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: index < 9 ? '1px solid #e5e7eb' : 'none'
                }}
              >
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#6b7280',
                  minWidth: '24px'
                }}>{index + 1}.</span>
                <span style={{fontSize: '20px', margin: '0 8px'}}>{flag}</span>
                <span style={{fontSize: '15px', color: '#374151'}}>
                  {formatCityName(city.location)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{flex: 1}}>
        <h3 style={{
          margin: '0 0 16px 0',
          fontSize: '18px',
          fontWeight: '600',
          color: '#6b7280'
        }}>H3 Top 10</h3>
        <div style={{
          background: '#f9fafb',
          borderRadius: '8px',
          padding: '12px 16px',
          border: '1px solid #e5e7eb'
        }}>
          {h3Top10.map((city, index) => {
            const country = getCountryFromLocation(city.location);
            const flag = countryFlags[country] || '🌍';
            const a5Rank = a5Top10.findIndex(c => c.location === city.location);
            const rankDiff = a5Rank >= 0 ? a5Rank - index : null;

            return (
              <div
                key={city.location}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: index < 9 ? '1px solid #e5e7eb' : 'none'
                }}
              >
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#6b7280',
                  minWidth: '24px'
                }}>{index + 1}.</span>
                <span style={{fontSize: '20px', margin: '0 8px'}}>{flag}</span>
                <span style={{fontSize: '15px', color: '#374151'}}>
                  {formatCityName(city.location)}
                </span>
                {rankDiff !== null && rankDiff !== 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: rankDiff > 0 ? '#10b981' : '#ef4444'
                  }}>
                    {rankDiff > 0 ? '↑' : '↓'}{Math.abs(rankDiff)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Top10Comparison;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<Top10Comparison />);
}
