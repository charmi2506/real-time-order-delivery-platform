'use client';

import React, { useState } from 'react';
import { OrderPreset } from '@/types';

interface OrderFormProps {
  onSubmit: (data: {
    customerName: string;
    product: string;
    quantity: number;
    deliveryAddress: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}

const PRESETS: OrderPreset[] = [
  { customer: 'Sarah Connor', product: 'Gourmet Margherita Pizza + Drink', qty: 2, address: '104 Cyberdyne Way, Tech Hub' },
  { customer: 'Marcus Brody', product: 'Wagyu Smash Burger Bundle', qty: 1, address: '88 Museum Row, Downtown' },
  { customer: 'Elena Rostova', product: 'Tokyo Tonkotsu Ramen Set', qty: 3, address: '500 Neo Tokyo Blvd, Apt 4B' },
  { customer: 'David Miller', product: 'Artisan Espresso & Organic Acai', qty: 1, address: '22 Ocean Promenade, Pier 9' }
];

export default function OrderForm({ onSubmit, isSubmitting }: OrderFormProps) {
  const [customerName, setCustomerName] = useState('Sarah Connor');
  const [product, setProduct] = useState('Gourmet Margherita Pizza + Drink');
  const [quantity, setQuantity] = useState(2);
  const [deliveryAddress, setDeliveryAddress] = useState('104 Cyberdyne Way, Tech Hub');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !product || !deliveryAddress) return;
    await onSubmit({ customerName, product, quantity: Number(quantity), deliveryAddress });
  };

  const handleSelectPreset = (p: OrderPreset) => {
    setCustomerName(p.customer);
    setProduct(p.product);
    setQuantity(p.qty);
    setDeliveryAddress(p.address);
  };

  return (
    <div className="glass-panel">
      <div className="section-head">
        <span className="section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Place New Order
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Go Order API (Port 8080)</span>
      </div>

      <form onSubmit={handleSubmit} className="order-creation-panel">
        <div className="form-group">
          <label className="form-label">Customer Name</label>
          <input
            type="text"
            className="form-input"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g. Sarah Connor"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Product / Bundle</label>
          <input
            type="text"
            className="form-input"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="e.g. Artisan Pizza Bundle"
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
          <div className="form-group">
            <label className="form-label">Quantity</label>
            <input
              type="number"
              min="1"
              className="form-input"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Delivery Address</label>
            <input
              type="text"
              className="form-input"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="e.g. 104 Cyberdyne Way"
              required
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Publishing to Kafka...' : 'Dispatch Order (Kafka Event)'}
        </button>

        <div style={{ marginTop: '16px' }}>
          <span className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Demo Presets:</span>
          <div className="quick-order-chips">
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                className="quick-chip"
                onClick={() => handleSelectPreset(p)}
              >
                <span style={{ fontWeight: '600' }}>{p.product}</span>
                <span>Qty: {p.qty}</span>
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
