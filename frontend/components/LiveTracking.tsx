'use client';

import React from 'react';
import { Delivery } from '@/types';

interface LiveTrackingProps {
  delivery: Delivery | null;
  onAdvanceStatus?: (orderId: string) => Promise<void>;
}

export default function LiveTracking({ delivery, onAdvanceStatus }: LiveTrackingProps) {
  const renderMapVisual = () => {
    if (!delivery || !delivery.routeWaypoints || delivery.routeWaypoints.length < 2) {
      return (
        <div className="empty-state">
          <div className="empty-icon">🗺️</div>
          <p>No active delivery route selected.</p>
          <span style={{ fontSize: '12px', marginTop: '6px' }}>
            Dispatch an order to see live radar tracking.
          </span>
        </div>
      );
    }

    const waypoints = delivery.routeWaypoints;
    const pickup = delivery.pickupLocation || waypoints[0];
    const destination = delivery.destinationLocation || waypoints[waypoints.length - 1];
    const current = delivery.currentLocation || pickup;

    // Normalization to SVG 600x380 viewbox
    const lats = waypoints.map((w) => w.lat);
    const lngs = waypoints.map((w) => w.lng);
    const minLat = Math.min(...lats, pickup.lat, destination.lat) - 0.005;
    const maxLat = Math.max(...lats, pickup.lat, destination.lat) + 0.005;
    const minLng = Math.min(...lngs, pickup.lng, destination.lng) - 0.005;
    const maxLng = Math.max(...lngs, pickup.lng, destination.lng) + 0.005;

    const toSvgX = (lng: number) => {
      const norm = (lng - minLng) / (maxLng - minLng || 0.01);
      return Math.round(50 + norm * 500);
    };

    const toSvgY = (lat: number) => {
      // Invert Y because latitude goes north (up) but SVG Y goes down
      const norm = (lat - minLat) / (maxLat - minLat || 0.01);
      return Math.round(330 - norm * 280);
    };

    const pathData = waypoints
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(pt.lng)} ${toSvgY(pt.lat)}`)
      .join(' ');

    const curX = toSvgX(current.lng);
    const curY = toSvgY(current.lat);
    const pickupX = toSvgX(pickup.lng);
    const pickupY = toSvgY(pickup.lat);
    const destX = toSvgX(destination.lng);
    const destY = toSvgY(destination.lat);

    return (
      <svg className="map-canvas-svg" viewBox="0 0 600 380">
        <defs>
          {/* Street Grid Pattern */}
          <pattern id="street-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          </pattern>
          {/* Linear Route Glow Gradient */}
          <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.9" />
          </linearGradient>
          {/* Courier Pulse Glow */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#38bdf8" />
          </filter>
        </defs>

        {/* Background Grid */}
        <rect width="100%" height="100%" fill="#0a0f1d" />
        <rect width="100%" height="100%" fill="url(#street-grid)" />

        {/* Simulated Metro Blocks */}
        <rect x="70" y="50" width="80" height="60" rx="4" fill="rgba(255,255,255,0.015)" />
        <rect x="180" y="70" width="100" height="70" rx="4" fill="rgba(255,255,255,0.015)" />
        <rect x="310" y="40" width="90" height="90" rx="4" fill="rgba(255,255,255,0.015)" />
        <rect x="430" y="80" width="110" height="60" rx="4" fill="rgba(255,255,255,0.015)" />
        <rect x="90" y="160" width="120" height="80" rx="4" fill="rgba(255,255,255,0.015)" />
        <rect x="240" y="180" width="130" height="70" rx="4" fill="rgba(255,255,255,0.015)" />
        <rect x="400" y="190" width="90" height="100" rx="4" fill="rgba(255,255,255,0.015)" />
        <rect x="120" y="270" width="140" height="60" rx="4" fill="rgba(255,255,255,0.015)" />
        <rect x="300" y="280" width="120" height="50" rx="4" fill="rgba(255,255,255,0.015)" />

        {/* Planned Route Line (Dotted Background) */}
        <path d={pathData} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" strokeDasharray="6 6" />

        {/* Active Route Gradient Line */}
        <path
          d={pathData}
          fill="none"
          stroke="url(#routeGradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pickup Pin */}
        <g transform={`translate(${pickupX}, ${pickupY})`}>
          <circle r="14" fill="rgba(99, 102, 241, 0.2)" />
          <circle r="8" fill="#6366f1" />
          <circle r="3" fill="#ffffff" />
          <text y="-14" textAnchor="middle" fill="#a5b4fc" fontSize="10" fontWeight="700">
            KITCHEN / HUB
          </text>
        </g>

        {/* Destination Pin */}
        <g transform={`translate(${destX}, ${destY})`}>
          <circle r="14" fill="rgba(16, 185, 129, 0.2)" />
          <circle r="8" fill="#10b981" />
          <circle r="3" fill="#ffffff" />
          <text y="-14" textAnchor="middle" fill="#6ee7b7" fontSize="10" fontWeight="700">
            CUSTOMER
          </text>
        </g>

        {/* Live Courier / Driver Marker */}
        <g transform={`translate(${curX}, ${curY})`} filter="url(#glow)">
          {/* Pulsing ring */}
          <circle r="18" fill="none" stroke="#38bdf8" strokeWidth="2" opacity="0.7">
            <animate attributeName="r" values="10;22;10" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
          </circle>

          {/* Vehicle Icon Circle with Rotation */}
          <g transform={`rotate(${delivery.currentLocation?.heading || 0})`}>
            <circle r="11" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
            {/* Direction Arrow */}
            <polygon points="0,-7 5,5 -5,5" fill="#ffffff" />
          </g>

          {/* Tag */}
          <text y="24" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="800">
            {delivery.driver?.name?.split(' ')[0]} ({delivery.progressPercent || 0}%)
          </text>
        </g>
      </svg>
    );
  };

  return (
    <div className="glass-panel" style={{ padding: '16px' }}>
      <div className="section-head" style={{ padding: '0 0 14px', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
            Real-Time GPS Route Radar
          </span>
          {delivery && (
            <span
              style={{
                fontSize: '12px',
                color: 'var(--accent-cyan)',
                fontFamily: 'var(--font-mono)'
              }}
            >
              [{delivery.orderId.substring(0, 8)}]
            </span>
          )}
        </div>

        {delivery && delivery.status !== 'DELIVERED' && onAdvanceStatus && (
          <button
            type="button"
            className="btn-small"
            onClick={() => onAdvanceStatus(delivery.orderId)}
          >
            ⚡ Fast-Forward Status
          </button>
        )}
      </div>

      <div className="map-container">
        {renderMapVisual()}

        {/* Map Floating Telemetry HUD */}
        {delivery && (
          <>
            <div className="map-overlay-badge">
              <span className="pulse-dot" />
              <span>
                {delivery.status === 'DELIVERED'
                  ? 'Package Delivered'
                  : `Progress: ${delivery.progressPercent || 0}% • ETA: ~${
                      delivery.estimatedDeliveryMinutes || 1
                    } min`}
              </span>
            </div>

            <div className="map-controls">
              <div
                className="status-pill"
                style={{ background: 'rgba(0,0,0,0.75)', fontSize: '11px' }}
              >
                Lat: {delivery.currentLocation?.lat?.toFixed(4) || '0.0000'} | Lng:{' '}
                {delivery.currentLocation?.lng?.toFixed(4) || '0.0000'}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
