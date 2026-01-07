import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

function Dashboard() {
    const [stats, setStats] = useState({ totalTransactions: 0, totalAmount: 0, successRate: '0%' });
    const apiKey = localStorage.getItem('api_key');
    const apiSecret = localStorage.getItem('api_secret');

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get('http://localhost:8000/api/v1/dashboard/stats', {
                    headers: { 'X-Api-Key': apiKey, 'X-Api-Secret': apiSecret }
                });
                setStats(res.data);
            } catch (err) {
                console.error('Failed to fetch stats', err);
            }
        };
        fetchStats();
    }, [apiKey, apiSecret]);

    return (
        <div data-test-id="dashboard">
            <h1>Merchant Dashboard</h1>
            <Link to="/dashboard/transactions">View Transactions</Link>

            <div data-test-id="api-credentials" style={{ border: '1px solid #ccc', padding: '10px', margin: '10px 0' }}>
                <h3>API Credentials</h3>
                <div>
                    <label>API Key: </label>
                    <span data-test-id="api-key">{apiKey}</span>
                </div>
                <div>
                    <label>API Secret: </label>
                    <span data-test-id="api-secret">{apiSecret}</span>
                </div>
                <div style={{ marginTop: '10px' }}>
                    <label>Webhook URL: </label>
                    <input
                        type="text"
                        placeholder="https://your-webhook-endpoint.com"
                        value={stats.webhook_url || ''}
                        onChange={(e) => setStats({ ...stats, webhook_url: e.target.value })}
                        style={{ width: '300px', margin: '0 10px' }}
                    />
                    <button onClick={async () => {
                        try {
                            await axios.patch('http://localhost:8000/api/v1/merchants/me', {
                                webhook_url: stats.webhook_url
                            }, {
                                headers: { 'X-Api-Key': apiKey, 'X-Api-Secret': apiSecret }
                            });
                            alert('Webhook URL updated');
                        } catch (err) {
                            alert('Update failed');
                        }
                    }}>Update</button>
                </div>
            </div>

            <div data-test-id="stats-container" className="stats-grid">
                <div className="stat-card">
                    <h4>Total Transactions</h4>
                    <div data-test-id="total-transactions" style={{ fontSize: '2rem', fontWeight: 600 }}>{stats.totalTransactions}</div>
                </div>
                <div className="stat-card">
                    <h4>Total Amount</h4>
                    <div data-test-id="total-amount" style={{ fontSize: '2rem', fontWeight: 600 }}>₹{(stats.totalAmount / 100).toLocaleString()}</div>
                </div>
                <div className="stat-card">
                    <h4>Success Rate</h4>
                    <div data-test-id="success-rate" style={{ fontSize: '2rem', fontWeight: 600, color: '#10b981' }}>{stats.successRate}</div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
