import React, {useState, useCallback, useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map} from 'react-map-gl/maplibre';
import {ScatterplotLayer} from '@deck.gl/layers';
import {A5Layer} from '@deck.gl/geo-layers';
import {lonLatToCell, cellToChildren, cellToParent, cellToSubcell, cellToSupercell, uncompact} from 'a5';
import DeckGL from '@deck.gl/react';
import {MapView} from '@deck.gl/core';
import A5CellInfoBox from '../components/a5-cell-info-box';

const MAX_RESOLUTION = 30;

const INITIAL_VIEW_STATE = {longitude: -0.1276, latitude: 51.50735, zoom: 10, minZoom: 2, maxZoom: 27};

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';

const A5GREEN = [0, 170, 85] as [number, number, number];
const A5GREEN_DARK = [0, 128, 64] as [number, number, number];
const GREY = [160, 160, 160, 255] as [number, number, number, number];
const ORANGE = [255, 160, 40, 255] as [number, number, number, number];

const App: React.FC<{showCellId?: boolean; height?: string}> = ({showCellId = true, height = '100%'}) => {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [cellLocation, setCellLocation] = useState([INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude]);
  const [showChildren, setShowChildren] = useState(false);
  const [showParent, setShowParent] = useState(false);
  const [showSubcells, setShowSubcells] = useState(false);
  const [showSupercell, setShowSupercell] = useState(false);
  const [relativeResolution, setRelativeResolution] = useState(1);

  const onViewStateChange = useCallback(
    ({viewState}) => {
      const [longitude, latitude] = cellLocation;
      setViewState({...INITIAL_VIEW_STATE, zoom: viewState.zoom, longitude, latitude});
    },
    [cellLocation]
  );

  const handleMapClick = useCallback(event => {
    const [longitude, latitude] = event.coordinate;
    setViewState(viewState => ({...viewState, longitude, latitude}));
    setCellLocation([longitude, latitude]);
  }, []);

  // Calculate resolution based on zoom level
  let resolution = Math.min(Math.floor(2 * viewState.zoom - 5), Math.floor(viewState.zoom));
  resolution = Math.max(0, Math.min(MAX_RESOLUTION, resolution));

  // The index hierarchy (children, parent) and the spatial one (subcells, supercell),
  // `relativeResolution` levels finer and coarser than the cell
  const data = useMemo(() => {
    const cellId = lonLatToCell(cellLocation, resolution);
    const finer = Math.min(MAX_RESOLUTION, resolution + relativeResolution);
    const coarser = Math.max(0, resolution - relativeResolution);
    return {
      cellId,
      children: showChildren ? cellToChildren(cellId, finer) : [],
      parent: showParent && coarser < resolution ? [cellToParent(cellId, coarser)] : [],
      subcells: showSubcells ? uncompact(cellToSubcell(cellId, finer)) : [],
      supercell: showSupercell && coarser < resolution ? [cellToSupercell(cellId, coarser)] : []
    };
  }, [resolution, cellLocation, showChildren, showParent, showSubcells, showSupercell, relativeResolution]);

  const outline = (id: string, cells: bigint[], color: [number, number, number, number], width: number) =>
    new A5Layer({
      id,
      data: cells,
      getPentagon: d => d,
      stroked: true,
      filled: false,
      getLineColor: color,
      getLineWidth: width,
      lineWidthUnits: 'pixels'
    });

  const subcellLayer = new A5Layer({
    id: 'subcells',
    data: data.subcells,
    getPentagon: d => d,
    stroked: true,
    filled: true,
    getFillColor: [255, 160, 40, 60],
    getLineColor: ORANGE,
    getLineWidth: 1,
    lineWidthUnits: 'pixels'
  });

  const cellLayers = [
    subcellLayer,
    outline('children', data.children, GREY, 1),
    outline('parent', data.parent, GREY, 1),
    outline('supercell', data.supercell, ORANGE, 2),
    outline('cell', [data.cellId], [...A5GREEN, 255] as [number, number, number, number], 2)
  ];

  const scatterplotLayer = new ScatterplotLayer({
    id: 'source-point',
    data: [cellLocation],
    getPosition: d => d,
    getFillColor: A5GREEN_DARK,
    getRadius: 5,
    radiusUnits: 'pixels',
    pickable: true,
    stroked: true,
    getLineColor: [255, 255, 255, 255],
    getLineWidth: 2,
    lineWidthUnits: 'pixels'
  });

  return (
    <div style={{position: 'relative', width: '100%', height}}>
      <DeckGL
        views={new MapView({repeat: true})}
        layers={[...cellLayers, scatterplotLayer]}
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        controller={{dragRotate: false}}
        onClick={handleMapClick}
      >
        <Map mapStyle={MAP_STYLE} maxZoom={24} />
      </DeckGL>
      {showCellId && (
        <A5CellInfoBox
          location={cellLocation}
          resolution={resolution}
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            maxWidth: 'calc(100% - 40px)',
            overflow: 'auto'
          }}
        >
          <div style={{marginTop: '10px'}}>
            <label style={{marginRight: '15px'}}>
              <input type="checkbox" checked={showChildren} onChange={e => setShowChildren(e.target.checked)} />
              Show children
            </label>
            <label>
              <input type="checkbox" checked={showParent} onChange={e => setShowParent(e.target.checked)} />
              Show parent
            </label>
          </div>
          <div style={{marginTop: '5px'}}>
            <label style={{marginRight: '15px', color: 'rgb(255, 160, 40)'}}>
              <input type="checkbox" checked={showSubcells} onChange={e => setShowSubcells(e.target.checked)} />
              Show subcells
            </label>
            <label style={{color: 'rgb(255, 160, 40)'}}>
              <input type="checkbox" checked={showSupercell} onChange={e => setShowSupercell(e.target.checked)} />
              Show supercell
            </label>
          </div>
          <div style={{marginTop: '5px'}}>
            <label>
              Relative resolution: {relativeResolution}
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={relativeResolution}
                onChange={e => setRelativeResolution(Number(e.target.value))}
                style={{marginLeft: '10px', verticalAlign: 'middle'}}
              />
            </label>
          </div>
        </A5CellInfoBox>
      )}
    </div>
  );
};

export default App;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
}
