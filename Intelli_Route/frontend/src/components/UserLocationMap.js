import React, { useEffect, useState, useContext, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import { LocationContext } from '../context/LocationContext';
import { AuthContext } from '../context/AuthContext';
import { ChatContext } from '../context/ChatContext';
import ChatDialog from './ChatDialog';
import NotificationsPanel from './NotificationsPanel';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './UserLocationMap.css';
import NotificationButton from './NotificationButton';
// Fix for default icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faSync, faComment, faUser, faBell, faRuler, faMapMarkerAlt, faEye, faEyeSlash, faInfo, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
// Define default Leaflet icon
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Debounce function to limit how often a function can be called
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Optimized parse route function with caching
const routeCache = new Map();
const parseRouteData = (routeData) => {
  if (!routeData) return [];
  
  // Check cache first
  const cacheKey = typeof routeData === 'string' ? routeData : JSON.stringify(routeData);
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }
  
  let result = [];
  
  // LINESTRING parsing
  if (typeof routeData === 'string' && routeData.startsWith('LINESTRING')) {
    try {
      // Extract coordinates from LINESTRING(lng lat, lng lat, ...)
      const coordsStr = routeData.substring(routeData.indexOf('(') + 1, routeData.lastIndexOf(')'));
      result = coordsStr.split(',').map(pair => {
        const [lng, lat] = pair.trim().split(' ').map(parseFloat);
        // Return [lat, lng] for Leaflet
        return [lat, lng]; 
      });
    } catch (e) {
      console.error('Error parsing LINESTRING:', e);
      result = [];
    }
  } else if (Array.isArray(routeData)) {
    result = routeData;
  }
  
  // Store in cache for future calls
  routeCache.set(cacheKey, result);
  return result;
};

// Memoized MapBoundsUpdater component
const MapBoundsUpdater = React.memo(({ users, paths, usersAlongPath }) => {
  const map = useMap();
  const boundsRef = useRef(null);
  
  useEffect(() => {
    // Only focus on users along paths and our own path when available
    const shouldUpdate = usersAlongPath.length > 0 || paths.length > 0;
    if (!shouldUpdate) return;
    
    // Skip if bounds calculation already in progress
    if (boundsRef.current) return;
    
    // Defer bounds calculation to next animation frame
    boundsRef.current = requestAnimationFrame(() => {
      try {
        const points = [];
        
        // PRIORITY 1: Add users along path - these are the most important points
        usersAlongPath.forEach(user => {
          if (user.latitude && user.longitude) {
            points.push([user.latitude, user.longitude]);
          }
        });
        
        // PRIORITY 2: Add path points (current user's path)
        paths.forEach(path => {
          if (path.parsedRoute && Array.isArray(path.parsedRoute)) {
            const routePoints = path.parsedRoute;
            if (routePoints.length > 0) {
              points.push(routePoints[0]); // First point
              
              if (routePoints.length > 10) {
                // Just sample a few points instead of processing all
                points.push(routePoints[Math.floor(routePoints.length / 3)]);
                points.push(routePoints[Math.floor(routePoints.length * 2 / 3)]);
              }
              
              if (routePoints.length > 1) {
                points.push(routePoints[routePoints.length - 1]); // Last point
              }
            }
          }
        });
        
        // PRIORITY 3: Add other visible users only if we don't have path users
        if (points.length === 0) {
          users.forEach(user => {
            if (user.latitude && user.longitude) {
              points.push([user.latitude, user.longitude]);
            }
          });
        }
        
        if (points.length > 0) {
          const bounds = L.latLngBounds(points);
          map.fitBounds(bounds, { padding: [50, 50], animate: false }); // Disable animation for better performance
        }
      } catch (error) {
        console.error('Error updating map bounds:', error);
      }
      
      boundsRef.current = null;
    });
    
    return () => {
      if (boundsRef.current) {
        cancelAnimationFrame(boundsRef.current);
        boundsRef.current = null;
      }
    };
  }, [users, paths, usersAlongPath, map]);
  
  return null;
});

// Component to handle map clicks for route creation - optimized with useCallback
function MapClickHandler({ routeMode, selectedSource, setSelectedSource, createPath, setClickPoint }) {
  const handleClick = useCallback((e) => {
    if (!routeMode) return;
    
    // Get precise coordinates
    const { lat, lng } = e.latlng;
    
    // Show click point indicator
    if (setClickPoint) {
      setClickPoint({ lat, lng });
      setTimeout(() => setClickPoint(null), 1000);
    }
    
    console.log(`[2025-04-10 13:58:20] Map clicked at: [${lat}, ${lng}]`);
    
    if (!selectedSource) {
      // Set source with precise coordinates
      setSelectedSource({ 
        lat: parseFloat(lat.toFixed(6)), 
        lng: parseFloat(lng.toFixed(6)) 
      });
      console.log('[2025-04-10 13:58:20] Source point set');
    } else {
      // Set destination with precise coordinates
      const destination = { 
        lat: parseFloat(lat.toFixed(6)), 
        lng: parseFloat(lng.toFixed(6)) 
      };
      console.log(`[2025-04-10 13:58:20] Creating path from [${selectedSource.lat}, ${selectedSource.lng}] to [${destination.lat}, ${destination.lng}]`);
      createPath(selectedSource, destination);
    }
  }, [routeMode, selectedSource, setSelectedSource, createPath, setClickPoint]);
  
  useMapEvents({
    click: handleClick
  });
  
  return null;
}

// Memoized marker component to prevent unnecessary re-renders
const UserMarker = React.memo(({ user, currentUser, handleChatRequest, chatRequestSending, formatTime, createCustomIcon }) => {
  // Parse coordinates once
  const lat = parseFloat(user.latitude);
  const lng = parseFloat(user.longitude);
  
  // Skip invalid coordinates
  if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }
  
  const markerIcon = user.id === currentUser?.id ? 
    createCustomIcon('#4285F4') : createCustomIcon('#FF5722');
  
  return (
    <Marker 
      key={`user-${user.id}`} 
      position={[lat, lng]}
      icon={markerIcon}
    >
      <Popup>
        <div className="user-popup">
          <h3><FontAwesomeIcon icon={faUser} /> {user.username}</h3>
          <div className="user-status">
            <span className="status-dot"></span>
            Online
          </div>
          <div className="user-location">
            Coordinates: {lat.toFixed(4)}, {lng.toFixed(4)}
          </div>
          <div className="user-last-active">
            Last active: {formatTime(user.last_active)}
          </div>
          
          {user.id === currentUser?.id ? (
            <div className="current-user-tag">This is you</div>
          ) : (
            <div className="chat-button-container">
              <button 
                className="chat-request-button"
                onClick={() => handleChatRequest(user.id, user.username)}
                disabled={chatRequestSending}
              >
                <FontAwesomeIcon icon={faComment} /> Chat with {user.username}
              </button>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
});

// User along path marker component
const PathUserMarker = React.memo(({ user, currentUser, handleChatRequest, chatRequestSending, formatTime }) => {
  // Parse coordinates once
  const lat = parseFloat(user.latitude);
  const lng = parseFloat(user.longitude);
  
  // Skip invalid coordinates
  if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }
  
  return (
    <Marker 
      key={`path-user-${user.id}`}
      position={[lat, lng]}
      icon={L.divIcon({
        className: 'along-path-marker',
        html: `<div class="marker-pin path-user" style="background-color: #4CAF50;"></div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
        popupAnchor: [0, -42]
      })}
    >
      <Popup>
        <div className="user-popup">
          <h3><FontAwesomeIcon icon={faUser} /> {user.username}</h3>
          <div className="user-status path-user">
            <span className="status-dot path-user"></span>
            Along Your Path
          </div>
          <div className="user-location">
            Coordinates: {lat.toFixed(4)}, {lng.toFixed(4)}
          </div>
          <div className="user-last-active">
            Last active: {formatTime(user.last_active)}
          </div>
          <div className="user-distance">
            <FontAwesomeIcon icon={faRuler} /> Distance to path: {user.distance_to_path ? `${Math.round(user.distance_to_path)}m` : 'Unknown'}
          </div>
          
          {user.id !== currentUser?.id && (
            <div className="chat-button-container">
              <button 
                className="chat-request-button path-user-chat"
                onClick={() => handleChatRequest(user.id, user.username)}
                disabled={chatRequestSending}
              >
                <FontAwesomeIcon icon={faComment} /> Chat with {user.username}
              </button>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
});

// Memoized path component to prevent unnecessary re-renders
const RoutePolyline = React.memo(({ path, idx, currentUserId, formatTime }) => {
  return (
    <Polyline 
      key={`path-${path.id || idx}`} 
      positions={path.parsedRoute} 
      color={path.user_id === currentUserId ? '#2196F3' : (path.intersects_with_user ? '#4CAF50' : '#FF5722')} 
      weight={4}
      opacity={0.7}
    >
      <Popup>
        <div className="path-popup">
          <h4>Route Information</h4>
          <p><strong>User:</strong> {path.username || 'Unknown'}</p>
          <p><strong>Created:</strong> {formatTime(path.created_at)}</p>
          {path.intersects_with_user && (
            <p className="intersecting-path-notice">This path intersects with your route!</p>
          )}
          {path.parsedRoute.length > 0 && (
            <>
              <p><strong>From:</strong> {path.parsedRoute[0][0].toFixed(4)}, {path.parsedRoute[0][1].toFixed(4)}</p>
              <p><strong>To:</strong> {path.parsedRoute[path.parsedRoute.length-1][0].toFixed(4)}, {path.parsedRoute[path.parsedRoute.length-1][1].toFixed(4)}</p>
              <p><strong>Points:</strong> {path.parsedRoute.length}</p>
            </>
          )}
        </div>
      </Popup>
    </Polyline>
  );
});

const UserLocationMap = () => {
  const { 
    liveUsers, 
    fetchLiveUsers, 
    livePaths, 
    fetchLivePaths, 
    createPath, 
    showIntersectingOnly, 
    toggleIntersectionFilter,
    forceRefreshData,
    usersAlongPath, // Users along the current path - these are visible
    fetchUsersAlongPath, 
    proximityRadius, 
    updateProximityRadius 
  } = useContext(LocationContext);
  
  const { user } = useContext(AuthContext);
  const { 
    sendChatRequest, 
    notifications, 
    currentChat, 
    openChat,
    activeChats,
    fetchActiveChats,
    fetchNotifications
  } = useContext(ChatContext);
  
  const [usersWithLocation, setUsersWithLocation] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [pathsWithCoordinates, setPathsWithCoordinates] = useState([]);
  const [routeMode, setRouteMode] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [chatRequestSending, setChatRequestSending] = useState(false);
  const [chatRequestStatus, setChatRequestStatus] = useState(null);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [clickPoint, setClickPoint] = useState(null);
  const [showRadiusControl, setShowRadiusControl] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false); // New state for toggling all users visibility
  
  const mapRef = useRef(null);
  const mapCenter = useRef([37.7749, -122.4194]);
  const isInitialLoad = useRef(true);
  const dataProcessingRef = useRef(false);
  
  // Fixed createCustomIcon function - memoized for performance
  const createCustomIcon = useCallback((color) => {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="marker-pin" style="background-color: ${color};"></div>`,
      iconSize: [30, 42],
      iconAnchor: [15, 42], // This should anchor at the bottom-center of the icon
      popupAnchor: [0, -42] // This positions the popup above the icon
    });
  }, []);

  // Handle radius changes - add this function
  const handleRadiusChange = (e) => {
    const newRadius = parseInt(e.target.value, 10);
    updateProximityRadius(newRadius);
  };

  // Optimized chat request handler
  const handleChatRequest = useCallback((userId, username) => {
    if (!userId || userId === user?.id || chatRequestSending) {
      if (userId === user?.id) {
        setChatRequestStatus({
          success: false,
          message: 'You cannot chat with yourself.'
        });
      }
      return;
    }
    
    setChatRequestSending(true);
    setChatRequestStatus({
      success: null,
      message: `Sending chat request...`
    });
    
    // Use a small timeout to allow UI to update before API call
    setTimeout(() => {
      sendChatRequest(userId)
        .then(() => {
          setChatRequestStatus({
            success: true,
            message: `Chat request sent to ${username || 'user'}!`
          });
          
          // Queue notification refresh after successful request
          setTimeout(() => {
            if (fetchNotifications) fetchNotifications(true);
          }, 100);
        })
        .catch((error) => {
          setChatRequestStatus({
            success: false,
            message: `Failed to send chat request: ${error.message || 'Unknown error'}`
          });
        })
        .finally(() => {
          setChatRequestSending(false);
          // Clear status message after a delay
          setTimeout(() => {
            setChatRequestStatus(null);
          }, 5000);
        });
    }, 50);
  }, [user, sendChatRequest, fetchNotifications, chatRequestSending]);

  // Handle refresh button click - debounced
  const handleRefresh = useCallback(debounce(async () => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      
      // Stagger requests to prevent UI blocking
      setTimeout(async () => {
        if (fetchNotifications) {
          await fetchNotifications(true).catch(e => console.error('Notification refresh error:', e));
        }
        
        setTimeout(async () => {
          if (forceRefreshData) {
            await forceRefreshData().catch(e => console.error('Data refresh error:', e));
          } else {
            await Promise.all([
              fetchLiveUsers().catch(e => console.error('User fetch error:', e)),
              fetchLivePaths().catch(e => console.error('Path fetch error:', e)),
              fetchUsersAlongPath().catch(e => console.error('Users along path fetch error:', e))
            ]);
          }
          
          setLastUpdated(new Date());
          setIsLoading(false);
        }, 50);
      }, 10);
    } catch (error) {
      console.error('Refresh failed:', error);
      setIsLoading(false);
    }
  }, 300), [fetchNotifications, forceRefreshData, fetchLiveUsers, fetchLivePaths, fetchUsersAlongPath, isLoading]);

  // Toggle "Show All Users" - new function
  const toggleShowAllUsers = useCallback(() => {
    setShowAllUsers(prev => !prev);
    console.log(`[2025-04-10 13:58:20] ${!showAllUsers ? 'Showing' : 'Hiding'} all users on map`);
  }, [showAllUsers]);

  // Optimized notification toggle
  const toggleNotifications = useCallback(() => {
    // Update UI immediately
    setShowNotifications(prev => !prev);
    
    // If we're opening the panel and not already loading, fetch notifications
    if (!showNotifications && !notificationLoading && fetchNotifications) {
      setNotificationLoading(true);
      
      // Delay API call to allow UI to update first
      requestAnimationFrame(() => {
        fetchNotifications(true)
          .catch(err => console.error('Notification refresh error:', err))
          .finally(() => setNotificationLoading(false));
      });
    }
  }, [showNotifications, notificationLoading, fetchNotifications]);

  // Fetch active chats on mount, with dependency optimization
  useEffect(() => {
    if (user && fetchActiveChats && !isLoading) {
      fetchActiveChats().catch(e => console.error('Error fetching chats:', e));
    }
  }, [user, fetchActiveChats, isLoading]);

  // Optimized effect for initial data load
  useEffect(() => {
    if (!user || !isInitialLoad.current) return;
    
    const loadInitialData = async () => {
      setIsLoading(true);
      
      try {
        // Load data sequentially to prevent UI blocking
        await fetchLiveUsers().catch(e => console.error('Error loading users:', e));
        await fetchLivePaths().catch(e => console.error('Error loading paths:', e));
        await fetchUsersAlongPath().catch(e => console.error('Error loading users along path:', e));
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Initial data load error:', error);
      } finally {
        setIsLoading(false);
        isInitialLoad.current = false;
      }
    };
    
    loadInitialData();
    
    // Setup periodic refresh that respects loading state
    let isMounted = true;
    let timeoutId = null;
    
    const loadMapData = async () => {
      if (!isMounted || isLoading) {
        // Schedule next update
        timeoutId = setTimeout(loadMapData, 60000);
        return;
      }
      
      try {
        const timeSinceUpdate = new Date() - lastUpdated;
        if (timeSinceUpdate > 30000) { // 30 seconds minimum
          setIsLoading(true);
          await fetchLiveUsers().catch(e => console.error('Background user fetch error:', e));
          await fetchLivePaths().catch(e => console.error('Background path fetch error:', e));
          await fetchUsersAlongPath().catch(e => console.error('Background users along path fetch error:', e));
          if (isMounted) {
            setLastUpdated(new Date());
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('Background refresh error:', error);
        if (isMounted) setIsLoading(false);
      }
      
      // Schedule next update
      if (isMounted) {
        timeoutId = setTimeout(loadMapData, 60000);
      }
    };
    
    // Start the refresh cycle after initial load
    timeoutId = setTimeout(loadMapData, 60000);
    
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, fetchLiveUsers, fetchLivePaths, fetchUsersAlongPath, isLoading, lastUpdated]);

  // Optimized effect to process user data without blocking UI
  useEffect(() => {
    if (!liveUsers || !Array.isArray(liveUsers) || dataProcessingRef.current) return;
    
    // Prevent concurrent processing
    dataProcessingRef.current = true;
    
    // Process in next frame to avoid blocking UI
    requestAnimationFrame(() => {
      try {
        // Filter users with valid coordinates
        const filtered = liveUsers.filter(u => {
          const lat = parseFloat(u.latitude);
          const lng = parseFloat(u.longitude);
          return !isNaN(lat) && !isNaN(lng) && 
                 Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
        });
        
        // Update center only if we have users and it has changed
        if (filtered.length > 0) {
          const totalLat = filtered.reduce((sum, u) => sum + parseFloat(u.latitude), 0);
          const totalLng = filtered.reduce((sum, u) => sum + parseFloat(u.longitude), 0);
          
          const newCenter = [
            totalLat / filtered.length,
            totalLng / filtered.length
          ];
          
          // Only update ref if center has changed significantly
          if (Math.abs(newCenter[0] - mapCenter.current[0]) > 0.001 || 
              Math.abs(newCenter[1] - mapCenter.current[1]) > 0.001) {
            mapCenter.current = newCenter;
          }
        }
        
        setUsersWithLocation(filtered);
      } catch (err) {
        console.error('Error processing user data:', err);
        setUsersWithLocation([]);
      } finally {
        dataProcessingRef.current = false;
      }
    });
  }, [liveUsers]);

  // Memoized path processing
  const processedPaths = useMemo(() => {
    if (!livePaths) return [];
    
    try {
      // Batch process paths
      const parsed = livePaths.map(path => ({
        ...path,
        parsedRoute: parseRouteData(path.route)
      })).filter(path => path.parsedRoute && path.parsedRoute.length > 0);
      
      return parsed;
    } catch (err) {
      console.error('Error processing paths:', err);
      return [];
    }
  }, [livePaths]);
  
  // Update path state, but only when processed data changes
  useEffect(() => {
    setPathsWithCoordinates(processedPaths);
  }, [processedPaths]);

  // Optimized toggle functions
  const toggleRouteMode = useCallback(() => {
    setRouteMode(prev => !prev);
    setSelectedSource(null);
  }, []);

  const handleCreatePath = useCallback((source, destination) => {
    if (createPath) {
      createPath(source, destination);
    }
    setRouteMode(false);
    setSelectedSource(null);
  }, [createPath]);

  const handleToggleIntersectionFilter = useCallback(() => {
    if (toggleIntersectionFilter) {
      toggleIntersectionFilter();
    }
  }, [toggleIntersectionFilter]);

  // Memoized time formatter for better performance
  const formatTime = useCallback((date) => {
    if (!(date instanceof Date)) {
      try {
        date = new Date(date);
      } catch (e) {
        return 'Unknown';
      }
    }
    return date.toLocaleTimeString();
  }, []);

  // Memoized center point calculation
  const mapCenterPoint = useMemo(() => {
    // Prioritize users along path for center calculation
    if (usersAlongPath && usersAlongPath.length > 0) {
      // Average position of users along path
      const totalLat = usersAlongPath.reduce((sum, u) => sum + parseFloat(u.latitude || 0), 0);
      const totalLng = usersAlongPath.reduce((sum, u) => sum + parseFloat(u.longitude || 0), 0);
      return [totalLat / usersAlongPath.length, totalLng / usersAlongPath.length];
    }
    // Fall back to all users if no path users
    else if (usersWithLocation.length > 0) {
      return mapCenter.current;
    } 
    // Default center
    else {
      return [37.7749, -122.4194]; // Default to San Francisco
    }
  }, [usersWithLocation, usersAlongPath]);

  // Filter users - key change for path-specific visibility
  const filteredUsers = useMemo(() => {
    // By default, don't show regular users unless showAllUsers is enabled
    if (!showAllUsers) {
      // Only show current user's position
      return usersWithLocation.filter(u => u.id === user?.id);
    }
    
    // If we want to show all users, still filter out users along path to avoid duplicates
    if (!usersWithLocation || !usersAlongPath) return usersWithLocation;
    
    // Create a Set of user IDs from usersAlongPath for fast lookup
    const pathUserIds = new Set(usersAlongPath.map(u => u.id));
    
    // Filter out users that are in usersAlongPath
    return usersWithLocation.filter(u => !pathUserIds.has(u.id));
  }, [usersWithLocation, usersAlongPath, user, showAllUsers]);

  return (
    <div className="map-container">
      <div className="map-header">
        <h3>Live User Map</h3>
        <div className="map-controls">
          <div className="notification-controls">
            <NotificationButton 
              notificationCount={notifications ? notifications.length : 0}
              onClick={toggleNotifications}
              isLoading={notificationLoading}
            />
            
            {/* Manual refresh button */}
            <button 
              className={`refresh-button ${isLoading ? 'loading' : ''}`}
              onClick={handleRefresh}
              title="Refresh map data"
              disabled={isLoading}
            >
              <FontAwesomeIcon icon={faSync} className={isLoading ? 'rotating' : ''} />
            </button>
            
            {/* Filter button */}
            <button
              className={`filter-button ${showIntersectingOnly ? 'active' : ''}`}
              onClick={handleToggleIntersectionFilter}
              title="Show only paths that intersect with your route"
            >
              {showIntersectingOnly ? 'Show All Paths' : 'Show Intersecting'}
            </button>
            
            {/* Toggle all users visibility - NEW */}
            <button
              className={`users-toggle-button ${showAllUsers ? 'active' : ''}`}
              onClick={toggleShowAllUsers}
              title={showAllUsers ? "Hide regular users" : "Show all users"}
            >
              <FontAwesomeIcon icon={showAllUsers ? faEye : faEyeSlash} /> 
              {showAllUsers ? "All Users" : "Path Users Only"}
            </button>
            
            {/* Path users proximity control */}
            <button
              className={`path-users-button ${usersAlongPath.length > 0 ? 'has-users' : ''}`}
              onClick={() => setShowRadiusControl(prev => !prev)}
              title="Users along your path"
            >
              <FontAwesomeIcon icon={faMapMarkerAlt} /> Path Users ({usersAlongPath.length})
            </button>
          </div>
          
          <button 
            className={`route-button ${routeMode ? 'active' : ''}`} 
            onClick={toggleRouteMode}
          >
            {routeMode ? 'Cancel Route' : 'Create Route'}
          </button>
          
          {routeMode && !selectedSource && (
            <div className="route-instructions">Click to set starting point</div>
          )}
          
          {routeMode && selectedSource && (
            <div className="route-instructions">Click to set destination</div>
          )}
          
          <span className="last-updated">
            Updated: {formatTime(lastUpdated)}
          </span>
        </div>
      </div>
      
      {/* Chat request status message */}
      {chatRequestStatus && (
        <div className={`chat-request-status ${chatRequestStatus.success === true ? 'success' : chatRequestStatus.success === false ? 'error' : 'pending'}`}>
          {chatRequestStatus.message}
        </div>
      )}
      
      {/* Show notifications panel when toggled */}
      {showNotifications && (
        <NotificationsPanel onClose={() => setShowNotifications(false)} />
      )}
      
      {/* Show radius control panel when toggled */}
      {showRadiusControl && (
        <div className="radius-control-panel">
          <h4>Users Along Path Settings</h4>
          <label>
            Proximity Radius: {proximityRadius}m
            <input 
              type="range" 
              min="100" 
              max="2000" 
              step="100" 
              value={proximityRadius} 
              onChange={handleRadiusChange}
            />
          </label>
          <div className="radius-info">
            Shows users within {proximityRadius}m of your path.
          </div>
          <button 
            className="refresh-users-button"
            onClick={() => fetchUsersAlongPath(true)}
            disabled={isLoading}
          >
            <FontAwesomeIcon icon={faSync} className={isLoading ? 'rotating' : ''} /> 
            Refresh Users
          </button>
          <button 
            className="close-panel-button"
            onClick={() => setShowRadiusControl(false)}
          >
            Close
          </button>
        </div>
      )}
      
      {/* Path-related visibility info messages */}
      {!showAllUsers && usersAlongPath.length === 0 && pathsWithCoordinates.length > 0 && (
        <div className="path-visibility-info">
          <FontAwesomeIcon icon={faEyeSlash} /> No users are currently along your path. Create a path where other users are located to see them.
        </div>
      )}
      
      {/* Intersection filter info message */}
      {showIntersectingOnly && pathsWithCoordinates.length === 0 && (
  <div className="intersection-filter-info">
    <FontAwesomeIcon icon={faInfoCircle} /> 
    No intersecting paths found.
  </div>
)}
      
      <MapContainer 
        center={mapCenterPoint} 
        zoom={4} 
        style={{ height: '600px', width: '100%' }}
        ref={mapRef}
        preferCanvas={true} // Use canvas renderer for better performance
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Map click handler for route creation */}
        <MapClickHandler 
          routeMode={routeMode} 
          selectedSource={selectedSource} 
          setSelectedSource={setSelectedSource} 
          createPath={handleCreatePath}
          setClickPoint={setClickPoint}
        />
        
        {/* Regular user markers - Only shown when showAllUsers is true or it's the current user */}
        {filteredUsers.slice(0, 100).map(u => (
          <UserMarker
            key={`user-${u.id}`}
            user={u}
            currentUser={user}
            handleChatRequest={handleChatRequest}
            chatRequestSending={chatRequestSending}
            formatTime={formatTime}
            createCustomIcon={createCustomIcon}
          />
        ))}

        {/* Users along path markers - THESE ARE ALWAYS VISIBLE */}
        {usersAlongPath.map(u => (
          <PathUserMarker 
            key={`path-user-${u.id}`}
            user={u}
            currentUser={user}
            handleChatRequest={handleChatRequest}
            chatRequestSending={chatRequestSending}
            formatTime={formatTime}
          />
        ))}

        {/* Display route source marker if in route mode */}
        {routeMode && selectedSource && (
          <Marker 
            key="source-marker"
            position={[selectedSource.lat, selectedSource.lng]}
            icon={createCustomIcon('#00C853')}
            zIndexOffset={1000} // This ensures the source marker is on top of other markers
          >
            <Popup>
              <div className="route-marker-popup">
                <strong>Starting Point</strong>
                <div>Lat: {selectedSource.lat.toFixed(6)}</div>
                <div>Lng: {selectedSource.lng.toFixed(6)}</div>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Display paths with performance optimizations */}
        {pathsWithCoordinates.slice(0, 50).map((path, idx) => (
          <RoutePolyline 
            key={`path-${path.id || idx}`}
            path={path}
            idx={idx}
            currentUserId={user?.id}
            formatTime={formatTime}
          />
        ))}

        {/* Show click point indicator */}
        {clickPoint && (
          <CircleMarker
            center={[clickPoint.lat, clickPoint.lng]}
            radius={5}
            color="#3388ff"
            fill={true}
            fillColor="#3388ff"
            fillOpacity={0.5}
          />
        )}
        
        {/* Map bounds updater component - Updated to prioritize path users */}
        <MapBoundsUpdater 
          users={filteredUsers} 
          paths={pathsWithCoordinates}
          usersAlongPath={usersAlongPath}
        />
      </MapContainer>
      
      <div className="map-legend">
        <h4>Map Legend</h4>
        <div className="legend-items">
          <div className="legend-item">
            <div className="legend-marker" style={{ backgroundColor: '#4285F4' }}></div>
            <span>Your location</span>
          </div>
          {showAllUsers && (
            <div className="legend-item">
              <div className="legend-marker" style={{ backgroundColor: '#FF5722' }}></div>
              <span>Other users</span>
            </div>
          )}
          <div className="legend-item">
            <div className="legend-marker" style={{ backgroundColor: '#4CAF50' }}></div>
            <span>Users along your path</span>
          </div>
          <div className="legend-item">
            <div className="legend-line" style={{ backgroundColor: '#2196F3' }}></div>
            <span>Your path</span>
          </div>
          <div className="legend-item">
            <div className="legend-line" style={{ backgroundColor: '#4CAF50' }}></div>
            <span>Intersecting paths</span>
          </div>
          <div className="legend-item">
            <div className="legend-line" style={{ backgroundColor: '#FF5722' }}></div>
            <span>Other users' paths</span>
          </div>
          {routeMode && (
            <div className="legend-item">
              <div className="legend-marker" style={{ backgroundColor: '#00C853' }}></div>
              <span>Starting point</span>
            </div>
          )}
        </div>
      </div>

      {/* Display path information and active chats panel */}
      <div className="map-info-panel">
        <h4>Statistics</h4>
        <div className="map-stats">
          <div className="stat-item">
            <strong>Active Users:</strong> {usersWithLocation.length}
          </div>
          <div className="stat-item">
            <strong>Users Along Your Path:</strong> {usersAlongPath.length}
          </div>
          <div className="stat-item">
            <strong>Active Paths:</strong> {pathsWithCoordinates.length}
          </div>
          <div className="stat-item">
            <strong>Last Updated:</strong> {formatTime(lastUpdated)}
          </div>
        </div>
        
        {/* Path Visibility Explanation - NEW */}
        <div className="visibility-explanation">
          <h4>Path Visibility</h4>
          <p>
            <FontAwesomeIcon icon={faEye} /> Users are only visible if they are physically located along your selected path.
          </p>
          <p>
            <FontAwesomeIcon icon={faMapMarkerAlt} /> Create a path to see users along that route.
          </p>
        </div>
        
        {/* Active Chats Panel */}
        <div className="active-chats">
          <h4>
            <FontAwesomeIcon icon={faComments} /> Active Chats
          </h4>
          <div className="chats-list">
            {activeChats && activeChats.length > 0 ? (
              activeChats.map(chat => (
                <div 
                  key={chat.id} 
                  className="chat-item"
                  onClick={() => openChat(chat.id)}
                >
                  <div className="chat-user">
                    {chat.otherParticipants && chat.otherParticipants.length > 0 
                      ? chat.otherParticipants[0].username 
                      : 'Unknown User'}
                  </div>
                  {chat.unreadCount > 0 && (
                    <span className="unread-badge">{chat.unreadCount}</span>
                  )}
                </div>
              ))
            ) : (
              <div className="no-chats">No active chats</div>
            )}
          </div>
        </div>
        
        {/* Users Along Path Panel - Make this more prominent */}
        {usersAlongPath.length > 0 ? (
          <div className="users-along-path highlight">
            <h4>
              <FontAwesomeIcon icon={faMapMarkerAlt} /> Users Along Your Path ({usersAlongPath.length})
            </h4>
            <div className="users-list">
              {usersAlongPath.map(u => (
                <div 
                  key={`path-user-${u.id}`} 
                  className="user-item"
                  onClick={() => handleChatRequest(u.id, u.username)}
                >
                  <div className="user-name">{u.username}</div>
                  <div className="user-distance">
                    {u.distance_to_path ? `${Math.round(u.distance_to_path)}m from path` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="users-along-path empty">
            <h4>
              <FontAwesomeIcon icon={faMapMarkerAlt} /> Users Along Your Path
            </h4>
            <div className="no-users-message">
              No users are currently along your path. Create a route where other users are located to see them.
            </div>
            <button 
              className="create-path-button"
              onClick={toggleRouteMode}
            >
              Create Route
            </button>
          </div>
        )}
        
        {pathsWithCoordinates.length > 0 && (
          <div className="recent-paths">
            <h4>Recent Paths</h4>
            <div className="paths-list">
              {pathsWithCoordinates.slice(0, 3).map((path, idx) => (
                <div key={idx} className={`path-item ${path.intersects_with_user ? 'intersecting' : ''}`}>
                  <div className="path-header">
                    <strong>{path.username || 'Unknown user'}</strong>
                    <span>{formatTime(path.created_at)}</span>
                  </div>
                  {path.intersects_with_user && (
                    <div className="intersect-badge">Intersects with your route</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Chat dialog */}
      {currentChat && <ChatDialog />}
    </div>
  );
};

export default React.memo(UserLocationMap);