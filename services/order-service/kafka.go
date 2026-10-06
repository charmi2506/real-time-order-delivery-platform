package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/segmentio/kafka-go"
)

// KafkaProducer manages publishing messages to Kafka topics
type KafkaProducer struct {
	writer *kafka.Writer
	topic  string
}

// NewKafkaProducer initializes a Kafka writer
func NewKafkaProducer(brokers string, topic string) (*KafkaProducer, error) {
	brokerList := strings.Split(brokers, ",")
	for i := range brokerList {
		brokerList[i] = strings.TrimSpace(brokerList[i])
	}

	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokerList...),
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		BatchTimeout: 10 * time.Millisecond,
		RequiredAcks: kafka.RequireOne,
		MaxAttempts:  5,
	}

	log.Printf("Kafka producer initialized for topic '%s' with brokers: %v", topic, brokerList)
	return &KafkaProducer{
		writer: writer,
		topic:  topic,
	}, nil
}

// PublishOrderCreated sends the order.created event to Kafka
func (kp *KafkaProducer) PublishOrderCreated(orderID string, status string) error {
	event := KafkaOrderEvent{
		OrderID: orderID,
		Status:  status,
	}

	bytes, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal kafka event: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	msg := kafka.Message{
		Key:   []byte(orderID),
		Value: bytes,
		Time:  time.Now(),
	}

	if err := kp.writer.WriteMessages(ctx, msg); err != nil {
		return fmt.Errorf("failed to write message to kafka: %w", err)
	}

	log.Printf("Successfully published Kafka event to topic '%s': %s", kp.topic, string(bytes))
	return nil
}

// Close closes the Kafka writer
func (kp *KafkaProducer) Close() error {
	if kp.writer != nil {
		return kp.writer.Close()
	}
	return nil
}
