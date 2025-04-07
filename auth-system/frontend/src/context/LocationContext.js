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
  
<<<<<<< HEAD
  // Ref to prevent concurrent requests and track timestamps
=======
  // Add this fetchTimers ref to solve the undefined error
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
  const fetchTimers = useRef({
    users: 0,
    paths: 0
  });
  
  // Flag to track if requests are in progress
  const requestInProgress = useRef({
    users: false,
    paths: false
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
      await fetchLivePaths(true); // Force refresh
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
<<<<<<< HEAD
    fetchLivePaths(true, newValue); // Force refresh with new filter
=======
    fetchLivePaths(newValue);
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
    
    return newValue;
  };

<<<<<<< HEAD
  // Fetch paths data with aggressive throttling
  const fetchLivePaths = async (force = false, intersectOnly = showIntersectingOnly) => {
    // If a request is already in progress, skip this one
    if (requestInProgress.current.paths && !force) {
      console.log('Path request already in progress, skipping');
      return livePaths;
    }
    
    const now = Date.now();
    // Only fetch if forced or it's been at least 60 seconds since last check (was 20s)
    if (!force && now - fetchTimers.current.paths < 60000) {
      console.log(`Skipping fetchLivePaths - too soon (${Math.round((now - fetchTimers.current.paths)/1000)}s)`);
      return livePaths;
    }
    
    try {
      requestInProgress.current.paths = true;
      setIsLoading(true);
=======
  // Fetch paths data for online users, with optional intersection filtering
  const fetchLivePaths = async (intersectOnly = showIntersectingOnly) => {
    setIsLoading(true);
    try {
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
      console.log(`Fetching paths with intersection filter: ${intersectOnly}`);
      
      const response = await api.get(`/path/live?intersectOnly=${intersectOnly}`);
      
      console.log(`Fetched ${response.data.data?.length || 0} paths`);
<<<<<<< HEAD
=======
      if (intersectOnly) {
        console.log('Intersection filter active, showing only paths that cross your route');
      }
      
      const now = Date.now();
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
      fetchTimers.current.paths = now;
      setLivePaths(response.data.data || []);
      setLastUpdated(new Date());
      return response.data.data;
    } catch (error) {
      console.error('Error fetching paths:', error);
      setError('Failed to fetch paths');
      return livePaths;
    } finally {
      setIsLoading(false);
      requestInProgress.current.paths = false;
    }
  };

  // Fetch all active users' locations with aggressive throttling
  const fetchLiveUsers = async (force = false) => {
    // If a request is already in progress, skip this one
    if (requestInProgress.current.users && !force) {
      console.log('User request already in progress, skipping');
      return liveUsers;
    }
    
    const now = Date.now();
    // Only fetch if forced or it's been at least 60 seconds since last check (was 20s)
    if (!force && now - fetchTimers.current.users < 60000) {
      console.log(`Skipping fetchLiveUsers - too soon (${Math.round((now - fetchTimers.current.users)/1000)}s)`);
      return liveUsers;
    }
    
    try {
<<<<<<< HEAD
      requestInProgress.current.users = true;
      setIsLoading(true);
      console.log('Fetching live users...');
      
      const response = await api.get('/location/live');
      fetchTimers.current.users = now;
      
      // Process and validate the data before setting state
      const userData = response.data.data || [];
      console.log(`Got ${userData.length} users from API`);
      
      // Validate coordinates before setting state
      const validUsers = userData.filter(u => {
        const lat = parseFloat(u.latitude);
        const lng = parseFloat(u.longitude);
        const isValid = !isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
        
        if (!isValid && u) {
          console.warn(`Filtered out user with invalid coordinates:`, u.username, u.latitude, u.longitude);
        }
        
        return isValid;
      });
      
      console.log(`${validUsers.length} users have valid coordinates`);
      setLiveUsers(validUsers);
      setLastUpdated(new Date());
      return validUsers;
=======
      const response = await api.get('/location/live');
      fetchTimers.current.users = now;
      setLiveUsers(response.data.data || []);
      setLastUpdated(new Date());
      console.log(`Fetched ${response.data.data?.length || 0} online users`);
      return response.data.data;
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users');
      return liveUsers;
    } finally {
      setIsLoading(false);
      requestInProgress.current.users = false;
    }
  };
  
  // Get browser geolocation - only do this at startup
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

  // Force refresh data function - useful for manual refresh button
  const forceRefreshData = async () => {
    console.log("Force refreshing location data...");
    setIsLoading(true);
    try {
      // Bypass throttling
      fetchTimers.current = {
        users: 0,
        paths: 0
      };
      
      // First get users
      const userData = await fetchLiveUsers(true);
      console.log("Users refreshed:", userData?.length || 0);
      
      // Then get paths
      const pathsData = await fetchLivePaths(true);
      console.log("Paths refreshed:", pathsData?.length || 0);
      
      setLastUpdated(new Date());
      return { users: userData, paths: pathsData };
    } catch (error) {
      console.error("Error in force refresh:", error);
      setError("Failed to refresh location data: " + error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Initial setup and much less frequent polling
  useEffect(() => {
    if (user) {
      // Get current location first
      getCurrentPosition();
      
<<<<<<< HEAD
      // Do initial data load
      const initialLoad = async () => {
        try {
          await fetchLiveUsers(true);
          await fetchLivePaths(true);
        } catch (error) {
          console.error('Error in initial data load:', error);
        }
      };
      
      initialLoad();
      
      // Set up polling with MUCH LONGER interval (2 minutes instead of 30 seconds)
      const intervalId = setInterval(() => {
        fetchLiveUsers().catch(err => console.error('Failed to fetch users:', err));
        fetchLivePaths().catch(err => console.error('Failed to fetch paths:', err));
      }, 120000); // Increased to 120 seconds (2 minutes) instead of 30 seconds
=======
      // Set up polling with the reduced 30-second interval
      const intervalId = setInterval(() => {
        fetchLiveUsers().catch(err => console.error('Failed to fetch users:', err));
        fetchLivePaths().catch(err => console.error('Failed to fetch paths:', err));
      }, 30000); // Use 30 seconds to reduce refreshing frequency
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
      
      return () => clearInterval(intervalId);
    }
  }, [user]);


  const forceRefreshData = async () => {
    console.log("Force refreshing location data...");
    setIsLoading(true);
    try {
      // Clear the timers to bypass throttling
      fetchTimers.current = {
        users: 0,
        paths: 0
      };
      
      // First get users
      const usersResponse = await api.get('/location/live');
      const userData = usersResponse.data.data || [];
      console.log("Users data:", userData);
      
      // Then get paths
      const pathsResponse = await api.get(`/path/live?intersectOnly=${showIntersectingOnly}`);
      const pathsData = pathsResponse.data.data || [];
      console.log("Paths data:", pathsData);
      
      // Update states
      setLiveUsers(userData);
      setLivePaths(pathsData);
      setLastUpdated(new Date());
      
      // Return data for any additional processing
      return { users: userData, paths: pathsData };
    } catch (error) {
      console.error("Error in force refresh:", error);
      setError("Failed to refresh location data: " + error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

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
        getCurrentPosition,
<<<<<<< HEAD
        forceRefreshData
=======
        forceRefreshData  // Add this new function
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};