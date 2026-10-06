const express = require('express');
const http = require('http');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const Redis = require('ioredis');
const { Kafka, logLevel } = require('kafkajs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables (.env in service or root)
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PORT = parseInt(process.env.DELIVERY_SERVICE_PORT || '5000', 10);
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KAFKA_BROKERS = (process.env.DELIVERY_KAFKA_BROKERS || 'localhost:9092').split(',').map(s => s.trim());
const KAFKA_GROUP_ID = process.env.DELIVERY_KAFKA_GROUP_ID || 'delivery-service-group';
const KAFKA_TOPIC = process.env.DELIVERY_KAFKA_TOPIC || 'order.created';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:8080';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// -------------------------------------------------------------
// 1. Redis Client Setup
// -------------------------------------------------------------
let redisConnected = false;
const redis = new Redis(REDIS_URL, {
  retryStrategy(times) {
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on('connect', () => {
  redisConnected = true;
  console.log(`[Redis] Connected successfully to ${REDIS_URL}`);
});

redis.on('error', (err) => {
  redisConnected = false;
  console.error(`[Redis] Connection warning: ${err.message}`);
});

// -------------------------------------------------------------
// 2. WebSocket Server Setup
// -------------------------------------------------------------
const clients = new Set();

function broadcast(payload, filterFn = null) {
  const message = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      if (!filterFn || filterFn(client)) {
        try {
          client.send(message);
        } catch (err) {
          console.error('[WebSocket] Error sending message to client:', err.message);
        }
      }
    }
  }
}

wss.on('connection', async (ws, req) => {
  ws.isAlive = true;
  ws.subscriptions = new Set(['ALL']); // default subscribe to all feeds
  clients.add(ws);

  console.log(`[WebSocket] New client connected (${clients.size} total)`);

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Send initial active deliveries to client on connect
  try {
    const deliveries = await getAllDeliveriesFromRedis();
    ws.send(JSON.stringify({
      type: 'INITIAL_STATE',
      deliveries,
      timestamp: new Date().toISOString()
    }));
  } catch (err) {
    console.error('[WebSocket] Error fetching initial state:', err.message);
  }

  ws.on('message', async (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type === 'SUBSCRIBE_ORDER' && data.orderId) {
        ws.subscriptions.add(data.orderId);
        const delivery = await getDeliveryFromRedis(data.orderId);
        if (delivery) {
          ws.send(JSON.stringify({ type: 'ORDER_STATE', delivery }));
        }
      } else if (data.type === 'SUBSCRIBE_ALL') {
        ws.subscriptions.add('ALL');
      } else if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      }
    } catch (err) {
      console.warn('[WebSocket] Malformed message received:', err.message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WebSocket] Client disconnected (${clients.size} remaining)`);
  });

  ws.on('error', (err) => {
    console.error('[WebSocket] Client error:', err.message);
    clients.delete(ws);
  });
});

// Heartbeat ping interval to keep connections clean
const heartbeatInterval = setInterval(() => {
  for (const ws of clients) {
    if (ws.isAlive === false) {
      clients.delete(ws);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// -------------------------------------------------------------
// 3. Driver Pool & Route Simulation Helpers
// -------------------------------------------------------------
const DRIVER_POOL = [
  { name: 'Alex Rivera', phone: '+1 (555) 234-8901', rating: 4.95, vehicle: 'E-Bike Courier #12', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80' },
  { name: 'Marcus Vance', phone: '+1 (555) 876-1234', rating: 4.88, vehicle: 'Honda Civic (Silver)', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80' },
  { name: 'Samantha Chen', phone: '+1 (555) 432-9087', rating: 4.92, vehicle: 'Vespa Scooter (Teal)', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80' },
  { name: 'Jordan Smith', phone: '+1 (555) 678-4321', rating: 4.85, vehicle: 'Tesla Model 3 (White)', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80' },
  { name: 'Elena Rostova', phone: '+1 (555) 901-2345', rating: 4.98, vehicle: 'Zero E-Motorcycle', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80' }
];

// Base downtown area coordinates (e.g. Metro Area)
const BASE_LAT = 40.730610;
const BASE_LNG = -73.935242;

function getRandomDriver() {
  const idx = Math.floor(Math.random() * DRIVER_POOL.length);
  return { ...DRIVER_POOL[idx] };
}

function generateRoutePoints(pickup, destination, steps = 20) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Add subtle curvature to simulate road navigation
    const jitter = Math.sin(t * Math.PI) * 0.003 * ((i % 2 === 0) ? 1 : -1);
    const lat = pickup.lat + (destination.lat - pickup.lat) * t + jitter;
    const lng = pickup.lng + (destination.lng - pickup.lng) * t + (jitter * 0.8);
    points.push({ lat, lng });
  }
  return points;
}

function calculateHeading(p1, p2) {
  if (!p1 || !p2) return 0;
  const dLng = (p2.lng - p1.lng) * (Math.PI / 180);
  const lat1 = p1.lat * (Math.PI / 180);
  const lat2 = p2.lat * (Math.PI / 180);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return Math.round((Math.atan2(y, x) * (180 / Math.PI) + 360) % 360);
}

// -------------------------------------------------------------
// 4. Redis Persistence Helpers
// -------------------------------------------------------------
const ACTIVE_DELIVERIES_KEY = 'deliveries:active';

async function saveDeliveryToRedis(delivery) {
  try {
    const json = JSON.stringify(delivery);
    await redis.set(`delivery:${delivery.orderId}`, json);
    await redis.sadd(ACTIVE_DELIVERIES_KEY, delivery.orderId);
  } catch (err) {
    console.error(`[Redis] Error saving delivery ${delivery.orderId}:`, err.message);
  }
}

async function getDeliveryFromRedis(orderId) {
  try {
    const raw = await redis.get(`delivery:${orderId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error(`[Redis] Error getting delivery ${orderId}:`, err.message);
    return null;
  }
}

async function getAllDeliveriesFromRedis() {
  try {
    const orderIds = await redis.smembers(ACTIVE_DELIVERIES_KEY);
    if (!orderIds || orderIds.length === 0) return [];

    const pipeline = redis.pipeline();
    orderIds.forEach(id => pipeline.get(`delivery:${id}`));
    const results = await pipeline.exec();

    const deliveries = [];
    for (const [err, raw] of results) {
      if (!err && raw) {
        try {
          deliveries.push(JSON.parse(raw));
        } catch (_) {}
      }
    }

    // Sort by createdAt descending
    deliveries.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return deliveries;
  } catch (err) {
    console.error('[Redis] Error fetching all deliveries:', err.message);
    return [];
  }
}

// -------------------------------------------------------------
// 5. Order Service Synchronization
// -------------------------------------------------------------
async function updateOrderServiceStatus(orderId, status) {
  try {
    const res = await fetch(`${ORDER_SERVICE_URL}/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`[Sync] Order Service status update returned ${res.status}: ${text}`);
    } else {
      console.log(`[Sync] Synced status '${status}' for order ${orderId} to PostgreSQL`);
    }
  } catch (err) {
    console.warn(`[Sync] Could not sync status with Order Service at ${ORDER_SERVICE_URL}: ${err.message}`);
  }
}

async function fetchOrderDetails(orderId) {
  try {
    const res = await fetch(`${ORDER_SERVICE_URL}/api/orders/${orderId}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`[OrderFetch] Failed to fetch order ${orderId} from order-service: ${err.message}`);
  }
  return null;
}

// -------------------------------------------------------------
// 6. Real-time Delivery Simulation Engine
// -------------------------------------------------------------
// Active in-memory simulation tickers: orderId -> simulationState
const activeSimulations = new Map();

function startDeliverySimulation(delivery) {
  if (activeSimulations.has(delivery.orderId)) {
    return; // Already simulating
  }

  const simState = {
    orderId: delivery.orderId,
    status: delivery.status || 'PLACED',
    stepIndex: delivery.currentStepIndex || 0,
    totalSteps: delivery.routeWaypoints.length,
    elapsedSeconds: 0,
    interval: null
  };

  simState.interval = setInterval(async () => {
    simState.elapsedSeconds += 2;
    const currentDelivery = await getDeliveryFromRedis(simState.orderId);
    if (!currentDelivery) {
      clearInterval(simState.interval);
      activeSimulations.delete(simState.orderId);
      return;
    }

    // Step 1: PLACED -> CONFIRMED (after ~4 seconds)
    if (simState.status === 'PLACED' && simState.elapsedSeconds >= 4) {
      simState.status = 'CONFIRMED';
      currentDelivery.status = 'CONFIRMED';
      currentDelivery.history.push({
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        note: 'Order confirmed by restaurant. Preparing items.'
      });
      await saveDeliveryToRedis(currentDelivery);
      await updateOrderServiceStatus(simState.orderId, 'CONFIRMED');

      broadcast({
        type: 'STATUS_UPDATE',
        orderId: simState.orderId,
        status: 'CONFIRMED',
        delivery: currentDelivery
      });
      return;
    }

    // Step 2: CONFIRMED -> PICKED_UP (after ~10 seconds)
    if (simState.status === 'CONFIRMED' && simState.elapsedSeconds >= 10) {
      simState.status = 'PICKED_UP';
      currentDelivery.status = 'PICKED_UP';
      currentDelivery.history.push({
        status: 'PICKED_UP',
        timestamp: new Date().toISOString(),
        note: `Driver ${currentDelivery.driver.name} has picked up the package.`
      });
      await saveDeliveryToRedis(currentDelivery);
      await updateOrderServiceStatus(simState.orderId, 'PICKED_UP');

      broadcast({
        type: 'STATUS_UPDATE',
        orderId: simState.orderId,
        status: 'PICKED_UP',
        delivery: currentDelivery
      });
      return;
    }

    // Step 3: PICKED_UP -> OUT_FOR_DELIVERY (after ~16 seconds)
    if (simState.status === 'PICKED_UP' && simState.elapsedSeconds >= 16) {
      simState.status = 'OUT_FOR_DELIVERY';
      currentDelivery.status = 'OUT_FOR_DELIVERY';
      currentDelivery.history.push({
        status: 'OUT_FOR_DELIVERY',
        timestamp: new Date().toISOString(),
        note: 'Driver is on the way to your delivery address.'
      });
      await saveDeliveryToRedis(currentDelivery);
      await updateOrderServiceStatus(simState.orderId, 'OUT_FOR_DELIVERY');

      broadcast({
        type: 'STATUS_UPDATE',
        orderId: simState.orderId,
        status: 'OUT_FOR_DELIVERY',
        delivery: currentDelivery
      });
      return;
    }

    // Step 4: OUT_FOR_DELIVERY route progression
    if (simState.status === 'OUT_FOR_DELIVERY') {
      if (simState.stepIndex < simState.totalSteps - 1) {
        simState.stepIndex++;
        const prevPoint = currentDelivery.currentLocation;
        const nextPoint = currentDelivery.routeWaypoints[simState.stepIndex];
        const heading = calculateHeading(prevPoint, nextPoint);

        currentDelivery.currentLocation = {
          lat: nextPoint.lat,
          lng: nextPoint.lng,
          heading
        };
        currentDelivery.currentStepIndex = simState.stepIndex;

        const remainingSteps = simState.totalSteps - 1 - simState.stepIndex;
        const progressPercent = Math.round((simState.stepIndex / (simState.totalSteps - 1)) * 100);
        currentDelivery.progressPercent = progressPercent;
        currentDelivery.estimatedDeliveryMinutes = Math.max(1, Math.ceil((remainingSteps * 2) / 6));

        await saveDeliveryToRedis(currentDelivery);

        broadcast({
          type: 'LOCATION_UPDATE',
          orderId: simState.orderId,
          location: currentDelivery.currentLocation,
          progressPercent,
          etaMinutes: currentDelivery.estimatedDeliveryMinutes,
          driver: currentDelivery.driver
        });
      } else {
        // Destination reached -> DELIVERED!
        simState.status = 'DELIVERED';
        currentDelivery.status = 'DELIVERED';
        currentDelivery.progressPercent = 100;
        currentDelivery.estimatedDeliveryMinutes = 0;
        currentDelivery.deliveredAt = new Date().toISOString();
        currentDelivery.history.push({
          status: 'DELIVERED',
          timestamp: currentDelivery.deliveredAt,
          note: 'Package successfully delivered! Enjoy your meal.'
        });

        await saveDeliveryToRedis(currentDelivery);
        await updateOrderServiceStatus(simState.orderId, 'DELIVERED');

        broadcast({
          type: 'STATUS_UPDATE',
          orderId: simState.orderId,
          status: 'DELIVERED',
          delivery: currentDelivery
        });

        clearInterval(simState.interval);
        activeSimulations.delete(simState.orderId);
      }
    }
  }, 2000);

  activeSimulations.set(delivery.orderId, simState);
}

// -------------------------------------------------------------
// 7. Delivery Record Factory
// -------------------------------------------------------------
async function createDeliveryRecord(orderId, initialStatus = 'PLACED', externalOrder = null) {
  let orderData = externalOrder;
  if (!orderData) {
    orderData = await fetchOrderDetails(orderId);
  }

  // Generate plausible neighborhood coordinates
  const pickupOffsetLat = (Math.random() - 0.5) * 0.04;
  const pickupOffsetLng = (Math.random() - 0.5) * 0.04;
  const destOffsetLat = pickupOffsetLat + (Math.random() - 0.5) * 0.05 + 0.02;
  const destOffsetLng = pickupOffsetLng + (Math.random() - 0.5) * 0.05 + 0.02;

  const pickup = {
    lat: Number((BASE_LAT + pickupOffsetLat).toFixed(6)),
    lng: Number((BASE_LNG + pickupOffsetLng).toFixed(6)),
    name: 'Artisan Hub & Kitchen'
  };

  const destination = {
    lat: Number((BASE_LAT + destOffsetLat).toFixed(6)),
    lng: Number((BASE_LNG + destOffsetLng).toFixed(6)),
    address: orderData?.deliveryAddress || '342 Broadway Ave, Suite 400'
  };

  const routeWaypoints = generateRoutePoints(pickup, destination, 18);
  const driver = getRandomDriver();

  const delivery = {
    orderId,
    customerName: orderData?.customerName || 'Anonymous Customer',
    product: orderData?.product || 'Signature Order Bundle',
    quantity: orderData?.quantity || 1,
    deliveryAddress: destination.address,
    status: initialStatus,
    driver,
    pickupLocation: pickup,
    destinationLocation: destination,
    currentLocation: {
      lat: pickup.lat,
      lng: pickup.lng,
      heading: 0
    },
    routeWaypoints,
    currentStepIndex: 0,
    progressPercent: 0,
    estimatedDeliveryMinutes: 12,
    createdAt: orderData?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [
      {
        status: 'PLACED',
        timestamp: new Date().toISOString(),
        note: 'Order successfully placed and routed to delivery engine.'
      }
    ]
  };

  await saveDeliveryToRedis(delivery);
  return delivery;
}

// -------------------------------------------------------------
// 8. Kafka Consumer Setup
// -------------------------------------------------------------
let kafkaConnected = false;
const kafka = new Kafka({
  clientId: 'delivery-service',
  brokers: KAFKA_BROKERS,
  logLevel: logLevel.INFO,
  retry: {
    initialRetryTime: 300,
    retries: 10
  }
});

const consumer = kafka.consumer({ groupId: KAFKA_GROUP_ID });

async function initKafkaConsumer() {
  console.log(`[Kafka] Connecting to Kafka brokers: ${KAFKA_BROKERS.join(', ')}...`);
  try {
    await consumer.connect();
    kafkaConnected = true;
    console.log('[Kafka] Successfully connected to Kafka cluster');

    await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: false });
    console.log(`[Kafka] Subscribed to topic: '${KAFKA_TOPIC}' with group '${KAFKA_GROUP_ID}'`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const rawValue = message.value.toString();
          console.log(`[Kafka] Received event on '${topic}' [p:${partition}]: ${rawValue}`);

          const event = JSON.parse(rawValue);
          const orderId = event.orderId || event.id;
          const status = event.status || 'PLACED';

          if (!orderId) {
            console.warn('[Kafka] Message missing orderId:', rawValue);
            return;
          }

          // Check if already tracking
          let delivery = await getDeliveryFromRedis(orderId);
          if (!delivery) {
            delivery = await createDeliveryRecord(orderId, status);
            console.log(`[Delivery] Ingested new order ${orderId} into delivery engine`);
          }

          // Broadcast order creation/ingestion event to UI
          broadcast({
            type: 'ORDER_INGESTED',
            orderId,
            delivery
          });

          // Start autonomous delivery simulation
          startDeliverySimulation(delivery);
        } catch (err) {
          console.error('[Kafka] Error handling message:', err.message);
        }
      }
    });
  } catch (err) {
    kafkaConnected = false;
    console.warn(`[Kafka] Warning: could not connect to Kafka yet (${err.message}). Retrying in 5 seconds...`);
    setTimeout(initKafkaConsumer, 5000);
  }
}

// -------------------------------------------------------------
// 9. REST API Routes
// -------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'delivery-service',
    redis: redisConnected,
    kafka: kafkaConnected,
    activeSimulations: activeSimulations.size,
    wsClients: clients.size,
    timestamp: new Date().toISOString()
  });
});

// List all tracked deliveries
app.get('/api/deliveries', async (req, res) => {
  try {
    const deliveries = await getAllDeliveriesFromRedis();
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch deliveries', details: err.message });
  }
});

// Get a single delivery
app.get('/api/deliveries/:orderId', async (req, res) => {
  try {
    const delivery = await getDeliveryFromRedis(req.params.orderId);
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery record not found' });
    }
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch delivery', details: err.message });
  }
});

// Manual step advance for demo / rapid testing
app.post('/api/deliveries/:orderId/advance', async (req, res) => {
  const { orderId } = req.params;
  const delivery = await getDeliveryFromRedis(orderId);
  if (!delivery) {
    return res.status(404).json({ error: 'Delivery record not found' });
  }

  const orderFlow = ['PLACED', 'CONFIRMED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  const currentIndex = orderFlow.indexOf(delivery.status);
  if (currentIndex === -1 || currentIndex === orderFlow.length - 1) {
    return res.json({ message: 'Order is already at terminal state', delivery });
  }

  const nextStatus = orderFlow[currentIndex + 1];
  delivery.status = nextStatus;
  delivery.history.push({
    status: nextStatus,
    timestamp: new Date().toISOString(),
    note: `Fast-forwarded to status ${nextStatus}`
  });

  if (nextStatus === 'OUT_FOR_DELIVERY') {
    delivery.currentStepIndex = Math.floor(delivery.routeWaypoints.length / 2);
    delivery.currentLocation = delivery.routeWaypoints[delivery.currentStepIndex];
    delivery.progressPercent = 50;
  } else if (nextStatus === 'DELIVERED') {
    delivery.currentStepIndex = delivery.routeWaypoints.length - 1;
    delivery.currentLocation = delivery.routeWaypoints[delivery.currentStepIndex];
    delivery.progressPercent = 100;
    delivery.deliveredAt = new Date().toISOString();
  }

  await saveDeliveryToRedis(delivery);
  await updateOrderServiceStatus(orderId, nextStatus);

  broadcast({
    type: 'STATUS_UPDATE',
    orderId,
    status: nextStatus,
    delivery
  });

  res.json({ success: true, nextStatus, delivery });
});

// Simulate creating and running an order directly
app.post('/api/deliveries/simulate', async (req, res) => {
  try {
    const sampleCustomer = req.body.customerName || `Customer ${Math.floor(100 + Math.random() * 900)}`;
    const sampleProduct = req.body.product || 'Artisan Truffle Pizza & Drink';
    const sampleQty = req.body.quantity || 1;
    const sampleAddress = req.body.deliveryAddress || '742 Evergreen Terrace, Springfield';

    // 1. Create in Order Service if available
    let orderId = null;
    try {
      const orderRes = await fetch(`${ORDER_SERVICE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: sampleCustomer,
          product: sampleProduct,
          quantity: sampleQty,
          deliveryAddress: sampleAddress
        })
      });
      if (orderRes.ok) {
        const createdOrder = await orderRes.json();
        orderId = createdOrder.id;
        console.log(`[Simulate] Created real order ${orderId} in Order Service`);
      }
    } catch (e) {
      console.warn('[Simulate] Could not connect to Order Service directly, using synthetic ID:', e.message);
    }

    if (!orderId) {
      orderId = 'sim-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
    }

    const delivery = await createDeliveryRecord(orderId, 'PLACED', {
      customerName: sampleCustomer,
      product: sampleProduct,
      quantity: sampleQty,
      deliveryAddress: sampleAddress,
      createdAt: new Date().toISOString()
    });

    startDeliverySimulation(delivery);

    broadcast({
      type: 'ORDER_INGESTED',
      orderId,
      delivery
    });

    res.status(201).json({
      message: 'Simulated delivery initiated successfully',
      delivery
    });
  } catch (err) {
    res.status(500).json({ error: 'Simulation failed', details: err.message });
  }
});

// Delivery platform statistics
app.get('/api/stats', async (req, res) => {
  try {
    const deliveries = await getAllDeliveriesFromRedis();
    const stats = {
      total: deliveries.length,
      placed: deliveries.filter(d => d.status === 'PLACED').length,
      confirmed: deliveries.filter(d => d.status === 'CONFIRMED').length,
      pickedUp: deliveries.filter(d => d.status === 'PICKED_UP').length,
      outForDelivery: deliveries.filter(d => d.status === 'OUT_FOR_DELIVERY').length,
      delivered: deliveries.filter(d => d.status === 'DELIVERED').length,
      activeDeliveries: deliveries.filter(d => d.status !== 'DELIVERED').length,
      activeSimulations: activeSimulations.size,
      connectedClients: clients.size
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute stats', details: err.message });
  }
});

// Clear all simulated deliveries (useful for resetting demos)
app.delete('/api/deliveries/clear', async (req, res) => {
  try {
    // Clear simulations
    for (const [id, sim] of activeSimulations) {
      clearInterval(sim.interval);
    }
    activeSimulations.clear();

    const orderIds = await redis.smembers(ACTIVE_DELIVERIES_KEY);
    if (orderIds.length > 0) {
      const pipeline = redis.pipeline();
      orderIds.forEach(id => pipeline.del(`delivery:${id}`));
      pipeline.del(ACTIVE_DELIVERIES_KEY);
      await pipeline.exec();
    }

    broadcast({ type: 'DELIVERIES_CLEARED' });
    res.json({ success: true, message: 'All delivery records cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear deliveries', details: err.message });
  }
});

// -------------------------------------------------------------
// 10. Start Server & Background Services
// -------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Delivery & WebSocket Service running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`📊 REST API: http://localhost:${PORT}/api/deliveries`);
  console.log(`=======================================================`);

  // Start Kafka consumer in background
  initKafkaConsumer();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down delivery service gracefully...');
  for (const [_, sim] of activeSimulations) {
    clearInterval(sim.interval);
  }
  await consumer.disconnect();
  redis.disconnect();
  server.close(() => {
    console.log('Delivery service HTTP/WS server closed');
    process.exit(0);
  });
});
