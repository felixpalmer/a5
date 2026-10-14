// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

/* global requestAnimationFrame, cancelAnimationFrame */
import React, {useEffect, useState} from 'react';
import {styled, withStyles} from '@material-ui/core/styles';
import Slider from '@material-ui/core/Slider';
import Button from '@material-ui/core/IconButton';
import PlayIcon from '@material-ui/icons/PlayArrow';
import PauseIcon from '@material-ui/icons/Pause';

const PositionContainer = styled('div')({
  position: 'absolute',
  zIndex: 1,
  // Centered on the top edge of its container
  top: 0,
  transform: 'translateY(-50%)',
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
});

const SliderInput = withStyles({
  root: {
    marginLeft: 12,
    width: '40%'
  }
})(Slider);

// The play button, light on the dark views and dimmed (not black) when disabled
const PlayButton = withStyles({
  root: {color: '#e8e5de'},
  disabled: {color: 'rgba(232, 229, 222, 0.35) !important'}
})(Button);

export default function RangeInput({
  min,
  max,
  value,
  animationSpeed,
  onChange
}: {
  min: number;
  max: number;
  value: [start: number, end: number];
  animationSpeed: number;
  onChange: (value: [start: number, end: number]) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [animation] = useState<{
    id?: number;
  }>({});

  // prettier-ignore
  useEffect(() => {
    return () => animation.id && cancelAnimationFrame(animation.id);
  }, [animation]);

  if (isPlaying && !animation.id) {
    const span = value[1] - value[0];
    let nextValueMin = value[0] + animationSpeed;
    if (nextValueMin + span >= max) {
      nextValueMin = min;
    }
    animation.id = requestAnimationFrame(() => {
      animation.id = 0;
      onChange([nextValueMin, nextValueMin + span]);
    });
  }

  const isButtonEnabled = value[0] > min || value[1] < max;

  return (
    <PositionContainer>
      <PlayButton
        disabled={!isButtonEnabled}
        onClick={() => setIsPlaying(!isPlaying)}
        title={isPlaying ? 'Stop' : 'Animate'}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </PlayButton>
      <SliderInput min={min} max={max} value={value} onChange={(_, newValue: [number, number]) => onChange(newValue)} />
    </PositionContainer>
  );
}
