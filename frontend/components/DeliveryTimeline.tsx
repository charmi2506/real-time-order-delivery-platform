'use client';

import React from 'react';
import { Delivery, OrderStatus } from '@/types';

interface DeliveryTimelineProps {
  delivery: Delivery | null;
}

interface StatusStep {
  key: OrderStatus;
  label: string;
}

const STATUS_STEPS: StatusStep[] = [
  { key: 'PLACED', label: 'Placed' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PICKED_UP', label: 'Picked Up' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { key: 'DELIVERED', label: 'Delivered' }
];

export default function DeliveryTimeline({ delivery }: DeliveryTimelineProps) {
  const currentStepIdx = delivery
    ? STATUS_STEPS.findIndex((s) => s.key === delivery.status)
    : 0;

  const stepFillPercent =
    currentStepIdx >= 0
      ? (currentStepIdx / (STATUS_STEPS.length - 1)) * 100
      : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Stepper Progress Bar */}
      <div className="stepper-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>
            Delivery Lifecycle Progress
          </span>
          <span
            style={{
              fontSize: '12px',
              color: 'var(--accent-cyan)',
              fontFamily: 'var(--font-mono)'
            }}
          >
            {delivery?.status ? delivery.status.replace(/_/g, ' ') : 'NO ACTIVE SELECTION'}
          </span>
        </div>

        <div className="stepper-bar">
          <div className="stepper-track-bg" />
          <div
            className="stepper-track-fill"
            style={{ width: `${stepFillPercent}%` }}
          />

          {STATUS_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStepIdx;
            const isActive = idx === currentStepIdx;
            return (
              <div
                key={step.key}
                className={`step-node ${isCompleted ? 'completed' : ''} ${
                  isActive ? 'active' : ''
                }`}
              >
                <div className="step-circle">
                  {isCompleted ? '✓' : idx + 1}
                </div>
                <span className="step-label">{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit Trail / History */}
      {delivery && delivery.history && delivery.history.length > 0 && (
        <div className="glass-panel" style={{ padding: '16px' }}>
          <div className="section-head" style={{ padding: '0 0 12px', border: 'none' }}>
            <span className="section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Audit Trail & Event History
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              Real-time Kafka Log
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {delivery.history.map((h, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                  fontSize: '12px'
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background:
                      h.status === 'DELIVERED'
                        ? 'var(--accent-emerald)'
                        : 'var(--accent-cyan)',
                    marginTop: '5px',
                    flexShrink: 0
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      color: '#e2e8f0',
                      fontWeight: 600
                    }}
                  >
                    <span>{h.status.replace(/_/g, ' ')}</span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-dim)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {new Date(h.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {h.note}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
