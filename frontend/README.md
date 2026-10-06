# AuraTrack Frontend (Next.js + React + TypeScript)

This is the Next.js 14 frontend dashboard for the **AuraTrack Real-Time Distributed Order & Delivery Platform**.

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Library**: React 18
- **Language**: TypeScript 5
- **Styling**: Vanilla CSS (Custom Glassmorphism, CSS Variables, Responsive Grid)
- **Networking**: Native `fetch` + native browser `WebSocket` API

## 🧩 Component Architecture

- `components/Dashboard.tsx`: Central dashboard orchestrator, telemetry logger, health check poller, and WebSocket connection lifecycle manager.
- `components/OrderForm.tsx`: Reactive form to place orders via the Go service with demo preset chips.
- `components/OrdersTable.tsx`: Real-time order table listing all active and completed deliveries.
- `components/OrderDetails.tsx`: Active driver details, phone, vehicle, rating, and destination info.
- `components/DeliveryTimeline.tsx`: Step progress stepper (`PLACED` -> `CONFIRMED` -> `PICKED_UP` -> `OUT_FOR_DELIVERY` -> `DELIVERED`) and audit trail.
- `components/LiveTracking.tsx`: Real-time animated SVG radar with vehicle bearing heading, pulsing aura, and route line.
- `components/EventStream.tsx`: Live audit log of Kafka events and WebSocket telemetry frames.

## 📦 Scripts

- `npm run dev`: Start Next.js development server on port 3000
- `npm run build`: Compile and generate optimized production static pages & bundles
- `npm run start`: Start production server on port 3000
