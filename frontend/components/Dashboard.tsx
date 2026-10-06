'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Delivery, BackendHealth, TelemetryLog, WebSocketMessage } from '@/types';
import OrderForm from '@/components/OrderForm';
import OrdersTable from '@/components/OrdersTable';
import OrderDetails from '@/components/OrderDetails';
import DeliveryTimeline from '@/components/DeliveryTimeline';
import LiveTracking from '@/components/LiveTracking';
import EventStream from '@/components/EventStream';

const ORDER_API = process.env.NEXT_PUBLIC_ORDER_API_URL || 'http://localhost:8080';
const DELIVERY_API = process.env.NEXT_PUBLIC_DELIVERY_API_URL || 'http://localhost:5000';
const DELIVERY_WS = process.env.NEXT_PUBLIC_DELIVERY_WS_URL || 'ws://localhost:5000';

export default function Dashboard() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [backendHealth, setBackendHealth] = useState<BackendHealth>({
    order: false,
    delivery: false,
    kafka: false,
    redis: false
  });
  const [logs, setLogs] = useState<TelemetryLog[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Telemetry logger
  const addLog = useCallback(
    (message: string, type: TelemetryLog['type'] = 'info') => {
      setLogs((prev) => [
        {
          id: Math.random().toString(36).substring(2, 9),
          time: new Date().toLocaleTimeString(),
          type,
          message
        },
        ...prev.slice(0, 49)
      ]);
    },
    []
  );

  // 1. Health Checks
  useEffect(() => {
    const checkHealth = async () => {
      try {
        let orderOk = false;
        try {
          const orderRes = await fetch(`${ORDER_API}/health`);
          orderOk = orderRes.ok;
        } catch (_) {
          orderOk = false;
        }

        let delOk = false;
        let redisOk = false;
        let kafkaOk = false;
        try {
          const delRes = await fetch(`${DELIVERY_API}/health`);
          if (delRes.ok) {
            const delData = await delRes.json();
            delOk = true;
            redisOk = !!delData.redis;
            kafkaOk = !!delData.kafka;
          }
        } catch (_) {
          delOk = false;
        }

        setBackendHealth({
          order: orderOk,
          delivery: delOk,
          redis: redisOk,
          kafka: kafkaOk
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.warn('Health check warning:', errorMsg);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Initial Deliveries via REST
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const res = await fetch(`${DELIVERY_API}/api/deliveries`);
        if (res.ok) {
          const data: Delivery[] = await res.json();
          setDeliveries(data);
          if (data.length > 0) {
            setSelectedOrderId((prev) => prev || data[0].orderId);
          }
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.warn('Could not fetch deliveries from delivery service:', errorMsg);
      }
    };
    fetchInitial();
  }, []);

  // 3. Connect to Real-time WebSocket
  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const connectWs = () => {
      if (isUnmounted) return;
      try {
        const ws = new WebSocket(DELIVERY_WS);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) return;
          setWsConnected(true);
          addLog(`Connected to Real-Time Delivery WebSocket Stream (${DELIVERY_WS})`, 'ws');
          ws.send(JSON.stringify({ type: 'SUBSCRIBE_ALL' }));
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const data: WebSocketMessage = JSON.parse(event.data);
            handleWsMessage(data);
          } catch (e) {
            console.error('Error parsing WS message', e);
          }
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setWsConnected(false);
          addLog(`WebSocket stream disconnected. Reconnecting in 3s...`, 'warning');
          reconnectTimeout = setTimeout(connectWs, 3000);
        };

        ws.onerror = (err) => {
          console.warn('WebSocket error', err);
          ws.close();
        };
      } catch (e) {
        reconnectTimeout = setTimeout(connectWs, 3000);
      }
    };

    connectWs();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, [addLog]);

  // Handle Incoming WebSocket Events
  const handleWsMessage = (data: WebSocketMessage) => {
    switch (data.type) {
      case 'INITIAL_STATE':
        if (Array.isArray(data.deliveries)) {
          setDeliveries(data.deliveries);
          if (data.deliveries.length > 0) {
            setSelectedOrderId((prev) => prev || data.deliveries[0].orderId);
          }
        }
        break;

      case 'ORDER_INGESTED':
        addLog(`[Kafka:order.created] Ingested order ${data.orderId.slice(0, 8)}...`, 'kafka');
        setDeliveries((prev) => {
          const filtered = prev.filter((d) => d.orderId !== data.orderId);
          return [data.delivery, ...filtered];
        });
        setSelectedOrderId(data.orderId);
        break;

      case 'STATUS_UPDATE':
        addLog(
          `[Status:${data.status}] Order ${data.orderId.slice(0, 8)} updated`,
          data.status === 'DELIVERED' ? 'delivered' : 'order'
        );
        setDeliveries((prev) =>
          prev.map((d) =>
            d.orderId === data.orderId ? { ...d, ...data.delivery, status: data.status } : d
          )
        );
        break;

      case 'LOCATION_UPDATE':
        setDeliveries((prev) =>
          prev.map((d) => {
            if (d.orderId === data.orderId) {
              return {
                ...d,
                currentLocation: data.location,
                progressPercent: data.progressPercent,
                estimatedDeliveryMinutes: data.etaMinutes,
                driver: data.driver || d.driver
              };
            }
            return d;
          })
        );
        break;

      case 'DELIVERIES_CLEARED':
        setDeliveries([]);
        setSelectedOrderId(null);
        addLog(`Demo delivery state cleared`, 'info');
        break;

      default:
        break;
    }
  };

  // Submit Order to Go Order Service
  const handleCreateOrder = async (orderData: {
    customerName: string;
    product: string;
    quantity: number;
    deliveryAddress: string;
  }) => {
    setIsSubmitting(true);
    addLog(`Submitting new order to Go Order Service (${ORDER_API}/api/orders)...`, 'order');

    try {
      const res = await fetch(`${ORDER_API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (!res.ok) {
        throw new Error(`Order Service returned HTTP ${res.status}`);
      }

      const newOrder = await res.json();
      addLog(
        `Order ${newOrder.id.slice(0, 8)} saved in PostgreSQL & published to Kafka!`,
        'kafka'
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addLog(`Failed to place order: ${errorMsg}. Trying direct simulation...`, 'warning');
      try {
        await fetch(`${DELIVERY_API}/api/deliveries/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        });
      } catch (simErr: unknown) {
        const simMsg = simErr instanceof Error ? simErr.message : String(simErr);
        addLog(`Simulation error: ${simMsg}`, 'warning');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fast-Forward Status
  const handleAdvanceStatus = async (orderId: string) => {
    if (!orderId) return;
    try {
      addLog(`Triggering fast-forward for order ${orderId.slice(0, 8)}...`, 'info');
      await fetch(`${DELIVERY_API}/api/deliveries/${orderId}/advance`, { method: 'POST' });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addLog(`Error advancing order: ${errorMsg}`, 'warning');
    }
  };

  // Clear deliveries
  const handleClearDeliveries = async () => {
    try {
      await fetch(`${DELIVERY_API}/api/deliveries/clear`, { method: 'DELETE' });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addLog(`Error clearing deliveries: ${errorMsg}`, 'warning');
    }
  };

  // Selected delivery
  const activeDelivery = deliveries.find((d) => d.orderId === selectedOrderId) || deliveries[0] || null;

  // Derived Metrics
  const activeCount = deliveries.filter((d) => d.status !== 'DELIVERED').length;
  const deliveredCount = deliveries.filter((d) => d.status === 'DELIVERED').length;
  const inTransitCount = deliveries.filter((d) => d.status === 'OUT_FOR_DELIVERY').length;

  return (
    <main className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="brand-wrapper">
          <div className="brand-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h1 className="brand-title">AuraTrack</h1>
            <div className="brand-subtitle">
              <span>Real-Time Distributed Order & Delivery Platform</span>
              <span className="badge-arch">Go • Kafka • Redis • Node.js • Next.js</span>
            </div>
          </div>
        </div>

        {/* Real-time System Connectivity Status */}
        <div className="system-status-bar">
          <div className="status-pill">
            <span className={`pulse-dot ${backendHealth.order ? '' : 'offline'}`} />
            <span>Go API: <strong>{backendHealth.order ? '8080' : 'Offline'}</strong></span>
          </div>

          <div className="status-pill">
            <span className={`pulse-dot ${backendHealth.kafka ? '' : 'warning'}`} />
            <span>Kafka: <strong>{backendHealth.kafka ? '9092' : 'Connecting'}</strong></span>
          </div>

          <div className="status-pill">
            <span className={`pulse-dot ${backendHealth.redis ? '' : 'offline'}`} />
            <span>Redis: <strong>{backendHealth.redis ? '6379' : 'Offline'}</strong></span>
          </div>

          <div className="status-pill">
            <span className={`pulse-dot ${wsConnected ? '' : 'offline'}`} />
            <span>WS Stream: <strong>{wsConnected ? 'Connected' : 'Reconnecting'}</strong></span>
          </div>
        </div>
      </header>

      {/* Metrics Row */}
      <section className="metrics-row">
        <div className="glass-panel metric-card cyan">
          <span className="metric-label">Active In-Flight Orders</span>
          <span className="metric-value">{activeCount}</span>
          <span className="metric-sub">{inTransitCount} currently on the road</span>
        </div>

        <div className="glass-panel metric-card emerald">
          <span className="metric-label">Completed Deliveries</span>
          <span className="metric-value">{deliveredCount}</span>
          <span className="metric-sub">Synced to PostgreSQL DB</span>
        </div>

        <div className="glass-panel metric-card amber">
          <span className="metric-label">Avg Delivery Speed</span>
          <span className="metric-value">
            {activeDelivery?.estimatedDeliveryMinutes ? `${activeDelivery.estimatedDeliveryMinutes}m` : '8m'}
          </span>
          <span className="metric-sub">Real-time GPS estimation</span>
        </div>

        <div className="glass-panel metric-card">
          <span className="metric-label">Active Couriers Online</span>
          <span className="metric-value">5</span>
          <span className="metric-sub">Autonomous fleet simulation</span>
        </div>
      </section>

      {/* Main 3-Column Workspace */}
      <div className="workspace-grid">
        {/* Left Column: Create Order & Order Presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <OrderForm onSubmit={handleCreateOrder} isSubmitting={isSubmitting} />
          <OrdersTable
            deliveries={deliveries}
            selectedOrderId={selectedOrderId}
            onSelectOrder={(id) => setSelectedOrderId(id)}
            onClearDeliveries={handleClearDeliveries}
          />
        </div>

        {/* Center Column: Live Radar Map & Active Delivery Telemetry */}
        <div className="tracker-view">
          <LiveTracking delivery={activeDelivery} onAdvanceStatus={handleAdvanceStatus} />
          <DeliveryTimeline delivery={activeDelivery} />
          <OrderDetails delivery={activeDelivery} onAdvanceStatus={handleAdvanceStatus} />
        </div>

        {/* Right Column: Live Telemetry Stream / Kafka Event Audit */}
        <div className="telemetry-column">
          <EventStream logs={logs} />
        </div>
      </div>
    </main>
  );
}

