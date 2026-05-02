// src/components/RealBuilding3D.jsx
'use client';

import React from 'react';

export default function RealBuilding3D({ thickness = 80, greenOn = true }) {
  return (
    <div style={{ 
      width: '100%', 
      height: '500px', 
      borderRadius: '12px',
      overflow: 'hidden',
      position: 'relative',
      background: '#1a1a2e'
    }}>
      {/* Sketchfab Embed */}
      <iframe 
        title="BINONDOMINIUM - Bifacial PV + Green Wall Building" 
        frameBorder="0" 
        allowFullScreen
        mozAllowFullScreen="true" 
        webkitAllowFullScreen="true" 
        allow="autoplay; fullscreen; xr-spatial-tracking" 
        src="https://sketchfab.com/models/2d0e2b5fd5474770b953cbf23835624a/embed"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
      
      {/* Green Wall Thickness Indicator Overlay */}
      {greenOn && thickness > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          padding: '6px 14px',
          borderRadius: '20px',
          fontSize: '12px',
          fontFamily: 'monospace',
          color: '#4ade80',
          border: '1px solid rgba(74,222,128,0.3)',
          pointerEvents: 'none',
          zIndex: 10
        }}>
          🌿 Green Wall: {thickness}mm
        </div>
      )}
      
      {/* Instructions */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        background: 'rgba(0,0,0,0.5)',
        padding: '4px 10px',
        borderRadius: '16px',
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#aaa',
        pointerEvents: 'none',
        zIndex: 10
      }}>
        🖱️ Drag to rotate | Right-click to pan | Scroll to zoom
      </div>
    </div>
  );
}