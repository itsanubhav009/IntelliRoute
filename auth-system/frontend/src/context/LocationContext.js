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
  const [lastUpdated, setLastUpdated] = useState(new Date()); // Add this line

  // Update the user's location
  const updateLocation = async (latitude, longitude) => {
    if (!user) return;
    
    try {
      const response = await api.post('/location/update', { latitude, longitude });
      setPosition({ latitude, longitude });
      setLastUpdated(new Date()); // Update timestamp
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
      
      // Send the source and destination to the server
      // The server will calculate the actual route using OSRM
      const response = await api.post('/path/set', {
        source,
        destination
      });
      
      // Refresh paths after creating a new one
      await fetchLivePaths();
      setLastUpdated(new Date()); // Update timestamp
      
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 403) {
        // Special handling for inactive user error
        console.warn('User is not active enough to create paths');
        setError('You must have an active location to create paths');
      } else {
        console.error('Error creating path:', error);
        setError('Failed to create path: ' + (error.response?.data?.message || error.message));
      }
      throw error;
    }
  };

  // Fetch paths data for online users
  const fetchLivePaths = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching live paths with auth token:', !!localStorage.getItem('token'));
      const response = await api.get('/path/live');
      
      // Include timestamp in the live paths data
      const timestamp = response.data.timestamp || new Date().toISOString();
      console.log(`Fetched ${response.data.data?.length || 0} paths at ${timestamp}`);
      
      setLivePaths(response.data.data || []);
      setLastUpdated(new Date()); // Update timestamp
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
      console.log('Fetching live users with auth token:', !!localStorage.getItem('token'));
      const response = await api.get('/location/live');
      console.log('Live users response:', response.data);
      setLiveUsers(response.data.data || []);
      setLastUpdated(new Date()); // Update timestamp
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
      
      // Set up polling for live data
      const intervalId = setInterval(() => {
        fetchLiveUsers().catch(err => console.error('Failed to fetch users:', err));
        fetchLivePaths().catch(err => console.error('Failed to fetch paths:', err));
      }, 10000); // Refresh every 10 seconds
      
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
        lastUpdated, // Add this to the exported context
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