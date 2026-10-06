'use client';

import React from 'react';
import { TelemetryLog } from '@/types';

interface EventStreamProps {
  logs: TelemetryLog[];
}

export default function EventStream({ logs }: EventStreamProps) {
  return (
    <div className="glass-panel">
      <div className="section-head">
        <span className="section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 17l6-6-6-6M12 19h8" />
          </svg>
          Live Event Bus Stream
        </span>
        <span
          style={{
            fontSize: '10px',
            background: 'rgba(245,158,11,0.2)',
            color: '#fbbf24',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 700
          }}
        >
          KAFKA & WS
        </span>
      </div>

      <div className="event-log-container">
        {logs.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px 10px' }}>
            <p>Awaiting event stream triggers...</p>
            <span style={{ fontSize: '10px', marginTop: '4px' }}>
              Dispatch an order to see live Kafka telemetry!
            </span>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={`event-log-entry ${log.type}`}>
              <div className="event-timestamp">{log.time}</div>
              <div className="event-message">{log.message}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
