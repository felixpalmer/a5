import React, {useState} from 'react';
import './styles.css';

interface CollapsibleVizProps {
  children: React.ReactNode;
  defaultHeight?: number;
}

const CollapsibleViz: React.FC<CollapsibleVizProps> = ({children, defaultHeight = 500}) => {
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
      <div style={{textAlign: 'center', margin: '20px 0'}}>
        <button
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 24px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '999px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#059669';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#10b981';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span>{isExpanded ? 'Show Less' : 'Show All Data'}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            style={{
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default CollapsibleViz;
