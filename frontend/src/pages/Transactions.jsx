import { useEffect, useState } from 'react';
import axios from 'axios';

function Transactions() {
    const [transactions, setTransactions] = useState([]);
    const apiKey = localStorage.getItem('api_key');
    const apiSecret = localStorage.getItem('api_secret');

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const res = await axios.get('http://localhost:8000/api/v1/dashboard/transactions', {
                    headers: { 'X-Api-Key': apiKey, 'X-Api-Secret': apiSecret }
                });
                setTransactions(res.data);
            } catch (err) {
                console.error('Failed to fetch transactions', err);
            }
        };
        fetchTransactions();
    }, [apiKey, apiSecret]);

    return (
        <div>
            <h1>Transactions</h1>
            <table data-test-id="transactions-table" border="1" style={{ width: '100%', textAlign: 'left' }}>
                <thead>
                    <tr>
                        <th>Payment ID</th>
                        <th>Order ID</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map(tx => (
                        <tr key={tx.id} data-test-id="transaction-row" data-payment-id={tx.id}>
                            <td data-test-id="payment-id">{tx.id}</td>
                            <td data-test-id="order-id">{tx.order_id}</td>
                            <td data-test-id="amount">₹{(tx.amount / 100).toFixed(2)}</td>
                            <td data-test-id="method" style={{ textTransform: 'uppercase' }}>{tx.method}</td>
                            <td data-test-id="status">
                                <span className={`status-${tx.status}`}>{tx.status}</span>
                            </td>
                            <td data-test-id="created-at">{new Date(tx.created_at).toLocaleString()}</td>
                            <td>
                                {tx.status === 'success' && (
                                    <button onClick={async () => {
                                        const amount = prompt('Enter refund amount (paise):', tx.amount);
                                        if (amount) {
                                            try {
                                                await axios.post('http://localhost:8000/api/v1/refunds', {
                                                    payment_id: tx.id,
                                                    amount: parseInt(amount)
                                                }, {
                                                    headers: { 'X-Api-Key': apiKey, 'X-Api-Secret': apiSecret }
                                                });
                                                alert('Refund processed');
                                                window.location.reload();
                                            } catch (err) {
                                                alert(err.response?.data?.error?.description || 'Refund failed');
                                            }
                                        }
                                    }}>Refund</button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default Transactions;
