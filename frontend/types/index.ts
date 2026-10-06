export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED';

export interface Driver {
  name: string;
  phone: string;
  rating: number;
  vehicle: string;
  avatar: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
  heading?: number;
  name?: string;
  address?: string;
}

export interface DeliveryEvent {
  status: string;
  timestamp: string;
  note: string;
}

export interface Order {
  id: string;
  customerName: string;
  product: string;
  quantity: number;
  deliveryAddress: string;
  status: OrderStatus | string;
  createdAt: string;
  updatedAt: string;
}

export interface Delivery {
  orderId: string;
  customerName: string;
  product: string;
  quantity: number;
  deliveryAddress: string;
  status: OrderStatus;
  driver?: Driver;
  pickupLocation: Coordinates;
  destinationLocation: Coordinates;
  currentLocation: Coordinates;
  routeWaypoints: Coordinates[];
  currentStepIndex: number;
  progressPercent: number;
  estimatedDeliveryMinutes: number;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  history: DeliveryEvent[];
}

export interface OrderPreset {
  customer: string;
  product: string;
  qty: number;
  address: string;
}

export interface BackendHealth {
  order: boolean;
  delivery: boolean;
  kafka: boolean;
  redis: boolean;
}

export interface TelemetryLog {
  id: string;
  time: string;
  type: 'info' | 'order' | 'kafka' | 'ws' | 'warning' | 'delivered';
  message: string;
}

export type WebSocketMessage =
  | { type: 'INITIAL_STATE'; deliveries: Delivery[]; timestamp?: string }
  | { type: 'ORDER_INGESTED'; orderId: string; delivery: Delivery }
  | { type: 'STATUS_UPDATE'; orderId: string; status: OrderStatus; delivery: Delivery }
  | { type: 'LOCATION_UPDATE'; orderId: string; location: Coordinates; progressPercent: number; etaMinutes: number; driver?: Driver }
  | { type: 'DELIVERIES_CLEARED' }
  | { type: 'ORDER_STATE'; delivery: Delivery }
  | { type: 'PONG'; timestamp: number }
  | { type: 'SUBSCRIBE_ALL' }
  | { type: 'SUBSCRIBE_ORDER'; orderId: string };
