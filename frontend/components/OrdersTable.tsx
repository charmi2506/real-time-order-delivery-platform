'use client';

import React from 'react';
import { Delivery } from '@/types';

interface OrdersTableProps {
  deliveries: Delivery[];
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
  onClearDeliveries: () => Promise<void>;
}

export default function OrdersTable({
  deliveries,
  selectedOrderId,
  onSelectOrder,
  onClearDeliveries
}: OrdersTableProps) {
  return (
    <div className="glass-panel">
      <div className="section-head">
        <span className="section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Tracked Orders ({deliveries.length})
        </span>
        {deliveries.length > 0 && (
          <button
            type="button"
            onClick={onClearDeliveries}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-rose)',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600
            }}
          >
            Clear All
          </button>
        )}
      </div>

      <div className="orders-list">
        {deliveries.length === 0 ? (
          <div className="empty-state">
            <p>No orders currently active.</p>
            <span style={{ fontSize: '11px', marginTop: '4px' }}>
              Create one above to begin live Kafka stream!
            </span>
          </div>
        ) : (
          deliveries.map((item) => {
            const isSelected = item.orderId === selectedOrderId;
            return (
              <div
                key={item.orderId}
                className={`order-item-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectOrder(item.orderId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelectOrder(item.orderId);
                  }
                }}
              >
                <div className="order-card-header">
                  <span className="order-customer">{item.customerName}</span>
                  <span className={`status-tag ${item.status}`}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="order-product-text">
                  {item.product} (x{item.quantity})
                </div>
                <div className="order-time-text">
                  ID: {item.orderId.substring(0, 8)}... • {item.driver?.name || 'Assigning courier'}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
