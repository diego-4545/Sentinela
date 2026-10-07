import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

                             
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MonitorDetail from './pages/MonitorDetail';
import MonitorStats from './pages/MonitorStats';
import MonitorStatus from './pages/MonitorStatus';
import PublicStatus from './pages/PublicStatus';
import GlobalStatus from './pages/GlobalStatus';

                                              
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {                    }
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          
          {                                                 }
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/monitors/:id"
            element={
              <ProtectedRoute>
                <MonitorDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/monitors/:id/stats"
            element={
              <ProtectedRoute>
                <MonitorStats />
              </ProtectedRoute>
            }
          />

          {                  }
          <Route path="/status/global" element={<GlobalStatus />} />
          <Route path="/status/:id" element={<MonitorStatus />} />
          <Route path="/public-status/:id" element={<PublicStatus />} />
          
          {                                                  }
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}