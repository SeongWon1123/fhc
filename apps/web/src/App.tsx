import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import Sidebar from './components/Sidebar';
import Analytics from './pages/Analytics';
import Bookings from './pages/Bookings';
import Coaches from './pages/Coaches';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/coaches" element={<Coaches />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/members" element={<Members />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
