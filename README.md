# Payment Gateway Implementation

A production-ready payment gateway simulation with merchant onboarding, order management, and asynchronous payment processing.

## Prerequisites
- Docker and Docker Compose
- Node.js (for local development, optional as everything is containerized)

## Quick Start

1. **Clone the repository** (if not already in the directory).
2. **Setup Environment**: The `.env.example` contains all necessary defaults. You can copy it to `.env` if needed, though Docker Compose is configured with these values.
3. **Run the Application**:
   ```bash
   docker-compose up -d
   ```
   This will start:
   - **PostgreSQL**: `localhost:5432`
   - **Gateway API**: `localhost:8000`
   - **Merchant Dashboard**: `localhost:3000`
   - **Hosted Checkout**: `localhost:3001`
   - **Redis**: `localhost:6379`
   - **Background Worker**: Processing payments and webhooks.

## Core Features

- **Merchant Registration**: Merchants can sign up via the dashboard.
- **REST API**: Standardized endpoints for order creation and payment management.
- **Asynchronous Processing**: Uses BullMQ and Redis for high-performance transaction handling.
- **Webhook Retries**: Exponential backoff support for event notifications.
- **Validation**: Full Luhn algorithm for cards and regex validation for UPI.
- **Refunds**: Support for partial and full refunds with balance tracking.

## Testing

### Seeded Credentials
- **Merchant Email**: `test@example.com`
- **API Key**: `key_test_abc123`
- **API Secret**: `secret_test_xyz789`

### Health Check
Verify system status:
```bash
curl http://localhost:8000/health
```

### Create Order (API)
```bash
curl -X POST http://localhost:8000/api/v1/orders \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Content-Type: application/json" \
  -d '{"amount": 50000, "currency": "INR", "receipt": "test_1"}'
```

## Compliance

This implementation follows the strict requirements for:
- Database schema and relationship naming.
- ID formatting (`order_`, `pay_`, `ref_`).
- Error codes (`AUTHENTICATION_ERROR`, `BAD_REQUEST_ERROR`, etc.).
- Frontend `data-test-id` attributes for automated Selenium tests.
