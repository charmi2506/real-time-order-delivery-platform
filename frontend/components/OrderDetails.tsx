'use client';

import React from 'react';
import { Delivery } from '@/types';

interface OrderDetailsProps {
  delivery: Delivery | null;
  onAdvanceStatus?: (orderId: string) => Promise<void>;
}

export default function OrderDetails({ delivery, onAdvanceStatus }: OrderDetailsProps) {
  if (!delivery) {
    return (
      <div className="driver-card" style={{ justifyContent: 'center', opacity: 0.6 }}>
        <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
          No delivery selected to inspect details
        </span>
      </div>
    );
  }

  const driver = delivery.driver;

  return (
    <div className="driver-card">
      <div className="driver-info">
        {/* Driver Avatar */}
        <img
          src={
            driver?.avatar ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
          }
          alt={driver?.name || 'Courier'}
          className="driver-avatar"
        />
        <div>
          <div className="driver-name">{driver?.name || 'Courier Pending Assignment'}</div>
          <div className="driver-meta">
            <span>{driver?.vehicle || 'E-Courier'}</span>
            <span>•</span>
            <span className="driver-rating">★ {driver?.rating || '4.9'}</span>
            <span>•</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {driver?.phone || '+1 555-0199'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Destination</div>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#f1f5f9',
            maxWidth: '220px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          title={delivery.deliveryAddress}
        >
          {delivery.deliveryAddress}
        </div>
        {onAdvanceStatus && delivery.status !== 'DELIVERED' && (
          <button
            type="button"
            className="btn-small"
            style={{ marginTop: '8px' }}
            onClick={() => onAdvanceStatus(delivery.orderId)}
          >
            ⚡ Fast-Forward Status
          </button>
        )}
      </div>
    </div>
  );
}
