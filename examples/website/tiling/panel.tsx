// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {useLayoutEffect, useState} from 'react';

// Panel furniture shared by the Tiling and Conway examples, following the
// white control panel the other examples use.

export const MUTED = '#666';

export const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: '20px',
  left: '20px',
  width: '230px',
  boxSizing: 'border-box',
  background: 'white',
  padding: '10px',
  borderRadius: '4px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  zIndex: 2,
  fontSize: '12px',
  lineHeight: '1.5',
  color: '#222'
};

export const sectionStyle: React.CSSProperties = {marginTop: 10, paddingTop: 10, borderTop: '1px solid #ccc'};

export function Check({
  label,
  checked,
  disabled,
  title,
  onChange
}: {
  label: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  title?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginTop: '4px',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        style={{margin: 0}}
      />
      {label}
    </label>
  );
}

/** Size of the element `ref` points at, kept current as it resizes */
export function useElementSize(ref: React.RefObject<HTMLElement>): {width: number; height: number} {
  const [size, setSize] = useState({width: 0, height: 0});
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setSize({width: element.clientWidth, height: element.clientHeight});
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
