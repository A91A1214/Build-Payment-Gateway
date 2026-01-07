const { Worker, Queue } = require('bullmq');
const { PrismaClient } = require('@prisma/client');
const IORedis = require('ioredis');
const axios = require('axios');
require('dotenv').config();

const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

const paymentWorker = new Worker('payment-queue', async (job) => {
    const { paymentId, method, isTestMode, testSuccess, testDelay } = job.data;
    console.log(`Processing payment: ${paymentId}`);

    const delay = isTestMode ? testDelay : (Math.floor(Math.random() * 5000) + 5000);
    await new Promise(resolve => setTimeout(resolve, delay));

    let success = false;
    if (isTestMode) {
        success = testSuccess;
    } else {
        success = method === 'upi' ? Math.random() < 0.9 : Math.random() < 0.95;
    }

    const payment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
            status: success ? 'success' : 'failed',
            error_code: success ? null : 'PAYMENT_FAILED',
            error_description: success ? null : 'Automated processing failure'
        },
        include: { merchant: true }
    });

    // Trigger Webhook if configured
    if (payment.merchant.webhook_url) {
        await webhookQueue.add('send-webhook', {
            url: payment.merchant.webhook_url,
            payload: {
                event: 'payment.captured',
                data: {
                    id: payment.id,
                    order_id: payment.order_id,
                    status: payment.status,
                    amount: payment.amount,
                    currency: payment.currency
                }
            }
        });
    }

}, { connection });

const webhookQueue = new Queue('webhook-queue', { connection });

const webhookWorker = new Worker('webhook-queue', async (job) => {
    const { url, payload } = job.data;
    console.log(`Sending webhook to ${url}`);
    try {
        await axios.post(url, payload, { timeout: 5000 });
    } catch (err) {
        console.error(`Webhook failed for ${url}: ${err.message}`);
        throw err; // BullMQ will retry based on config
    }
}, {
    connection,
    settings: {
        backoff: {
            type: process.env.WEBHOOK_RETRY_INTERVALS_TEST === 'true' ? 'fixed' : 'exponential',
            delay: process.env.WEBHOOK_RETRY_INTERVALS_TEST === 'true' ? 1000 : 5000,
        }
    }
});

console.log('Worker started and listening for jobs...');
