import React, {useState, useMemo, useEffect, useRef} from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map as MapGL, useControl} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {PathLayer, ScatterplotLayer} from '@deck.gl/layers';
import {A5Layer} from '@deck.gl/geo-layers';
import {
  area,
  compact,
  count,
  difference,
  getCompactionResolution,
  getResolution,
  intersect,
  isCompactionMarker,
  lonLatToCell,
  polygonToCells,
  sphericalCap,
  union
} from 'a5';
import type {LonLat} from 'a5/core/coordinate-systems';

const INITIAL_VIEW_STATE = {
  longitude: 12,
  latitude: 50,
  zoom: 3.6,
  pitch: 0,
  bearing: 0
};

const EARTH_RADIUS_KM = 6371.0088;

/** European countries (Natural Earth `admin` names) and their capitals */
const CAPITALS: {country: string; label: string; code: string; capital: string; position: [number, number]}[] = [
  {country: 'Albania', label: 'Albania', code: 'AL', capital: 'Tirana', position: [19.82, 41.33]},
  {country: 'Austria', label: 'Austria', code: 'AT', capital: 'Vienna', position: [16.37, 48.21]},
  {country: 'Belarus', label: 'Belarus', code: 'BY', capital: 'Minsk', position: [27.56, 53.9]},
  {country: 'Belgium', label: 'Belgium', code: 'BE', capital: 'Brussels', position: [4.35, 50.85]},
  {
    country: 'Bosnia and Herzegovina',
    label: 'Bosnia and Herzegovina',
    code: 'BA',
    capital: 'Sarajevo',
    position: [18.41, 43.86]
  },
  {country: 'Bulgaria', label: 'Bulgaria', code: 'BG', capital: 'Sofia', position: [23.32, 42.7]},
  {country: 'Croatia', label: 'Croatia', code: 'HR', capital: 'Zagreb', position: [15.98, 45.81]},
  {country: 'Czech Republic', label: 'Czechia', code: 'CZ', capital: 'Prague', position: [14.42, 50.08]},
  {country: 'Denmark', label: 'Denmark', code: 'DK', capital: 'Copenhagen', position: [12.57, 55.68]},
  {country: 'Estonia', label: 'Estonia', code: 'EE', capital: 'Tallinn', position: [24.75, 59.44]},
  {country: 'Finland', label: 'Finland', code: 'FI', capital: 'Helsinki', position: [24.94, 60.17]},
  {country: 'France', label: 'France', code: 'FR', capital: 'Paris', position: [2.35, 48.86]},
  {country: 'Germany', label: 'Germany', code: 'DE', capital: 'Berlin', position: [13.4, 52.52]},
  {country: 'Greece', label: 'Greece', code: 'GR', capital: 'Athens', position: [23.73, 37.98]},
  {country: 'Hungary', label: 'Hungary', code: 'HU', capital: 'Budapest', position: [19.04, 47.5]},
  {country: 'Iceland', label: 'Iceland', code: 'IS', capital: 'Reykjavik', position: [-21.94, 64.15]},
  {country: 'Ireland', label: 'Ireland', code: 'IE', capital: 'Dublin', position: [-6.26, 53.35]},
  {country: 'Italy', label: 'Italy', code: 'IT', capital: 'Rome', position: [12.5, 41.9]},
  {country: 'Kosovo', label: 'Kosovo', code: 'XK', capital: 'Pristina', position: [21.17, 42.67]},
  {country: 'Latvia', label: 'Latvia', code: 'LV', capital: 'Riga', position: [24.11, 56.95]},
  {country: 'Lithuania', label: 'Lithuania', code: 'LT', capital: 'Vilnius', position: [25.28, 54.69]},
  {country: 'Luxembourg', label: 'Luxembourg', code: 'LU', capital: 'Luxembourg', position: [6.13, 49.61]},
  {country: 'Macedonia', label: 'North Macedonia', code: 'MK', capital: 'Skopje', position: [21.43, 42.0]},
  {country: 'Moldova', label: 'Moldova', code: 'MD', capital: 'Chișinău', position: [28.86, 47.01]},
  {country: 'Montenegro', label: 'Montenegro', code: 'ME', capital: 'Podgorica', position: [19.26, 42.44]},
  {country: 'Netherlands', label: 'Netherlands', code: 'NL', capital: 'Amsterdam', position: [4.9, 52.37]},
  {country: 'Norway', label: 'Norway', code: 'NO', capital: 'Oslo', position: [10.75, 59.91]},
  {country: 'Poland', label: 'Poland', code: 'PL', capital: 'Warsaw', position: [21.01, 52.23]},
  {country: 'Portugal', label: 'Portugal', code: 'PT', capital: 'Lisbon', position: [-9.14, 38.72]},
  {country: 'Romania', label: 'Romania', code: 'RO', capital: 'Bucharest', position: [26.1, 44.43]},
  {country: 'Republic of Serbia', label: 'Serbia', code: 'RS', capital: 'Belgrade', position: [20.46, 44.79]},
  {country: 'Slovakia', label: 'Slovakia', code: 'SK', capital: 'Bratislava', position: [17.11, 48.15]},
  {country: 'Slovenia', label: 'Slovenia', code: 'SI', capital: 'Ljubljana', position: [14.51, 46.06]},
  {country: 'Spain', label: 'Spain', code: 'ES', capital: 'Madrid', position: [-3.7, 40.42]},
  {country: 'Sweden', label: 'Sweden', code: 'SE', capital: 'Stockholm', position: [18.07, 59.33]},
  {country: 'Switzerland', label: 'Switzerland', code: 'CH', capital: 'Bern', position: [7.45, 46.95]},
  {country: 'Ukraine', label: 'Ukraine', code: 'UA', capital: 'Kyiv', position: [30.52, 50.45]},
  {country: 'United Kingdom', label: 'United Kingdom', code: 'GB', capital: 'London', position: [-0.13, 51.51]}
];

/** A flag emoji from a two-letter country code (regional indicator symbols) */
function flag(code: string): string {
  return String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}

type Operand = 'country' | 'cap1' | 'cap2';
type Operation = 'union' | 'intersect' | 'difference';
type OptionalOperation = Operation | 'none';

const OPERATIONS: {value: Operation; symbol: string; label: string}[] = [
  {value: 'union', symbol: '∪', label: 'union'},
  {value: 'intersect', symbol: '∩', label: 'intersect'},
  {value: 'difference', symbol: '−', label: 'difference'}
];

const CAP_COLORS: [number, number, number][] = [
  [255, 160, 0],
  [0, 200, 255]
];

/** A ready-made query: countries, the two caps, and the expression (A op1 B) op2 C */
type Preset = {
  name: string;
  description: string;
  countries: string[];
  caps: [capital: string, radiusKm: number][];
  a: Operand;
  op1: Operation;
  b: Operand;
  op2: OptionalOperation;
  c: Operand;
};

const PRESETS: Preset[] = [
  {
    name: 'Abroad near Paris & Berlin',
    description:
      'Everywhere within 1000 km of Paris or Berlin, but outside France and Germany: the union of two caps, minus two countries.',
    countries: ['France', 'Germany'],
    caps: [
      ['Paris', 1000],
      ['Berlin', 1000]
    ],
    a: 'cap1',
    op1: 'union',
    b: 'cap2',
    op2: 'difference',
    c: 'country'
  },
  {
    name: 'Between Vienna & Budapest',
    description: 'Everywhere within 400 km of both Vienna and Budapest: the intersection of two caps.',
    countries: [],
    caps: [
      ['Vienna', 400],
      ['Budapest', 400]
    ],
    a: 'cap1',
    op1: 'intersect',
    b: 'cap2',
    op2: 'none',
    c: 'country'
  },
  {
    name: 'Iberia, far from capitals',
    description:
      'Spain and Portugal, more than 300 km from Madrid and more than 150 km from Lisbon: two countries minus two caps.',
    countries: ['Spain', 'Portugal'],
    caps: [
      ['Madrid', 300],
      ['Lisbon', 150]
    ],
    a: 'country',
    op1: 'difference',
    b: 'cap1',
    op2: 'difference',
    c: 'cap2'
  },
  {
    name: 'Nordics near Stockholm',
    description: 'The parts of the five Nordic countries within 600 km of Stockholm: countries intersected with a cap.',
    countries: ['Denmark', 'Finland', 'Iceland', 'Norway', 'Sweden'],
    caps: [
      ['Stockholm', 600],
      ['Oslo', 300]
    ],
    a: 'country',
    op1: 'intersect',
    b: 'cap1',
    op2: 'none',
    c: 'cap2'
  },
  {
    name: 'Benelux beyond Brussels',
    description: 'Belgium, the Netherlands and Luxembourg, more than 100 km from Brussels: countries minus a cap.',
    countries: ['Belgium', 'Netherlands', 'Luxembourg'],
    caps: [
      ['Brussels', 100],
      ['Amsterdam', 100]
    ],
    a: 'country',
    op1: 'difference',
    b: 'cap1',
    op2: 'none',
    c: 'cap2'
  }
];

const presetCaps = (preset: Preset) =>
  preset.caps.map(([capital, radiusKm]) => ({capital: CAPITALS.findIndex(c => c.capital === capital), radiusKm}));

const OPERATION_FUNCTIONS: Record<Operation, (a: BigUint64Array, b: BigUint64Array) => BigUint64Array> = {
  union,
  intersect,
  difference
};

const symbolOf = (operation: Operation) => OPERATIONS.find(o => o.value === operation)!.symbol;

/** `value`, once it has stopped changing for `delay` ms: lets sliders move freely before recomputing */
function useSettled<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return settled;
}

/** MultiPolygon parts, each as GeoJSON-style rings [outer, ...holes] */
type Polygons = [number, number][][][];

/** A great circle of `radiusKm` around `center`, as a closed path */
function capOutline(center: [number, number], radiusKm: number): [number, number][] {
  const toRad = Math.PI / 180;
  const lat1 = center[1] * toRad;
  const lon1 = center[0] * toRad;
  const d = radiusKm / EARTH_RADIUS_KM;
  const path: [number, number][] = [];
  for (let bearing = 0; bearing <= 360; bearing += 3) {
    const b = bearing * toRad;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
    const lon2 =
      lon1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    path.push([lon2 / toRad, lat2 / toRad]);
  }
  return path;
}

/** A capital's cell and the spherical cap around it, as a compacted collection */
function capCells(capitalIndex: number, radiusKm: number, resolution: number): BigUint64Array {
  const cell = lonLatToCell(CAPITALS[capitalIndex].position as LonLat, resolution);
  return sphericalCap(cell, radiusKm * 1000);
}

/** An empty collection at a resolution: no cells, just the compaction marker */
function emptyCollection(resolution: number): BigUint64Array {
  return polygonToCells([], resolution);
}

/**
 * Several collections merged into one. compact accepts collections (compaction marker
 * cells included), so a single pass merges them all
 */
function merge(collections: BigUint64Array[]): BigUint64Array {
  const cells: bigint[] = [];
  for (const collection of collections) for (const cell of collection) cells.push(cell);
  return compact(cells);
}

/** All parts of a country at a resolution, as one compacted collection */
function countryCells(polygons: Polygons, resolution: number): BigUint64Array {
  return merge(polygons.map(rings => polygonToCells(rings as LonLat[][], resolution)));
}

/** Fill color for a compacted cell: finest cells bright, coarser cells darker */
function resolutionColor(
  cellResolution: number,
  resolution: number,
  coarsest: number
): [number, number, number, number] {
  const t = resolution === coarsest ? 0 : (resolution - cellResolution) / (resolution - coarsest);
  return [Math.round(80 + 100 * (1 - t)), Math.round(120 + 115 * (1 - t)), Math.round(110 + 40 * t), 170];
}

interface DeckGLOverlayProps {
  layers: any[];
  interleaved?: boolean;
}

const fullWidth: React.CSSProperties = {width: '100%', margin: 0, display: 'block', boxSizing: 'border-box'};
const selectStyle: React.CSSProperties = {...fullWidth, fontSize: 12, padding: '2px 4px'};
const smallButton: React.CSSProperties = {fontSize: 11, padding: '0 6px', cursor: 'pointer'};

/** A toggle button: highlighted when on, faded when off */
const toggleStyle = (on: boolean, style: React.CSSProperties = {}): React.CSSProperties => ({
  cursor: 'pointer',
  background: on ? '#d6f5df' : 'transparent',
  border: on ? '1px solid #2a9d55' : '1px solid #ddd',
  borderRadius: 3,
  ...style
});
const sectionStyle: React.CSSProperties = {borderTop: '1px solid #ddd', paddingTop: 8, marginTop: 8};
const headingStyle: React.CSSProperties = {fontWeight: 'bold', marginBottom: 2};

/** A label with its value right-aligned, e.g. above a slider */
const Row: React.FC<{label: React.ReactNode; children: React.ReactNode}> = ({label, children}) => (
  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8}}>
    <span>{label}</span>
    <span style={{fontWeight: 'bold', textAlign: 'right'}}>{children}</span>
  </div>
);

const App: React.FC = () => {
  const [polygonsByCountry, setPolygonsByCountry] = useState<Record<string, Polygons>>({});
  const [resolution, setResolution] = useState(9);
  // Start from the first preset; any manual change to the query clears the preset
  const [presetIndex, setPresetIndex] = useState<number | null>(0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(PRESETS[0].countries));
  // Each country's collection, by `${country}:${resolution}`, so toggling a flag only merges
  const countryCache = useRef(new Map<string, BigUint64Array>());
  const [caps, setCaps] = useState(() => presetCaps(PRESETS[0]));
  // The expression (A op1 B) op2 C, where op2 may be 'none'
  const [operandA, setOperandA] = useState<Operand>(PRESETS[0].a);
  const [operation1, setOperation1] = useState<Operation>(PRESETS[0].op1);
  const [operandB, setOperandB] = useState<Operand>(PRESETS[0].b);
  const [operation2, setOperation2] = useState<OptionalOperation>(PRESETS[0].op2);
  const [operandC, setOperandC] = useState<Operand>(PRESETS[0].c);

  const applyPreset = (index: number) => {
    const preset = PRESETS[index];
    setPresetIndex(index);
    setSelected(new Set(preset.countries));
    setCaps(presetCaps(preset));
    setOperandA(preset.a);
    setOperation1(preset.op1);
    setOperandB(preset.b);
    setOperation2(preset.op2);
    setOperandC(preset.c);
  };
  /** Wrap a setter so that using it clears the preset */
  const edit =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setPresetIndex(null);
      setter(value);
    };

  // Sliders update the labels and cap outlines live; the cells are recomputed once they settle
  const settledResolution = useSettled(resolution, 250);
  const settledCaps = useSettled(caps, 250);

  // Load country outlines
  useEffect(() => {
    // Pre-stripped: each feature is the full MultiPolygon with only `admin` retained
    fetch('/data/ne_50m_countries_geom.geojson')
      .then(r => r.json())
      .then((data: any) => {
        const wanted = new Set(CAPITALS.map(c => c.country));
        const byCountry: Record<string, Polygons> = {};
        for (const f of data.features) {
          if (wanted.has(f.properties.admin)) byCountry[f.properties.admin] = f.geometry.coordinates;
        }
        setPolygonsByCountry(byCountry);
      })
      .catch(() => console.warn('Could not load ne_50m_countries_geom.geojson'));
  }, []);

  const loaded = Object.keys(polygonsByCountry).length > 0;

  // The three input collections, each compacted with a compaction marker recording its resolution
  const countryCollection = useMemo(() => {
    // Set operations need both sides at one resolution, so no countries is an
    // empty collection at this resolution
    if (!loaded || selected.size === 0) return emptyCollection(settledResolution);
    const collections: BigUint64Array[] = [];
    for (const name of selected) {
      const key = `${name}:${settledResolution}`;
      let cells = countryCache.current.get(key);
      if (!cells) {
        cells = countryCells(polygonsByCountry[name], settledResolution);
        countryCache.current.set(key, cells);
      }
      collections.push(cells);
    }
    return merge(collections);
  }, [polygonsByCountry, loaded, selected, settledResolution]);
  const [cap1, cap2] = useMemo(
    () => settledCaps.map(cap => capCells(cap.capital, cap.radiusKm, settledResolution)),
    [settledCaps, settledResolution]
  );

  const capLabel = (i: number) => `${CAPITALS[caps[i].capital].capital} ${caps[i].radiusKm} km`;
  const operands: Record<Operand, {label: string; cells: BigUint64Array}> = {
    country: {label: countriesLabel(selected), cells: countryCollection},
    cap1: {label: capLabel(0), cells: cap1},
    cap2: {label: capLabel(1), cells: cap2}
  };

  // The operands the expression reads: each once, however often it appears
  const usedOperands = useMemo(
    () => new Set<Operand>(operation2 === 'none' ? [operandA, operandB] : [operandA, operandB, operandC]),
    [operandA, operandB, operation2, operandC]
  );

  // The set operations, run on the compacted collections without uncompacting them
  const {result, millis, processed} = useMemo(() => {
    const a = operands[operandA].cells;
    const b = operands[operandB].cells;
    const start = performance.now();
    const ab = OPERATION_FUNCTIONS[operation1](a, b);
    const cells = operation2 === 'none' ? ab : OPERATION_FUNCTIONS[operation2](ab, operands[operandC].cells);
    const elapsed = performance.now() - start;

    let processedCount = 0n;
    let processedCompacted = 0;
    for (const operand of usedOperands) {
      processedCount += count(operands[operand].cells);
      processedCompacted += operands[operand].cells.length - 1; // without the compaction marker
    }
    return {result: cells, millis: elapsed, processed: {count: processedCount, compacted: processedCompacted}};
  }, [operandA, operation1, operandB, operation2, operandC, usedOperands, countryCollection, cap1, cap2]);

  const resultCells = useMemo(() => Array.from(result).filter(cell => !isCompactionMarker(cell)), [result]);
  const coarsest = useMemo(
    () => resultCells.reduce((min, cell) => Math.min(min, getResolution(cell)), settledResolution),
    [resultCells, settledResolution]
  );
  const stats = useMemo(
    () => ({
      compacted: resultCells.length,
      count: count(result),
      areaKm2: area(result) / 1e6,
      collectionResolution: getCompactionResolution(result)
    }),
    [result, resultCells]
  );

  /** Change one cap's capital or radius */
  const editCap = (i: number, change: Partial<{capital: number; radiusKm: number}>) => {
    setPresetIndex(null);
    setCaps(prev => prev.map((cap, j) => (j === i ? {...cap, ...change} : cap)));
  };

  const toggleCountry = (name: string) => {
    setPresetIndex(null);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  // Only the caps the expression uses are drawn
  const shownCaps = useMemo(
    () =>
      caps
        .map((cap, i) => ({...cap, color: CAP_COLORS[i]}))
        .filter((_, i) => usedOperands.has(i === 0 ? 'cap1' : 'cap2')),
    [caps, usedOperands]
  );
  const capPaths = useMemo(
    () => shownCaps.map(cap => ({path: capOutline(CAPITALS[cap.capital].position, cap.radiusKm), color: cap.color})),
    [shownCaps]
  );

  const layers = [
    new A5Layer<bigint>({
      id: 'result-cells',
      data: resultCells,
      getPentagon: d => d,
      getFillColor: d => resolutionColor(getResolution(d), settledResolution, coarsest),
      getLineColor: [255, 255, 255, 120],
      getLineWidth: 1,
      lineWidthUnits: 'pixels',
      filled: true,
      stroked: true,
      pickable: false,
      updateTriggers: {getFillColor: [settledResolution, coarsest]},
      beforeId: 'watername_ocean',
      parameters: {cullMode: 'back', depthCompare: 'always'}
    }),
    new PathLayer<{path: [number, number][]; color: [number, number, number]}>({
      id: 'cap-outlines',
      data: capPaths,
      getPath: d => d.path,
      getColor: d => [...d.color, 230] as [number, number, number, number],
      getWidth: 2,
      widthUnits: 'pixels',
      parameters: {depthCompare: 'always'}
    }),
    new ScatterplotLayer<{position: [number, number]; color: [number, number, number]}>({
      id: 'capitals',
      data: shownCaps.map(cap => ({position: CAPITALS[cap.capital].position, color: cap.color})),
      getPosition: d => d.position,
      getFillColor: d => d.color,
      getLineColor: [255, 255, 255, 255],
      getRadius: 5,
      radiusUnits: 'pixels',
      stroked: true,
      getLineWidth: 1.5,
      lineWidthUnits: 'pixels',
      parameters: {depthCompare: 'always'}
    })
  ];

  const operandSelect = (value: Operand, onChange: (value: Operand) => void, disabled = false) => (
    <select
      value={value}
      onChange={e => edit(onChange)(e.target.value as Operand)}
      style={selectStyle}
      disabled={disabled}
    >
      {(Object.keys(operands) as Operand[]).map(key => (
        <option key={key} value={key}>
          {operands[key].label}
        </option>
      ))}
    </select>
  );

  /** One button per operation, side by side; exactly one is selected */
  const operationButtons = <T extends OptionalOperation>(value: T, onChange: (value: T) => void, optional: boolean) => (
    <div style={{display: 'flex', gap: 3, gridColumn: '1 / -1'}}>
      {[...(optional ? [{value: 'none' as const, symbol: '—', label: 'none'}] : []), ...OPERATIONS].map(o => (
        <button
          key={o.value}
          title={o.label}
          onClick={() => edit(onChange)(o.value as T)}
          style={toggleStyle(value === o.value, {flex: 1, fontSize: 11, padding: '1px 0'})}
        >
          {o.symbol} {o.label}
        </button>
      ))}
    </div>
  );

  const capControls = (i: number) => (
    <div key={i} style={sectionStyle}>
      <div style={headingStyle}>
        <span style={{color: `rgb(${CAP_COLORS[i].join(',')})`}}>●</span> Cap {i + 1}
      </div>
      <select value={caps[i].capital} onChange={e => editCap(i, {capital: Number(e.target.value)})} style={selectStyle}>
        {CAPITALS.map((c, index) => (
          <option key={c.capital} value={index}>
            {c.capital} ({c.label})
          </option>
        ))}
      </select>
      <Row label="Radius">{caps[i].radiusKm} km</Row>
      <input
        type="range"
        min={100}
        max={2000}
        step={50}
        value={caps[i].radiusKm}
        onChange={e => editCap(i, {radiusKm: Number(e.target.value)})}
        style={fullWidth}
      />
    </div>
  );

  const expression =
    operation2 === 'none' ? `A ${symbolOf(operation1)} B` : `(A ${symbolOf(operation1)} B) ${symbolOf(operation2)} C`;

  return (
    <div
      style={{
        position: 'absolute',
        height: '100%',
        width: '100%',
        top: 0,
        left: 0,
        background: 'linear-gradient(0, #000, #223)'
      }}
    >
      <MapGL
        id="map"
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle="https://tiles.openfreemap.org/styles/dark"
        dragRotate={false}
        maxPitch={0}
      >
        <DeckGLOverlay layers={layers} interleaved />
      </MapGL>

      {/* Controls */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'white',
          padding: '10px 12px',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 1,
          userSelect: 'none',
          fontSize: 12,
          lineHeight: 1.7,
          width: 270,
          maxHeight: 'calc(100% - 40px)',
          overflowY: 'auto',
          boxSizing: 'border-box'
        }}
      >
        <div style={headingStyle}>Preset</div>
        <select
          value={presetIndex ?? ''}
          onChange={e => e.target.value !== '' && applyPreset(Number(e.target.value))}
          style={selectStyle}
        >
          {presetIndex === null && <option value="">Custom</option>}
          {PRESETS.map((preset, index) => (
            <option key={preset.name} value={index}>
              {preset.name}
            </option>
          ))}
        </select>
        {presetIndex !== null && (
          <div style={{color: '#555', fontSize: 11, lineHeight: 1.5, marginTop: 6}}>
            {PRESETS[presetIndex].description}
          </div>
        )}

        <div style={sectionStyle} />
        <Row label="Resolution">{resolution}</Row>
        <input
          type="range"
          min={7}
          max={13}
          value={resolution}
          onChange={e => setResolution(Number(e.target.value))}
          style={fullWidth}
        />

        <div style={sectionStyle}>
          <div style={{...headingStyle, display: 'flex', alignItems: 'center', gap: 4}}>
            <span style={{flex: 1}}>Countries ({selected.size})</span>
            <button onClick={() => edit(setSelected)(new Set(CAPITALS.map(c => c.country)))} style={smallButton}>
              All
            </button>
            <button onClick={() => edit(setSelected)(new Set())} style={smallButton}>
              None
            </button>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2}}>
            {[...CAPITALS]
              .sort((x, y) => x.label.localeCompare(y.label))
              .map(c => {
                const on = selected.has(c.country);
                return (
                  <button
                    key={c.country}
                    title={c.label}
                    onClick={() => toggleCountry(c.country)}
                    style={toggleStyle(on, {
                      fontSize: 18,
                      lineHeight: 1,
                      padding: '2px 0',
                      border: on ? '1px solid #2a9d55' : '1px solid transparent',
                      opacity: on ? 1 : 0.45
                    })}
                  >
                    {flag(c.code)}
                  </button>
                );
              })}
          </div>
        </div>

        {capControls(0)}
        {capControls(1)}

        <div style={sectionStyle}>
          <div style={headingStyle}>Set operations</div>
          <div
            style={{display: 'grid', gridTemplateColumns: '16px 1fr', columnGap: 6, rowGap: 3, alignItems: 'center'}}
          >
            <strong>A</strong>
            {operandSelect(operandA, setOperandA)}
            {operationButtons(operation1, setOperation1, false)}
            <strong>B</strong>
            {operandSelect(operandB, setOperandB)}
            {operationButtons(operation2, setOperation2, true)}
            <strong style={{opacity: operation2 === 'none' ? 0.4 : 1}}>C</strong>
            {operandSelect(operandC, setOperandC, operation2 === 'none')}
          </div>
        </div>

        <div style={sectionStyle}>
          <Row label={<strong>{expression}</strong>}>
            <span style={{color: '#888', fontWeight: 'normal'}}>{millis.toFixed(1)} ms</span>
          </Row>
          <Row label="Cells processed">
            {processed.count.toLocaleString()}{' '}
            <span style={{color: '#888', fontWeight: 'normal'}}>
              ({processed.compacted.toLocaleString()} compacted)
            </span>
          </Row>
          <Row label={`Result at res ${stats.collectionResolution}`}>
            {stats.count.toLocaleString()}{' '}
            <span style={{color: '#888', fontWeight: 'normal'}}>({stats.compacted.toLocaleString()} compacted)</span>
          </Row>
          <Row label="Area">{Math.round(stats.areaKm2).toLocaleString()} km²</Row>
          <div style={{color: '#888', fontSize: 11, marginTop: 4}}>Darker cells are coarser (compacted)</div>
        </div>
      </div>
    </div>
  );
};

/** A short label for a selection of countries */
function countriesLabel(selected: Set<string>): string {
  if (selected.size === 0) return 'No countries';
  if (selected.size === CAPITALS.length) return 'All countries';
  const flags = CAPITALS.filter(c => selected.has(c.country)).map(c => flag(c.code));
  return flags.length <= 6 ? flags.join(' ') : `${selected.size} countries`;
}

export default App;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
}

function DeckGLOverlay(props: DeckGLOverlayProps) {
  const overlay = useControl(() => new DeckOverlay(props));
  overlay.setProps(props);
  return null;
}
