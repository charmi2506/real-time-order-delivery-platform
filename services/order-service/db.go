package main

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
)

var ErrOrderNotFound = errors.New("order not found")

// InitDB initializes PostgreSQL connection and ensures schema
func InitDB(connStr string) (*sql.DB, error) {
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Retry pinging DB up to 10 times with exponential backoff
	var pingErr error
	for i := 1; i <= 10; i++ {
		pingErr = db.Ping()
		if pingErr == nil {
			log.Printf("Successfully connected to PostgreSQL")
			break
		}
		log.Printf("Waiting for PostgreSQL to be ready (attempt %d/10): %v", i, pingErr)
		time.Sleep(time.Duration(i) * 500 * time.Millisecond)
	}
	if pingErr != nil {
		return nil, fmt.Errorf("failed to ping postgres: %w", pingErr)
	}

	// Ensure pgcrypto and table schema exist
	schema := `
	CREATE EXTENSION IF NOT EXISTS "pgcrypto";
	CREATE TABLE IF NOT EXISTS orders (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		customer_name VARCHAR(255) NOT NULL,
		product VARCHAR(255) NOT NULL,
		quantity INT NOT NULL CHECK (quantity > 0),
		delivery_address TEXT NOT NULL,
		status VARCHAR(50) NOT NULL DEFAULT 'PLACED',
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
	CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
	`
	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	log.Println("Database schema verified")
	return db, nil
}

// CreateOrder saves a new order into the database
func CreateOrder(db *sql.DB, req CreateOrderRequest) (*Order, error) {
	query := `
		INSERT INTO orders (customer_name, product, quantity, delivery_address, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		RETURNING id, customer_name, product, quantity, delivery_address, status, created_at, updated_at
	`
	var order Order
	err := db.QueryRow(query, req.CustomerName, req.Product, req.Quantity, req.DeliveryAddress, StatusPlaced).Scan(
		&order.ID,
		&order.CustomerName,
		&order.Product,
		&order.Quantity,
		&order.DeliveryAddress,
		&order.Status,
		&order.CreatedAt,
		&order.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert order: %w", err)
	}
	return &order, nil
}

// GetAllOrders retrieves all orders sorted by creation time descending
func GetAllOrders(db *sql.DB) ([]Order, error) {
	query := `
		SELECT id, customer_name, product, quantity, delivery_address, status, created_at, updated_at
		FROM orders
		ORDER BY created_at DESC
	`
	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query orders: %w", err)
	}
	defer rows.Close()

	orders := make([]Order, 0)
	for rows.Next() {
		var o Order
		if err := rows.Scan(
			&o.ID,
			&o.CustomerName,
			&o.Product,
			&o.Quantity,
			&o.DeliveryAddress,
			&o.Status,
			&o.CreatedAt,
			&o.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan order row: %w", err)
		}
		orders = append(orders, o)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during row iteration: %w", err)
	}
	return orders, nil
}

// GetOrderByID retrieves a single order by UUID
func GetOrderByID(db *sql.DB, id string) (*Order, error) {
	query := `
		SELECT id, customer_name, product, quantity, delivery_address, status, created_at, updated_at
		FROM orders
		WHERE id = $1
	`
	var o Order
	err := db.QueryRow(query, id).Scan(
		&o.ID,
		&o.CustomerName,
		&o.Product,
		&o.Quantity,
		&o.DeliveryAddress,
		&o.Status,
		&o.CreatedAt,
		&o.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrOrderNotFound
		}
		return nil, fmt.Errorf("failed to query order by id: %w", err)
	}
	return &o, nil
}

// UpdateOrderStatus updates an order's status and updated_at timestamp
func UpdateOrderStatus(db *sql.DB, id string, status string) (*Order, error) {
	query := `
		UPDATE orders
		SET status = $1, updated_at = NOW()
		WHERE id = $2
		RETURNING id, customer_name, product, quantity, delivery_address, status, created_at, updated_at
	`
	var o Order
	err := db.QueryRow(query, status, id).Scan(
		&o.ID,
		&o.CustomerName,
		&o.Product,
		&o.Quantity,
		&o.DeliveryAddress,
		&o.Status,
		&o.CreatedAt,
		&o.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrOrderNotFound
		}
		return nil, fmt.Errorf("failed to update order status: %w", err)
	}
	return &o, nil
}
