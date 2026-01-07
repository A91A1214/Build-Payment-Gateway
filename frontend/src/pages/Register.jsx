import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [merchant, setMerchant] = useState(null);
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('http://localhost:8000/api/v1/merchants/register', { name, email });
            setMerchant(res.data);
        } catch (err) {
            alert(err.response?.data?.error?.description || 'Registration failed');
        }
    };

    if (merchant) {
        return (
            <div className="login-container">
                <h2>Registration Successful!</h2>
                <div style={{ textAlign: 'left', background: '#eee', padding: '15px', borderRadius: '4px' }}>
                    <p><strong>API Key:</strong> {merchant.api_key}</p>
                    <p><strong>API Secret:</strong> {merchant.api_secret}</p>
                </div>
                <p>Please save these credentials securely. You can now <Link to="/login">Login</Link>.</p>
            </div>
        );
    }

    return (
        <div className="login-container">
            <h1>Merchant Sign Up</h1>
            <form onSubmit={handleRegister}>
                <input
                    data-test-id="register-name"
                    placeholder="Business Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
                <input
                    data-test-id="register-email"
                    type="email"
                    placeholder="Contact Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <button data-test-id="register-button" type="submit">Register</button>
            </form>
            <p>Already have an account? <Link to="/login">Login</Link></p>
        </div>
    );
}

export default Register;
