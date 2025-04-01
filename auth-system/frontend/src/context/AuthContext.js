import React, { createContext, useState, useEffect } from 'react';
import api from '../utils/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is already logged in
  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const token = localStorage.getItem('token');
        
        if (token) {
          const response = await api.get('/auth/profile');
          setUser(response.data);
        }
      } catch (error) {
        // Token might be expired or invalid
        localStorage.removeItem('token');
        setUser(null);
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
    
    return response.data;
  } catch (error) {
    setError(error.response?.data?.message || 'Login failed');
    throw error;
  } finally {
    setLoading(false);
  }
};

// Logout user
const logout = () => {
  localStorage.removeItem('token');
  setUser(null);
};

return (
  <AuthContext.Provider
    value={{
      isAuthenticated: !!user,
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