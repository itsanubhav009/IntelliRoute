import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
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
  
  // Add these refs to track fetch timing
  const fetchTimers = useRef({
    users: 0,
    paths: 0
  });

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
    fetchLivePaths();
    
    return newValue;
  };

  // Fetch paths data for online users
  const fetchLivePaths = async () => {
    // Prevent calling too frequently
    const now = Date.now();
    if (now - fetchTimers.current.paths < 20000) {
      console.log(`Skipping fetchLivePaths - too soon (${Math.round((now - fetchTimers.current.paths)/1000)}s)`);
      return livePaths;
    }
  
    setIsLoading(true);
    try {
      console.log(`Fetching live paths at ${new Date().toISOString()}`);
      const response = await api.get(`/path/live?intersectOnly=${showIntersectingOnly}`);
      
      fetchTimers.current.paths = now;
      setLivePaths(response.data.data || []);
      setLastUpdated(new Date());
      
      console.log(`Fetched ${response.data.data?.length || 0} paths`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching paths:', error);
      setError('Failed to fetch paths');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch all active users' locations
  const fetchLiveUsers = async () => {
    // Prevent calling too frequently
    const now = Date.now();
    if (now - fetchTimers.current.users < 20000) {
      console.log(`Skipping fetchLiveUsers - too soon (${Math.round((now - fetchTimers.current.users)/1000)}s)`);
      return liveUsers;
    }
    
    setIsLoading(true);
    try {
      console.log(`Fetching live users at ${new Date().toISOString()}`);
      const response = await api.get('/location/live');
      
      fetchTimers.current.users = now;
      setLiveUsers(response.data.data || []);
      setLastUpdated(new Date());
      
      console.log(`Fetched ${response.data.data?.length || 0} active users`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users');
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
      
      // Set up polling for live data
      const intervalId = setInterval(() => {
        fetchLiveUsers().catch(err => console.error('Failed to fetch users:', err));
        fetchLivePaths().catch(err => console.error('Failed to fetch paths:', err));
      }, 30000); // Use 30-second interval
      
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