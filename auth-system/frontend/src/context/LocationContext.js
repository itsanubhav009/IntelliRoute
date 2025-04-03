import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from './AuthContext';

export const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [position, setPosition] = useState(null);
  const [liveUsers, setLiveUsers] = useState([]);
  const [livePaths, setLivePaths] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Update the user's location
  const updateLocation = async (latitude, longitude) => {
    if (!user) return;
    
    try {
      const response = await api.post('/location/update', { latitude, longitude });
      setPosition({ latitude, longitude });
      return response.data;
    } catch (error) {
      console.error('Error updating location:', error);
      setError('Failed to update location');
      throw error;
    }
  };

  // Create a path between source and destination
  const createPath = async (source, destination) => {
    if (!user) return;
    
    try {
      // Generate WKT LINESTRING
      const routeWKT = `LINESTRING(${source.lng} ${source.lat}, ${destination.lng} ${destination.lat})`;
      
      const response = await api.post('/path/set', {
        source,
        destination,
        routeWKT
      });
      
      // Refresh paths after creating a new one
      await fetchLivePaths();
      
      return response.data;
    } catch (error) {
      console.error('Error creating path:', error);
      setError('Failed to create path');
      throw error;
    }
  };

  // Fetch all active users' locations
  const fetchLiveUsers = async () => {
    try {
      const response = await api.get('/location/live');
      setLiveUsers(response.data.data || []);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching live users:', error);
      setError('Failed to fetch users');
      throw error;
    }
  };

  // Fetch all paths
  const fetchLivePaths = async () => {
    try {
      const response = await api.get('/path/live');
      setLivePaths(response.data.data || []);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching paths:', error);
      setError('Failed to fetch paths');
      throw error;
    }
  };

  // Get browser geolocation
  const getCurrentPosition = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setPosition({ latitude, longitude });
        },
        (error) => {
          console.error('Geolocation error:', error);
          setError('Failed to get location');
        }
      );
    } else {
      setError('Geolocation is not supported by this browser');
    }
  };

  // Get current location when component mounts
  useEffect(() => {
    if (user) {
      getCurrentPosition();
    }
  }, [user]);

  return (
    <LocationContext.Provider
      value={{
        position,
        liveUsers,
        livePaths,
        isLoading,
        error,
        updateLocation,
        createPath,
        fetchLiveUsers,
        fetchLivePaths,
        getCurrentPosition
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};