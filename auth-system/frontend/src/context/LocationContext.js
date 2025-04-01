import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from './AuthContext';

export const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const { isAuthenticated } = useContext(AuthContext);
  const [position, setPosition] = useState(null);
  const [liveUsers, setLiveUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Function to manually update user's location
  const updateLocation = async (latitude, longitude) => {
    if (!isAuthenticated) return;

    try {
      const response = await api.post('/location/update', { latitude, longitude });
      
      // Update position state with timestamp
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

  // Fetch all live users
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

  // Update online status when user logs in
  useEffect(() => {
    if (isAuthenticated) {
      updateOnlineStatus(true);
      
      // Check if we have saved location data
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

  // Handle beforeunload event to update offline status
  useEffect(() => {
    const handleBeforeUnload = () => {
      updateOnlineStatus(false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <LocationContext.Provider
      value={{
        position,
        liveUsers,
        loadingUsers,
        updateLocation,
        updateOnlineStatus,
        fetchLiveUsers
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};