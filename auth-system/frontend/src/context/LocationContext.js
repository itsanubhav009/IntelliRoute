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
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showIntersectingOnly, setShowIntersectingOnly] = useState(false);

  // Update the user's location
  const updateLocation = async (latitude, longitude) => {
    if (!user) return;
    
    try {
      const response = await api.post('/location/update', { latitude, longitude });
      setPosition({ latitude, longitude });
      setLastUpdated(new Date());
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
      console.log('Creating path between:', source, destination);
      
      const response = await api.post('/path/set', {
        source,
        destination
      });
      
      // Refresh paths after creating a new one
      await fetchLivePaths();
      setLastUpdated(new Date());
      
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.warn('User is not active enough to create paths');
        setError('You must have an active location to create paths');
      } else {
        console.error('Error creating path:', error);
        setError('Failed to create path: ' + (error.response?.data?.message || error.message));
      }
      throw error;
    }
  };

  // Toggle intersection filtering
  const toggleIntersectionFilter = () => {
    const newValue = !showIntersectingOnly;
    setShowIntersectingOnly(newValue);
    
    // Refresh paths with the new filter setting
    fetchLivePaths(newValue);
    
    return newValue;
  };

  // Fetch paths data for online users, with optional intersection filtering
  const fetchLivePaths = async (intersectOnly = showIntersectingOnly) => {
    setIsLoading(true);
    try {
      console.log(`Fetching paths with intersection filter: ${intersectOnly}`);
      
      const response = await api.get(`/path/live?intersectOnly=${intersectOnly}`);
      
      console.log(`Fetched ${response.data.data?.length || 0} paths`);
      if (intersectOnly) {
        console.log('Intersection filter active, showing only paths that cross your route');
      }
      
      setLivePaths(response.data.data || []);
      setLastUpdated(new Date());
      return response.data.data;
    } catch (error) {
      console.error('Error fetching paths:', error);
      setError('Failed to fetch paths');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch all active users' locations
  const fetchLiveUsers = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/location/live');
      setLiveUsers(response.data.data || []);
      setLastUpdated(new Date());
      console.log(`Fetched ${response.data.data?.length || 0} online users`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching online users:', error);
      setError('Failed to fetch online users');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Get browser geolocation
  const getCurrentPosition = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setPosition({ latitude, longitude });
          
          // Optionally update server with this location
          if (user) {
            updateLocation(latitude, longitude)
              .catch(err => console.error('Failed to update initial location:', err));
          }
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

  // Get current location and set up polling when component mounts
  useEffect(() => {
    if (user) {
      getCurrentPosition();
      
      // Set up polling with the reduced 30-second interval
      const intervalId = setInterval(() => {
        fetchLiveUsers().catch(err => console.error('Failed to fetch users:', err));
        fetchLivePaths().catch(err => console.error('Failed to fetch paths:', err));
      }, 30000); // Use 30 seconds to reduce refreshing frequency
      
      return () => clearInterval(intervalId);
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
        lastUpdated,
        showIntersectingOnly,
        updateLocation,
        createPath,
        fetchLiveUsers,
        fetchLivePaths,
        toggleIntersectionFilter,
        getCurrentPosition
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};