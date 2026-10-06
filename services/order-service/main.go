package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func main() {
	// Attempt to load .env from current directory or root directory
	_ = godotenv.Load()
	_ = godotenv.Load("../../.env")

	port := getEnv("ORDER_SERVICE_PORT", "8080")
	dbURL := getEnv("DATABASE_URL", "postgres://postgres:postgrespassword@localhost:5432/order_platform_db?sslmode=disable")
	kafkaBrokers := getEnv("ORDER_SERVICE_KAFKA_BROKERS", "localhost:9092")
	kafkaTopic := getEnv("ORDER_KAFKA_TOPIC", "order.created")

	log.Printf("Starting Order Service on port %s...", port)
	log.Printf("Connecting to PostgreSQL at: %s", dbURL)

	// Initialize PostgreSQL
	db, err := InitDB(dbURL)
	if err != nil {
		log.Fatalf("Fatal: could not initialize database: %v", err)
	}
	defer db.Close()

	// Initialize Kafka Producer
	kafkaProducer, err := NewKafkaProducer(kafkaBrokers, kafkaTopic)
	if err != nil {
		log.Printf("Warning: Kafka producer initialization encountered an issue: %v. Order creation will proceed with DB persistence.", err)
	} else {
		defer kafkaProducer.Close()
	}

	// Router setup
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	// CORS configuration for local development and Next.js frontend
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	handler := NewOrderHandler(db, kafkaProducer)

	// Routes
	router.GET("/health", handler.HealthCheck)

	api := router.Group("/api")
	{
		api.POST("/orders", handler.CreateOrder)
		api.GET("/orders", handler.GetAllOrders)
		api.GET("/orders/:id", handler.GetOrderByID)
		api.PATCH("/orders/:id/status", handler.UpdateOrderStatus)
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	log.Printf("Order Service is ready and listening on http://localhost:%s", port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server failed: %v", err)
	}
}
