import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

function Checkout() {
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('order_id');
    const [order, setOrder] = useState(null);
    const [method, setMethod] = useState(null); // 'upi' or 'card'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [paymentId, setPaymentId] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, processing, success, failed

    // Form states
    const [vpa, setVpa] = useState('');
    const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });

    useEffect(() => {
        if (!orderId) {
            setError('Order ID is missing');
            setLoading(false);
            return;
        }
        const fetchOrder = async () => {
            try {
                const res = await axios.get(`http://localhost:8000/api/v1/orders/${orderId}/public`);
                setOrder(res.data);
            } catch (err) {
                setError('Order not found');
            } finally {
                setLoading(false);
            }
        };
        fetchOrder();
    }, [orderId]);

    const handleExpiry = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 2) {
            value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
        setCard({ ...card, expiry: value });
    };

    const handlePayment = async (e) => {
        e.preventDefault();
        setStatus('processing');
        try {
            const payload = { order_id: orderId, method };
            if (method === 'upi') payload.vpa = vpa;
            else {
                const [month, year] = card.expiry.split('/');
                payload.card = {
                    number: card.number,
                    expiry_month: month,
                    expiry_year: year,
                    cvv: card.cvv,
                    holder_name: card.name
                };
            }

            const res = await axios.post('http://localhost:8000/api/v1/payments/public', payload);
            setPaymentId(res.data.id);
            startPolling(res.data.id);
        } catch (err) {
            setStatus('failed');
            setError(err.response?.data?.error?.description || 'Payment failed');
        }
    };

    const startPolling = (pid) => {
        const interval = setInterval(async () => {
            try {
                const res = await axios.get(`http://localhost:8000/api/v1/payments/${pid}/public`);
                if (res.data.status === 'success') {
                    setStatus('success');
                    clearInterval(interval);
                } else if (res.data.status === 'failed') {
                    setStatus('failed');
                    clearInterval(interval);
                }
            } catch (err) {
                console.error('Polling error', err);
            }
        }, 2000);
    };

    if (loading) return <div>Loading order...</div>;
    if (error && status === 'idle') return <div data-test-id="error-state">{error}</div>;

    return (
        <div data-test-id="checkout-container" className="checkout-outer">
            <div data-test-id="order-summary" className="order-summary">
                <h2>Complete Payment</h2>
                <div>
                    <span>Amount: </span>
                    <strong data-test-id="order-amount">{(order.amount / 100).toFixed(2)}</strong>
                    <span data-test-id="order-currency">{order.currency}</span>
                </div>
                <div>
                    <span>Order ID: </span>
                    <span data-test-id="order-id">{order.id}</span>
                </div>
            </div>

            {status === 'idle' && (
                <>
                    <div data-test-id="payment-methods" className="methods">
                        <button data-test-id="method-upi" data-method="upi" onClick={() => setMethod('upi')}>UPI</button>
                        <button data-test-id="method-card" data-method="card" onClick={() => setMethod('card')}>Card</button>
                    </div>

                    {method === 'upi' && (
                        <form data-test-id="upi-form" onSubmit={handlePayment}>
                            <input
                                data-test-id="vpa-input"
                                placeholder="username@bank"
                                value={vpa}
                                onChange={(e) => setVpa(e.target.value)}
                                required
                            />
                            <button data-test-id="pay-button" type="submit">Pay ₹{(order.amount / 100).toFixed(2)}</button>
                        </form>
                    )}

                    {method === 'card' && (
                        <div className="payment-form">
                            <input data-test-id="card-number-input" placeholder="Card Number" value={card.number} onChange={e => setCard({ ...card, number: e.target.value })} required />
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input data-test-id="card-expiry-input" placeholder="MM/YY" value={card.expiry} onChange={handleExpiry} required />
                                <input data-test-id="card-cvv-input" placeholder="CVV" type="password" value={card.cvv} onChange={e => setCard({ ...card, cvv: e.target.value })} required />
                            </div>
                            <input data-test-id="cardholder-name-input" placeholder="Cardholder Name" value={card.name} onChange={e => setCard({ ...card, name: e.target.value })} required />
                            <button data-test-id="pay-button" className="pay-btn" onClick={handlePayment}>Pay ₹{(order.amount / 100).toFixed(2)}</button>
                        </div>
                    )}
                </>
            )}

            {status === 'processing' && (
                <div data-test-id="processing-state" className="status-screen">
                    <div className="spinner"></div>
                    <h2 data-test-id="payment-status">Processing Payment...</h2>
                    <p>Please do not refresh the page</p>
                </div>
            )}

            {status === 'success' && (
                <div data-test-id="success-state" className="status-screen">
                    <div style={{ fontSize: '4rem', color: '#10b981' }}>✓</div>
                    <h2 data-test-id="payment-status">Payment Success!</h2>
                    <p>Transaction ID: <span data-test-id="payment-id">{paymentId}</span></p>
                </div>
            )}

            {status === 'failed' && (
                <div data-test-id="error-state" className="state error">
                    <h2>Payment Failed</h2>
                    <p data-test-id="error-message">{error || 'Payment could not be processed'}</p>
                    <button data-test-id="retry-button" onClick={() => { setStatus('idle'); setMethod(null); setError(null); }}>Try Again</button>
                </div>
            )}
        </div>
    );
}

export default Checkout;
