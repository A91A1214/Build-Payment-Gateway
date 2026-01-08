import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = (e) => {
        e.preventDefault();
        // Store email and credentials
        localStorage.setItem('merchant_email', email);
        if (email === 'test@example.com') {
            localStorage.setItem('api_key', 'key_test_abc123');
            localStorage.setItem('api_secret', 'secret_test_xyz789');
        }
        navigate('/dashboard');
    };

    return (
        <div className="login-container">
            <h1>Merchant Login</h1>
            <form data-test-id="login-form" onSubmit={handleLogin}>
                <input
                    data-test-id="email-input"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    data-test-id="password-input"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button data-test-id="login-button" type="submit">Login</button>
            </form>
        </div>
    );
}

export default Login;
