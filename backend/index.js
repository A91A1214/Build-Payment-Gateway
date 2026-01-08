const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { nanoid } = require('nanoid');
require('dotenv').config();
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});
const paymentQueue = new Queue('payment-queue', { connection });

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// Seeding function
async function seedMerchant() {
  const testMerchantId = '550e8400-e29b-41d4-a716-446655440000';
  const existing = await prisma.merchant.findUnique({
    where: { email: 'test@example.com' }
  });

  if (!existing) {
    await prisma.merchant.create({
      data: {
        id: testMerchantId,
        name: 'Test Merchant',
        email: 'test@example.com',
        api_key: 'key_test_abc123',
        api_secret: 'secret_test_xyz789',
        is_active: true
      }
    });
    console.log('Test merchant seeded.');
  }
}

seedMerchant().catch(err => console.error('Seeding failed:', err));

// Health Check
app.get('/health', async (req, res) => {
  let dbStatus = 'connected';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = 'disconnected';
  }

  let redisStatus = 'connected';
  try {
    await connection.ping();
  } catch (err) {
    redisStatus = 'disconnected';
  }

  res.json({
    status: 'healthy',
    database: dbStatus,
    redis: redisStatus,
    worker: 'running', // Simplified for simulation
    timestamp: new Date().toISOString()
  });
});

// Test Merchant Info (Unauthenticated)
app.get('/api/v1/test/merchant', async (req, res) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: '550e8400-e29b-41d4-a716-446655440000' }
  });

  if (!merchant) {
    return res.status(404).json({ error: { code: 'NOT_FOUND_ERROR', description: 'Test merchant not found' } });
  }

  res.json({
    id: merchant.id,
    email: merchant.email,
    api_key: merchant.api_key,
    seeded: true
  });
});

// Auth Middleware
const authenticate = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const apiSecret = req.headers['x-api-secret'];

  if (!apiKey || !apiSecret) {
    return res.status(401).json({
      error: { code: 'AUTHENTICATION_ERROR', description: 'Invalid API credentials' }
    });
  }

  const merchant = await prisma.merchant.findUnique({ where: { api_key: apiKey } });

  if (!merchant || merchant.api_secret !== apiSecret) {
    return res.status(401).json({
      error: { code: 'AUTHENTICATION_ERROR', description: 'Invalid API credentials' }
    });
  }

  req.merchant = merchant;
  next();
};

// Merchant Registration (Public)
app.post('/api/v1/merchants/register', async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      error: { code: 'BAD_REQUEST_ERROR', description: 'name and email are required' }
    });
  }

  const existing = await prisma.merchant.findUnique({ where: { email } });
  if (existing) {
    return res.status(400).json({
      error: { code: 'BAD_REQUEST_ERROR', description: 'Merchant already exists' }
    });
  }

  const apiKey = `key_test_${nanoid(12)}`;
  const apiSecret = `secret_test_${nanoid(12)}`;

  const merchant = await prisma.merchant.create({
    data: {
      name,
      email,
      api_key: apiKey,
      api_secret: apiSecret
    }
  });

  res.status(201).json(merchant);
});

// Update Merchant Profile
app.patch('/api/v1/merchants/me', authenticate, async (req, res) => {
  const { webhook_url } = req.body;

  const updatedMerchant = await prisma.merchant.update({
    where: { id: req.merchant.id },
    data: { webhook_url }
  });

  res.json(updatedMerchant);
});

// Create Order
app.post('/api/v1/orders', authenticate, async (req, res) => {
  const { amount, currency = 'INR', receipt, notes } = req.body;

  if (!amount || amount < 100) {
    return res.status(400).json({
      error: { code: 'BAD_REQUEST_ERROR', description: 'amount must be at least 100' }
    });
  }

  const orderId = `order_${nanoid(16)}`;

  const order = await prisma.order.create({
    data: {
      id: orderId,
      merchant_id: req.merchant.id,
      amount,
      currency,
      receipt,
      notes: notes || {},
      status: 'created'
    }
  });

  res.status(201).json({
    ...order,
    created_at: order.created_at.toISOString()
  });
});

// Get Order
app.get('/api/v1/orders/:id', authenticate, async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id }
  });

  if (!order || order.merchant_id !== req.merchant.id) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND_ERROR', description: 'Order not found' }
    });
  }

  res.json(order);
});

// Public Order (for Checkout)
app.get('/api/v1/orders/:id/public', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    select: { id: true, amount: true, currency: true, status: true }
  });

  if (!order) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND_ERROR', description: 'Order not found' }
    });
  }

  res.json(order);
});

// Validation Utils
const validateVPA = (vpa) => /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(vpa);

const validateLuhn = (number) => {
  const digits = number.replace(/\D/g, '').split('').map(Number);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[digits.length - 1 - i];
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
};

const detectNetwork = (number) => {
  const n = number.replace(/\D/g, '');
  if (n.startsWith('4')) return 'visa';
  if (/^5[1-5]/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^(60|65|81|82|83|84|85|86|87|88|89)/.test(n)) return 'rupay';
  return 'unknown';
};

const validateExpiry = (month, year) => {
  const m = parseInt(month, 10);
  let y = parseInt(year, 10);
  if (y < 100) y += 2000;
  const now = new Date();
  const expiry = new Date(y, m - 1); // 0-indexed month
  return expiry >= new Date(now.getFullYear(), now.getMonth());
};

// Create Payment (Now Asynchronous via BullMQ)
async function processPaymentRequest(order, data, res) {
  const { method, vpa, card } = data;
  let paymentData = {
    id: `pay_${nanoid(16)}`,
    order_id: order.id,
    merchant_id: order.merchant_id,
    amount: order.amount,
    currency: order.currency,
    method,
    status: 'processing'
  };

  if (method === 'upi') {
    if (!vpa || !validateVPA(vpa)) {
      return res.status(400).json({ error: { code: 'INVALID_VPA', description: 'VPA format invalid' } });
    }
    paymentData.vpa = vpa;
  } else if (method === 'card') {
    if (!card || !card.number || !card.expiry_month || !card.expiry_year || !card.cvv || !card.holder_name) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST_ERROR', description: 'Missing card details' } });
    }
    if (!validateLuhn(card.number)) {
      return res.status(400).json({ error: { code: 'INVALID_CARD', description: 'Card validation failed' } });
    }
    if (!validateExpiry(card.expiry_month, card.expiry_year)) {
      return res.status(400).json({ error: { code: 'EXPIRED_CARD', description: 'Card expiry date invalid' } });
    }
    paymentData.card_network = detectNetwork(card.number);
    paymentData.card_last4 = card.number.slice(-4);
  } else {
    return res.status(400).json({ error: { code: 'BAD_REQUEST_ERROR', description: 'Invalid payment method' } });
  }

  const payment = await prisma.payment.create({ data: paymentData });

  // Add to queue
  const isTestMode = process.env.TEST_MODE === 'true';
  await paymentQueue.add('process-payment', {
    paymentId: payment.id,
    method,
    isTestMode,
    testSuccess: process.env.TEST_PAYMENT_SUCCESS !== 'false',
    testDelay: parseInt(process.env.TEST_PROCESSING_DELAY || 1000)
  });

  res.status(201).json(payment);
}

app.post('/api/v1/payments', authenticate, async (req, res) => {
  const { order_id } = req.body;
  const order = await prisma.order.findUnique({ where: { id: order_id } });
  if (!order || order.merchant_id !== req.merchant.id) {
    return res.status(404).json({ error: { code: 'NOT_FOUND_ERROR', description: 'Order not found' } });
  }
  await processPaymentRequest(order, req.body, res);
});

app.post('/api/v1/payments/public', async (req, res) => {
  const { order_id } = req.body;
  const order = await prisma.order.findUnique({ where: { id: order_id } });
  if (!order) return res.status(404).json({ error: { code: 'NOT_FOUND_ERROR', description: 'Order not found' } });
  await processPaymentRequest(order, req.body, res);
});

// Get Payment (Authenticated)
app.get('/api/v1/payments/:id', authenticate, async (req, res) => {
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!payment || payment.merchant_id !== req.merchant.id) {
    return res.status(404).json({ error: { code: 'NOT_FOUND_ERROR', description: 'Payment not found' } });
  }
  res.json(payment);
});

// Public Payment Status (for Checkout)
app.get('/api/v1/payments/:id/public', async (req, res) => {
  const payment = await prisma.payment.findUnique({
    where: { id: req.params.id },
    select: { id: true, status: true, amount: true, currency: true, order_id: true }
  });
  if (!payment) return res.status(404).json({ error: { code: 'NOT_FOUND_ERROR', description: 'Payment not found' } });
  res.json(payment);
});

// Refunds
app.post('/api/v1/refunds', authenticate, async (req, res) => {
  const { payment_id, amount, notes } = req.body;
  const payment = await prisma.payment.findUnique({
    where: { id: payment_id },
    include: { refunds: true }
  });

  if (!payment || payment.merchant_id !== req.merchant.id) {
    return res.status(404).json({ error: { code: 'NOT_FOUND_ERROR', description: 'Payment not found' } });
  }

  if (payment.status !== 'success') {
    return res.status(400).json({ error: { code: 'BAD_REQUEST_ERROR', description: 'Only successful payments can be refunded' } });
  }

  const refundedAmount = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
  const remainingAmount = payment.amount - refundedAmount;

  if (amount > remainingAmount) {
    return res.status(400).json({
      error: { code: 'INSUFFICIENT_REFUND_AMOUNT', description: 'Refund amount exceeds available balance' }
    });
  }

  const refund = await prisma.refund.create({
    data: {
      id: `ref_${nanoid(16)}`,
      payment_id,
      merchant_id: req.merchant.id,
      amount,
      currency: payment.currency,
      status: 'processed',
      notes: notes || {}
    }
  });

  res.status(201).json(refund);
});

// Dashboard Stats
app.get('/api/v1/dashboard/stats', authenticate, async (req, res) => {
  const payments = await prisma.payment.findMany({ where: { merchant_id: req.merchant.id } });
  const successPayments = payments.filter(p => p.status === 'success');
  const totalAmount = successPayments.reduce((sum, p) => sum + p.amount, 0);
  const successRate = payments.length > 0 ? (successPayments.length / payments.length) * 100 : 0;

  res.json({
    totalTransactions: payments.length,
    totalAmount,
    successRate: Math.round(successRate) + '%'
  });
});

app.get('/api/v1/dashboard/transactions', authenticate, async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { merchant_id: req.merchant.id },
    orderBy: { created_at: 'desc' }
  });
  res.json(payments);
});

app.listen(port, () => console.log(`Gateway API running on port ${port}`));
