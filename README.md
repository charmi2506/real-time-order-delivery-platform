# AuraTrack: Real-Time Distributed Order & Delivery Platform

A high-performance, event-driven distributed system for end-to-end order processing, real-time dispatching, and live GPS delivery tracking.

---

## 🏛️ System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend (React + TS)                   │
│                                Port 3000                               │
│  - Dashboard                     - OrderForm        - OrdersTable      │
│  - LiveTracking (Radar Map)      - DeliveryTimeline - EventStream      │
└──────────────────┬─────────────────────────────────▲───────────────────┘
                   │ HTTP POST (Create Order)         │ WebSockets (ws://)
                   │                                  │ Real-time Telemetry
                   ▼                                  │
┌─────────────────────────────────────┐               │
│          Go Order Service           │               │
│             Port 8080               │               │
│  - REST API (/api/orders)           │               │
│  - PostgreSQL persistence           │               │
│  - Kafka Producer (order.created)   │               │
└──────────────┬──────────────────────┘               │
               │                                      │
               │ Events                               │
               ▼                                      │
┌─────────────────────────────────────┐               │
│          Apache Kafka               │               │
│             Port 9092               │               │
│  - Topic: order.created             │               │
└──────────────┬──────────────────────┘               │
               │ Consumer                             │
               ▼                                      │
┌─────────────────────────────────────────────────────┴──────────────────┐
│                     Node.js Delivery Service                           │
│                             Port 5000                                  │
│  - Kafka Consumer (ingests new orders)                                 │
│  - Redis State Store (active deliveries & waypoint cache)              │
│  - Autonomous Simulation Engine (GPS interpolation & heading calc)     │
│  - WebSocket Server (real-time broadcast to connected frontends)       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ State cache
                                   ▼
┌─────────────────────────────────────┐
│             Redis Store             │
│              Port 6379              │
└─────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer | Technology | Key Features |
|---|---|---|
| **Frontend** | **Next.js 14, React 18, TypeScript 5** | Glassmorphism UI, SVG Radar GPS tracking, real-time WebSocket state synchronization, typed component hierarchy |
| **Order Service** | **Go (Golang)** | High-throughput REST API, transactional PostgreSQL storage, Kafka producer |
| **Delivery Service** | **Node.js, Express, `ws`** | Kafka consumer group, in-memory route navigation simulation, WebSocket broadcasting |
| **Message Broker** | **Apache Kafka 7.6 (KRaft)** | Decoupled event-driven pub/sub on `order.created` |
| **Database** | **PostgreSQL 16** | Relational storage for permanent order history and statuses |
| **Cache & State** | **Redis 7** | Fast key-value and set storage for active in-flight delivery telemetry |

---

## 📁 Repository Structure

```text
real-time-order-platform/
├── docker-compose.yml              # Multi-container orchestration (Postgres, Redis, Kafka, Go, Node)
├── init.sql                        # PostgreSQL schema definition
├── .env.example                    # Environment variable template
├── frontend/                       # Next.js + React + TypeScript Dashboard
│   ├── app/
│   │   ├── layout.tsx              # Root Next.js layout & typography
│   │   ├── page.tsx                # Main entry point mounting Dashboard
│   │   └── globals.css             # Glassmorphism & neon visual design tokens
│   ├── components/
│   │   ├── Dashboard.tsx           # Dashboard orchestrator & WebSocket manager
│   │   ├── OrderForm.tsx           # Order placement form & demo presets
│   │   ├── OrdersTable.tsx         # Tracked orders list & filter/clear controls
│   │   ├── OrderDetails.tsx        # Selected order driver card & fast-forward actions
│   │   ├── DeliveryTimeline.tsx    # Step progression bar & audit event history
│   │   ├── LiveTracking.tsx        # Real-time GPS route radar (SVG canvas)
│   │   └── EventStream.tsx         # Live Kafka & WebSocket event bus audit logs
│   ├── types/
│   │   └── index.ts                # TypeScript interfaces (Order, Delivery, WebSocketMessage, etc.)
│   ├── package.json
│   └── tsconfig.json
└── services/
    ├── order-service/              # Go order microservice
    │   ├── main.go
    │   ├── handlers.go
    │   ├── kafka.go
    │   ├── db.go
    │   ├── models.go
    │   └── Dockerfile
    └── delivery-service/           # Node.js delivery microservice
        ├── server.js
        ├── package.json
        └── Dockerfile
```

---

## 🚀 Quick Start & Setup

### Option 1: Full Docker Compose (Recommended)

1. Start all infrastructure and backend services:
   ```bash
   docker compose up -d
   ```

2. Start the Next.js Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. Open **`http://localhost:3000`** in your browser.

---

### Option 2: Running Frontend Independently

1. Ensure the backend services are running:
   - Go Order Service at `http://localhost:8080`
   - Node.js Delivery & WebSocket Service at `http://localhost:5000` (and `ws://localhost:5000`)

2. Configure environment variables in `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_ORDER_API_URL=http://localhost:8080
   NEXT_PUBLIC_DELIVERY_API_URL=http://localhost:5000
   NEXT_PUBLIC_DELIVERY_WS_URL=ws://localhost:5000
   ```

3. Build and run production Next.js frontend:
   ```bash
   cd frontend
   npm run build
   npm run start
   ```

---

## ⚡ Features & Workflows

1. **Order Dispatching**: Placing an order triggers a `POST /api/orders` to the Go service, writing to PostgreSQL and publishing to Kafka topic `order.created`.
2. **Kafka Ingestion**: Node.js delivery service consumes the Kafka event, initializes a driver, generates route waypoints, and broadcasts `ORDER_INGESTED`.
3. **Real-Time GPS Tracking**: Autonomous vehicle simulation advances along waypoints, updating bearing/heading, percentage progress, and ETA minutes over WebSockets without page reload.
4. **Resilient Reconnection**: Next.js WebSocket client automatically re-establishes connections upon stream disconnection.
5. **Interactive Controls**: Test status transitions instantly using the **⚡ Fast-Forward Status** trigger.
