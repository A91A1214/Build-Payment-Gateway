import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Checkout from './pages/Checkout';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/" element={<div>Please use a valid checkout link.</div>} />
            </Routes>
        </Router>
    );
}

export default App;
