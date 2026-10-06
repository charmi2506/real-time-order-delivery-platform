package main

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type OrderHandler struct {
	db       *sql.DB
	producer *KafkaProducer
}

func NewOrderHandler(db *sql.DB, producer *KafkaProducer) *OrderHandler {
	return &OrderHandler{
		db:       db,
		producer: producer,
	}
}

// HealthCheck handles GET /health
func (h *OrderHandler) HealthCheck(c *gin.Context) {
	dbStatus := "connected"
	if err := h.db.Ping(); err != nil {
		dbStatus = "disconnected"
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "ok",
		"service":  "order-service",
		"database": dbStatus,
	})
}

// CreateOrder handles POST /api/orders
func (h *OrderHandler) CreateOrder(c *gin.Context) {
	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid order payload",
			"details": err.Error(),
		})
		return
	}

	// Sanitize and trim
	req.CustomerName = strings.TrimSpace(req.CustomerName)
	req.Product = strings.TrimSpace(req.Product)
	req.DeliveryAddress = strings.TrimSpace(req.DeliveryAddress)

	if req.CustomerName == "" || req.Product == "" || req.DeliveryAddress == "" || req.Quantity <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Customer name, product, quantity (>0), and delivery address are all required",
		})
		return
	}

	// 1. Save to PostgreSQL
	order, err := CreateOrder(h.db, req)
	if err != nil {
		log.Printf("Error creating order in DB: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create order in database",
		})
		return
	}

	// 2. Publish Kafka event
	if h.producer != nil {
		go func(orderID string, status string) {
			if err := h.producer.PublishOrderCreated(orderID, status); err != nil {
				log.Printf("Failed to publish order.created event for order %s: %v", orderID, err)
			}
		}(order.ID, order.Status)
	}

	c.JSON(http.StatusCreated, order)
}

// GetAllOrders handles GET /api/orders
func (h *OrderHandler) GetAllOrders(c *gin.Context) {
	orders, err := GetAllOrders(h.db)
	if err != nil {
		log.Printf("Error fetching orders: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve orders",
		})
		return
	}

	c.JSON(http.StatusOK, orders)
}

// GetOrderByID handles GET /api/orders/:id
func (h *OrderHandler) GetOrderByID(c *gin.Context) {
	id := c.Param("id")
	if _, err := uuid.Parse(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid order UUID format",
		})
		return
	}

	order, err := GetOrderByID(h.db, id)
	if err != nil {
		if errors.Is(err, ErrOrderNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Order not found",
			})
			return
		}
		log.Printf("Error retrieving order %s: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve order",
		})
		return
	}

	c.JSON(http.StatusOK, order)
}

// UpdateOrderStatus handles PATCH /api/orders/:id/status
func (h *OrderHandler) UpdateOrderStatus(c *gin.Context) {
	id := c.Param("id")
	if _, err := uuid.Parse(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid order UUID format",
		})
		return
	}

	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Status field is required",
			"details": err.Error(),
		})
		return
	}

	cleanStatus := strings.ToUpper(strings.TrimSpace(req.Status))
	if !ValidStatuses[cleanStatus] {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":            "Invalid status value",
			"allowedStatuses": []string{StatusPlaced, StatusConfirmed, StatusPickedUp, StatusOutForDelivery, StatusDelivered},
		})
		return
	}

	order, err := UpdateOrderStatus(h.db, id, cleanStatus)
	if err != nil {
		if errors.Is(err, ErrOrderNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Order not found",
			})
			return
		}
		log.Printf("Error updating order status %s: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update order status",
		})
		return
	}

	c.JSON(http.StatusOK, order)
}
