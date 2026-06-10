import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import EmployeeClock from './components/EmployeeClock';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import StationQRDisplay from './components/StationQRDisplay';

function App() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('workforce_user');
    return stored ? JSON.parse(stored) : null;
  });

  // Escuchar cambios en localStorage (opcional, pero útil)
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem('workforce_user');
      setUser(stored ? JSON.parse(stored) : null);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StationQRDisplay />} />
        
        <Route path="/clock" element={<EmployeeClock />} />
        
        <Route path="/admin" element={<AdminDashboard />} />
        
        <Route path="/login" element={<Login />} />

        <Route path="/pantalla-qr" element={<StationQRDisplay />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
