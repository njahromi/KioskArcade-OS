import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import toast from 'react-hot-toast';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import GamesPage from './pages/GamesPage';
import SystemPage from './pages/SystemPage';
import LogsPage from './pages/LogsPage';
import SettingsPage from './pages/SettingsPage';
import Sidebar from './components/Sidebar';

const AdminApp: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status
  const { data: authStatus } = useQuery(
    'authStatus',
    async () => {
      // In a real implementation, this would check the current session
      return { isAuthenticated: false };
    },
    {
      onSuccess: (data) => {
        setIsAuthenticated(data.isAuthenticated);
        setIsLoading(false);
      },
      onError: () => {
        setIsAuthenticated(false);
        setIsLoading(false);
      },
    }
  );

  // Handle login
  const handleLogin = async (password: string) => {
    try {
      if (window.electronAPI) {
        const success = await window.electronAPI.admin.login(password);
        if (success) {
          setIsAuthenticated(true);
          toast.success('Login successful');
        } else {
          toast.error('Invalid password');
        }
      } else {
        // Fallback for development
        if (password === 'admin123') {
          setIsAuthenticated(true);
          toast.success('Login successful');
        } else {
          toast.error('Invalid password');
        }
      }
    } catch (error) {
      toast.error('Login failed');
    }
  };

  // Handle logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    toast.success('Logged out successfully');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin interface...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar onLogout={handleLogout} />
      
      <div className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </div>
  );
};

export default AdminApp; 