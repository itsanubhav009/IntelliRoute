/**
 * LocationContext.jsx - Updated with proper path handling
 * Last updated: 2025-04-10 14:23:02
 */

import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import api from '../utils/api';
import { AuthContext } from './AuthContext';

export const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [position, setPosition] = useState(null);
  const [liveUsers, setLiveUsers] = useState([]);
  const [livePaths, setLivePaths] = useState([]); // Paths data
  const [usersAlongPath, setUsersAlongPath] = useState([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showIntersectingOnly, setShowIntersectingOnly] = useState(true); // Default to show only intersecting paths
  const [proximityRadius, setProximityRadius] = useState(500); // Default 500m radius
  
  // Add myPath state for easier tracking of current user's path
  const [myPath, setMyPath] = useState(null);
  
  // Cache to prevent redundant updates
  const dataCache = useRef({
    usersHash: null,
    pathsHash: null,
    usersAlongPathHash: null
  });
  
  // Ref to prevent concurrent requests and track timestamps
  const fetchTimers = useRef({
    users: 0,
    paths: 0,
    usersAlongPath: 0
  });
  
  // Flag to track if requests are in progress
  const requestInProgress = useRef({
    users: false,
    paths: false,
    usersAlongPath: false
  });

  // Simple hash function to compare data changes
  const hashData = (data) => {
    if (!data) return 'empty';
    return JSON.stringify(data)
      .split('')
      .reduce((a, b) => (((a << 5) - a) + b.charCodeAt(0))|0, 0)
      .toString();
  };

  // Update the user's location
  const updateLocation = async (latitude, longitude) => {
    if (!user) return;
    
    try {
      console.log(`[2025-04-10 14:23:02] Updating location for user ${user.username || '[unknown]'}: ${latitude}, ${longitude}`);
      if (!user.username) {
        console.error('[2025-04-10 14:23:02] Missing username for API operation');
        setError('Your profile information is incomplete. Please log out and log in again.');
        return;
      }
      const response = await api.post('/location/update', { latitude, longitude });
      setPosition({ latitude, longitude });
      setLastUpdated(new Date());
      
      // Refresh path-related data after updating location
      fetchUsersAlongPath(true).catch(e => console.warn('Failed to refresh users along path:', e));
      
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
      console.log(`[2025-04-10 14:23:02] Creating path from [${source.lat}, ${source.lng}] to [${destination.lat}, ${destination.lng}]`);
      if (!user.username) {
        console.error('[2025-04-10 14:23:02] Missing username for API operation');
        setError('Your profile information is incomplete. Please log out and log in again.');
        return;
      }
      
      setIsLoading(true);
      
      const response = await api.post('/path/set', {
        source,
        destination
      });
      
      console.log(`[2025-04-10 14:23:02] Path created successfully with ID: ${response.data?.pathId || 'unknown'}`);
      
      // Refresh paths to get new path data
      await fetchLivePaths(true);
      
      // Then fetch users along the new path
      await fetchUsersAlongPath(true);
      
      setLastUpdated(new Date());
      setIsLoading(false);
      
      return response.data;
    } catch (error) {
      setIsLoading(false);
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
    fetchLivePaths(true, newValue); // Force refresh with new filter
    
    return newValue;
  };

  // Fetch paths data with improved error handling
  const fetchLivePaths = async (force = false, intersectOnly = showIntersectingOnly) => {
    if (!user) return [];
    
    // If a request is already in progress, skip this one
    if (requestInProgress.current.paths && !force) {
      return livePaths;
    }
    
    const now = Date.now();
    // Apply throttling for requests
    if (!force && now - fetchTimers.current.paths < 300) {
      return livePaths;
    }
    
    try {
      requestInProgress.current.paths = true;
      fetchTimers.current.paths = now;
      
      // Only show loading if forced - reduces UI flicker
      if (force) setIsLoading(true);
      
      console.log(`[2025-04-10 14:23:02] Fetching paths with intersectOnly=${intersectOnly}`);
      
      const response = await api.get(`/path/live?intersectOnly=${intersectOnly}`);
      const pathsData = response.data.data || [];
      
      console.log(`[2025-04-10 14:23:02] Received ${pathsData.length} paths from API`);
      
      // Check for and log current user's path
      if (user && user.id) {
        const currentUserPath = pathsData.find(path => path.user_id === user.id);
        if (currentUserPath) {
          console.log(`[2025-04-10 14:23:02] Found current user's path: ID=${currentUserPath.id}`);
          setMyPath(currentUserPath);
        } else {
          console.log(`[2025-04-10 14:23:02] No path found for current user`);
          setMyPath(null);
        }
      }
      
      // Only update UI if data has changed, reducing render cycles
      const newDataHash = hashData(pathsData);
      if (force || newDataHash !== dataCache.current.pathsHash) {
        console.log(`[2025-04-10 14:23:02] Updating paths state with ${pathsData.length} paths`);
        
        dataCache.current.pathsHash = newDataHash;
        setLivePaths(pathsData);
        setLastUpdated(new Date());
      }
      
      if (force) setIsLoading(false);
      return pathsData;
    } catch (error) {
      console.error('[2025-04-10 14:23:02] Error fetching paths:', error);
      if (force) {
        setError('Failed to fetch paths');
        setIsLoading(false);
      }
      return livePaths;
    } finally {
      requestInProgress.current.paths = false;
    }
  };

  // Fetch users who are physically located along the current user's path
  const fetchUsersAlongPath = async (force = false) => {
    if (!user) return [];
    
    // If a request is already in progress, skip this one
    if (requestInProgress.current.usersAlongPath && !force) {
      return usersAlongPath;
    }
    
    const now = Date.now();
    // Apply throttling for requests
    if (!force && now - fetchTimers.current.usersAlongPath < 300) {
      return usersAlongPath;
    }
    
    try {
      requestInProgress.current.usersAlongPath = true;
      fetchTimers.current.usersAlongPath = now;
      
      // Only show loading if forced
      if (force) setIsLoading(true);
      
      console.log(`[2025-04-10 14:23:02] Fetching users along path with radius ${proximityRadius}m`);
      
      const response = await api.get(`/location/along-my-path?radius=${proximityRadius}`);
      const usersData = response.data.data || [];
      
      console.log(`[2025-04-10 14:23:02] Found ${usersData.length} users along current user's path`);
      
      // Only update UI if data has changed
      const newDataHash = hashData(usersData);
      if (force || newDataHash !== dataCache.current.usersAlongPathHash) {
        dataCache.current.usersAlongPathHash = newDataHash;
        setUsersAlongPath(usersData);
        setLastUpdated(new Date());
      }
      
      if (force) setIsLoading(false);
      return usersData;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // No path found for current user is expected in some cases
        console.log('[2025-04-10 14:23:02] No path found for current user');
        setUsersAlongPath([]);
        dataCache.current.usersAlongPathHash = hashData([]);
        return [];
      } else {
        console.error('[2025-04-10 14:23:02] Error fetching users along path:', error);
        if (force) {
          setError('Failed to fetch users along path');
          setIsLoading(false);
        }
        return usersAlongPath;
      }
    } finally {
      requestInProgress.current.usersAlongPath = false;
    }
  };

  // Fetch all active users' locations
  const fetchLiveUsers = async (force = false) => {
    if (!user) return [];
    
    // If a request is already in progress, skip this one
    if (requestInProgress.current.users && !force) {
      return liveUsers;
    }
    
    const now = Date.now();
    // Apply throttling for requests
    if (!force && now - fetchTimers.current.users < 300) {
      return liveUsers;
    }
    
    try {
      requestInProgress.current.users = true;
      fetchTimers.current.users = now;
      
      // Only show loading if forced
      if (force) setIsLoading(true);
      
      const response = await api.get('/location/live');
      const userData = response.data.data || [];
      
      // Validate coordinates before setting state
      const validUsers = userData.filter(u => {
        const lat = parseFloat(u.latitude);
        const lng = parseFloat(u.longitude);
        return !isNaN(lat) && !isNaN(lng) && 
               Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
      });
      
      // Only update UI if data has changed
      const newDataHash = hashData(validUsers);
      if (force || newDataHash !== dataCache.current.usersHash) {
        dataCache.current.usersHash = newDataHash;
        setLiveUsers(validUsers);
        setLastUpdated(new Date());
      }
      
      if (force) setIsLoading(false);
      return validUsers;
    } catch (error) {
      console.error('[2025-04-10 14:23:02] Error fetching users:', error);
      if (force) {
        setError('Failed to fetch users');
        setIsLoading(false);
      }
      return liveUsers;
    } finally {
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
          
          // Update server with this location
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

  // Force refresh all data
  const forceRefreshData = async () => {
    console.log("[2025-04-10 14:23:02] Force refreshing all location data...");
    setIsLoading(true);
    
    try {
      // Reset cache to force UI updates
      dataCache.current = {
        usersHash: null,
        pathsHash: null,
        usersAlongPathHash: null
      };
      
      // Fetch data in sequence to avoid race conditions
      console.log("[2025-04-10 14:23:02] Refreshing paths data");
      const pathsData = await fetchLivePaths(true);
      
      console.log("[2025-04-10 14:23:02] Refreshing users data");
      const userData = await fetchLiveUsers(true);
      
      console.log("[2025-04-10 14:23:02] Refreshing users along path data");
      const usersAlongPathData = await fetchUsersAlongPath(true);
      
      setLastUpdated(new Date());
      console.log("[2025-04-10 14:23:02] All data refreshed successfully");
      
      return { 
        users: userData, 
        paths: pathsData,
        usersAlongPath: usersAlongPathData
      };
    } catch (error) {
      console.error("[2025-04-10 14:23:02] Error in force refresh:", error);
      setError("Failed to refresh location data: " + error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Update proximity radius
  const updateProximityRadius = (radius) => {
    console.log(`[2025-04-10 14:23:02] Updating proximity radius to ${radius}m`);
    setProximityRadius(radius);
    
    // Refresh users along path with new radius
    fetchUsersAlongPath(true);
  };

  // Initial setup and data refresh
  useEffect(() => {
    if (user) {
      // Get current location first
      getCurrentPosition();
      
      console.log('[2025-04-10 14:23:02] Setting up initial data load and refresh cycle');
      
      // Initial load
      forceRefreshData().catch(e => console.error('Initial data load failed:', e));
      
      // Regular refresh cycle
      const intervalId = setInterval(() => {
        if (!isLoading) {
          console.log('[2025-04-10 14:23:02] Running periodic data refresh');
          
          // Refresh paths first
          fetchLivePaths()
            .then(() => fetchUsersAlongPath())
            .then(() => fetchLiveUsers())
            .catch(e => console.error('Periodic refresh failed:', e));
        }
      }, 10000); // 10-second refresh interval
      
      return () => {
        console.log('[2025-04-10 14:23:02] Cleaning up refresh interval');
        clearInterval(intervalId);
      };
    }
  }, [user]);

  return (
    <LocationContext.Provider
      value={{
        position,
        liveUsers,
        livePaths,
        myPath, // Added for easy access to current user's path
        usersAlongPath,
        isLoading,
        error,
        lastUpdated,
        showIntersectingOnly,
        proximityRadius,
        updateLocation,
        createPath,
        fetchLiveUsers,
        fetchLivePaths,
        fetchUsersAlongPath,
        toggleIntersectionFilter,
        updateProximityRadius,
        getCurrentPosition,
        forceRefreshData
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export default LocationProvider;