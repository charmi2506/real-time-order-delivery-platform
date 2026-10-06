package main

import (
	"time"
)

// Order status constants
const (
	StatusPlaced         = "PLACED"
	StatusConfirmed      = "CONFIRMED"
	StatusPickedUp       = "PICKED_UP"
	StatusOutForDelivery = "OUT_FOR_DELIVERY"
	StatusDelivered      = "DELIVERED"
)

var ValidStatuses = map[string]bool{
	StatusPlaced:         true,
	StatusConfirmed:      true,
	StatusPickedUp:       true,
	StatusOutForDelivery: true,
	StatusDelivered:      true,
}

// Order represents an order in the database and API responses
type Order struct {
	ID              string    `json:"id"`
	CustomerName    string    `json:"customerName"`
	Product         string    `json:"product"`
	Quantity        int       `json:"quantity"`
	DeliveryAddress string    `json:"deliveryAddress"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// CreateOrderRequest is the payload for POST /api/orders
type CreateOrderRequest struct {
	CustomerName    string `json:"customerName" binding:"required"`
	Product         string `json:"product" binding:"required"`
	Quantity        int    `json:"quantity" binding:"required,min=1"`
	DeliveryAddress string `json:"deliveryAddress" binding:"required"`
}

// UpdateStatusRequest is the payload for PATCH /api/orders/:id/status
type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

// KafkaOrderEvent is the event emitted on order creation
type KafkaOrderEvent struct {
	OrderID string `json:"orderId"`
	Status  string `json:"status"`
}
