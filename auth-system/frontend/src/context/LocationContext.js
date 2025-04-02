import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from './AuthContext';

export const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const { isAuthenticated } = useContext(AuthContext);
  const [position, setPosition] = useState(null);
  const [liveUsers, setLiveUsers] = useState([]);
  const [livePaths, setLivePaths] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Update user's location
  const updateLocation = async (latitude, longitude) => {
    if (!isAuthenticated) return;
    try {
      const response = await api.post('/location/update', { latitude, longitude });
      setPosition({ 
        latitude, 
        longitude, 
        lastUpdated: new Date() 
      });
      // Also update online status
      await updateOnlineStatus(true);
      return response.data;
    } catch (error) {
      console.error('Failed to update location on server:', error);
      return null;
    }
  };

  // Update online status
  const updateOnlineStatus = async (isOnline) => {
    if (!isAuthenticated) return;
    try {
      await api.post('/location/status', { isOnline });
    } catch (error) {
      console.error('Failed to update online status:', error);
    }
  };

  // Fetch live user locations
  const fetchLiveUsers = async () => {
    if (!isAuthenticated) return [];
    setLoadingUsers(true);
    try {
      const response = await api.get('/location/live');
      setLiveUsers(response.data.data || []);
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch live users:', error);
      return [];
    } finally {
      setLoadingUsers(false);
    }
  };

  // New function: Update both source and destination by setting a path.
  const updatePath = async (source, destination) => {
    if (!isAuthenticated) return;
    try {
      const response = await api.post('/path/set', { source, destination });
      // Optionally update live paths
      setLivePaths(response.data.livePaths || []);
      return response.data;
    } catch (error) {
      console.error('Failed to set path:', error);
      return null;
    }
  };

  // Fetch live user paths from backend
  const fetchLivePaths = async () => {
    if (!isAuthenticated) return [];
    try {
      const response = await api.get('/path/live');
      setLivePaths(response.data.data || []);
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch live paths:', error);
      return [];
    }
  };

  // When user logs in, update online status and try to load existing location from profile.
  useEffect(() => {
    if (isAuthenticated) {
      updateOnlineStatus(true);
      const fetchProfile = async () => {
        try {
          const response = await api.get('/auth/profile');
          if (response.data.latitude && response.data.longitude) {
            setPosition({
              latitude: response.data.latitude,
              longitude: response.data.longitude,
              lastUpdated: response.data.location_updated_at || new Date()
            });
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      };
      fetchProfile();
    } else {
      updateOnlineStatus(false);
      setPosition(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const handleBeforeUnload = () => updateOnlineStatus(false);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <LocationContext.Provider
      value={{
        position,
        liveUsers,
        livePaths,
        loadingUsers,
        updateLocation,
        updateOnlineStatus,
        fetchLiveUsers,
        updatePath,
        fetchLivePaths
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};