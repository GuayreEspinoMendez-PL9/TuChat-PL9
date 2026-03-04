import React from 'react';
import Svg, { Path } from 'react-native-svg';

export const MicIcon = ({ muted }: { muted: boolean }) => (
  <Svg viewBox="0 0 24 24" fill="none" stroke={muted ? "#ef4444" : "#fff"} strokeWidth={2} style={{ width: 24, height: 24 }}>
    {muted ? (
      <>
        <Path d="M2 2l20 20M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 19v4M8 23h8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ) : (
      <>
        <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <Path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    )}
  </Svg>
);

export const VideoIcon = ({ disabled }: { disabled: boolean }) => (
  <Svg viewBox="0 0 24 24" fill="none" stroke={disabled ? "#ef4444" : "#fff"} strokeWidth={2} style={{ width: 24, height: 24 }}>
    {disabled ? (
      <>
        <Path d="m2 2 20 20M10.66 5H14l3.5 3.5v6.17" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M14 18h-6L4 14V8.83M16 16v2l4 2V4l-4 2v4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ) : (
      <Path d="m16 10 4-4v12l-4-4M2 6h12v12H2z" strokeLinecap="round" strokeLinejoin="round" />
    )}
  </Svg>
);

export const ScreenShareIcon = () => (
  <Svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} style={{ width: 24, height: 24 }}>
    <Path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="m8 21 4-4 4 4M12 17v4" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="m17 8 5-5M22 8h-5V3" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);