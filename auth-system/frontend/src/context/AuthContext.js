import React, { createContext, useState, useEffect } from 'react';
import api from '../utils/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const token = localStorage.getItem('token');
        
        if (token) {
          const response = await api.get('/auth/profile');
          setUser(response.data);
          setIsAuthenticated(true);
        }
      } catch (error) {
        // Token might be expired or invalid
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkLoggedIn();
  }, []);

  // Register user
  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.post('/auth/register', userData);
      localStorage.setItem('token', response.data.token);
      setUser(response.data);
      setIsAuthenticated(true);
      
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Registration failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Login user
  const login = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.post('/auth/login', userData);
      localStorage.setItem('token', response.data.token);
      setUser(response.data);
      setIsAuthenticated(true);
      
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Login failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Logout user - UPDATED to mark user as offline first
  const logout = async () => {
    try {
      setLoading(true);
      
      // First mark the user as offline before logging out
      const token = localStorage.getItem('token');
      if (token && user) {
        try {
          console.log('Marking user as offline before logout');
          await api.post('/location/offline');
          console.log('User marked as offline successfully');
        } catch (error) {
          console.error('Failed to mark user as offline:', error);
          // Continue with logout even if this fails
        }
      }
      
      // Then proceed with logout
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setIsAuthenticated(false);
      
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      setError('Logout failed: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loading,
        error,
        register,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};