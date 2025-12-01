import React, {useState} from 'react';
import './styles.css';

interface CollapsibleVizProps {
  children: React.ReactNode;
  defaultHeight?: number;
}

const CollapsibleViz: React.FC<CollapsibleVizProps> = ({children, defaultHeight = 400}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="collapsible-viz-wrapper">
      <div
        className="collapsible-viz-content"
        style={{
          maxHeight: isExpanded ? 'none' : `${defaultHeight}px`,
          overflow: isExpanded ? 'visible' : 'hidden',
          position: 'relative'
        }}
      >
        {children}
        {!isExpanded && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '150px',
            background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.7) 40%, rgba(255,255,255,0.95) 70%, rgba(255,255,255,1) 100%)',
            pointerEvents: 'none'
          }} />
        )}
      </div>
      <div style={{textAlign: 'center'}}>
        <button
          className="collapsible-viz-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Show Less' : 'Show All Data'}
        </button>
      </div>
    </div>
  );
};

export default CollapsibleViz;
