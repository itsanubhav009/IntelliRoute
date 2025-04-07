import React, { useEffect, useState, useContext, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
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
<<<<<<< HEAD
import { faComments, faSync } from '@fortawesome/free-solid-svg-icons';

// Define default Leaflet icon
let DefaultIcon = L.icon({
=======
import { faComments, faSync, faSpinner } from '@fortawesome/free-solid-svg-icons';

// Define default Leaflet icon - make sure it works correctly
const DefaultIcon = L.icon({
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// Properly set the default icon globally
L.Marker.prototype.options.icon = DefaultIcon;

// Helper to parse route data from PostGIS or OSRM
const parseRouteData = (routeData) => {
  if (!routeData) return [];
  
  // LINESTRING parsing
  if (typeof routeData === 'string' && routeData.startsWith('LINESTRING')) {
    try {
      // Extract coordinates from LINESTRING(lng lat, lng lat, ...)
      const coordsStr = routeData.substring(routeData.indexOf('(') + 1, routeData.lastIndexOf(')'));
      return coordsStr.split(',').map(pair => {
        const [lng, lat] = pair.trim().split(' ').map(parseFloat);
        // Return [lat, lng] for Leaflet
        return [lat, lng]; 
      });
    } catch (e) {
      console.error('Error parsing LINESTRING:', e, routeData);
      return [];
    }
  }
  
  // If it's already an array, return it (assuming it's in Leaflet's [lat, lng] format)
  if (Array.isArray(routeData)) {
    return routeData;
  }
  
  return [];
};

// Test location data for debugging
const TEST_LOCATIONS = [
  { id: 1, name: "San Francisco", lat: 37.7749, lng: -122.4194 },
  { id: 2, name: "New York", lat: 40.7128, lng: -74.0060 },
  { id: 3, name: "Chicago", lat: 41.8781, lng: -87.6298 },
  { id: 4, name: "Los Angeles", lat: 34.0522, lng: -118.2437 }
];

// Component to update map bounds based on users' positions and routes
function MapBoundsUpdater({ users, paths }) {
  const map = useMap();
  
  useEffect(() => {
    if (!users.length && !paths.length) return;
    
    try {
      const points = [];
      
      // Add user points
      users.forEach(user => {
        if (user.latitude && user.longitude) {
          points.push([user.latitude, user.longitude]);
        }
      });
      
      // Add path points (with better handling for complex routes)
      paths.forEach(path => {
        if (path.parsedRoute && Array.isArray(path.parsedRoute)) {
          // Don't add every point - just add first, last, and some in between
          // to avoid overloading the bounds calculation with too many points
          const routePoints = path.parsedRoute;
          if (routePoints.length > 0) {
            points.push(routePoints[0]); // Add first point
            
            if (routePoints.length > 10) {
              // Add a few points in the middle for long routes
              points.push(routePoints[Math.floor(routePoints.length / 3)]);
              points.push(routePoints[Math.floor(routePoints.length * 2 / 3)]);
            }
            
            if (routePoints.length > 1) {
              points.push(routePoints[routePoints.length - 1]); // Add last point
            }
          }
        }
      });
      
      if (points.length > 0) {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (error) {
      console.error('Error updating map bounds:', error);
    }
  }, [users, paths, map]);
  
  return null;
}

// Component to handle map clicks for route creation
function MapClickHandler({ routeMode, selectedSource, setSelectedSource, createPath }) {
  useMapEvents({
    click: (e) => {
      if (!routeMode) return;
      
      const { lat, lng } = e.latlng;
      
      if (!selectedSource) {
        // Set source
        setSelectedSource({ lat, lng });
      } else {
        // Set destination and create path
        const destination = { lat, lng };
        createPath(selectedSource, destination);
        
        // Reset route mode (this will be handled by parent component)
      }
    }
  });
  
  return null;
}

<<<<<<< HEAD
// Fixed TestMarkers component to ensure markers render
function TestMarkers() {
  return (
    <>
      {TEST_LOCATIONS.map(location => (
        <Marker
          key={`test-${location.id}`}
          position={[location.lat, location.lng]}
          icon={DefaultIcon}
        >
          <Popup>
            <div>
              <h3>{location.name}</h3>
              <p>Test marker to verify map works</p>
              <p>Coordinates: {location.lat}, {location.lng}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
=======
// Component to display current date and active user info
function MapUserInfo({ user }) {
  const currentDate = new Date().toISOString().slice(0, 10);
  const currentTime = new Date().toTimeString().slice(0, 8);
  
  return (
    <div className="map-user-info">
      <div className="date-time">
        <span>{currentDate}</span>
        <span>{currentTime}</span>
      </div>
      <div className="user-info">
        <span>Logged in as:</span>
        <span className="username">{user?.username || "Guest"}</span>
      </div>
    </div>
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
  );
}

const UserLocationMap = () => {
  const { 
    liveUsers, 
    fetchLiveUsers, 
    livePaths, 
    fetchLivePaths, 
    createPath, 
    showIntersectingOnly, 
    toggleIntersectionFilter,
    forceRefreshData
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
  
  // MOVED debugContent state inside component (this was the main bug)
  const [debugContent, setDebugContent] = useState('');
  const [usersWithLocation, setUsersWithLocation] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [pathsWithCoordinates, setPathsWithCoordinates] = useState([]);
  const [routeMode, setRouteMode] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
<<<<<<< HEAD
  const [showTestMarkers, setShowTestMarkers] = useState(true); // Enable test markers
  const mapRef = useRef(null);
  const mapCenter = useRef([37.7749, -122.4194]); // Default to San Francisco

  // Fixed createCustomIcon function - moved inside component
=======
  const [mapReady, setMapReady] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);
  
  const mapRef = useRef(null);
  const mapCenter = useRef([37.7749, -122.4194]); // Default to San Francisco

  // Create custom icon function
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
  const createCustomIcon = (color) => {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="marker-pin" style="background-color: ${color};"></div>`,
      iconSize: [30, 42],
      iconAnchor: [15, 42]
    });
  };
<<<<<<< HEAD

  // Add a debug effect to log user data for troubleshooting
  useEffect(() => {
    console.log('FULL LIVE USER DATA:', liveUsers);
    if (liveUsers && liveUsers.length > 0) {
      // Display first 3 users' raw data for debugging
      const userSample = liveUsers.slice(0, 3).map(u => ({
        id: u.id,
        username: u.username,
        latitude: u.latitude,
        longitude: u.longitude,
        type: typeof u.latitude
      }));
      setDebugContent(JSON.stringify(userSample, null, 2));
    }
  }, [liveUsers]);
=======
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd

  // Chat request handler
  const handleChatRequest = (userId) => {
    if (userId === user.id) {
      // Don't allow chatting with yourself
      return;
    }
    
    sendChatRequest(userId)
      .then((response) => {
        console.log('Chat request sent successfully:', response);
      })
      .catch((error) => {
        console.error('Failed to send chat request:', error);
      });
  };

  // Handle refresh button click
  const handleRefresh = async () => {
    try {
      setIsLoading(true);
      console.log('Manually refreshing map data...');
      
      // Refresh notifications too
      if (fetchNotifications) {
        await fetchNotifications(true);
      }
      
      // Only use forceRefreshData if it exists, otherwise fall back to the individual fetch functions
      if (forceRefreshData) {
        await forceRefreshData();
      } else {
        await Promise.all([fetchLiveUsers(), fetchLivePaths()]);
      }
      
      setLastUpdated(new Date());
      console.log('Map data refreshed manually');
    } catch (error) {
      console.error('Manual refresh failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced notification toggle with debugging
  const toggleNotifications = () => {
    console.log('Toggling notifications panel. Current state:', showNotifications);
    // Refresh notifications when opening panel
    if (!showNotifications && fetchNotifications) {
      fetchNotifications(true).catch(err => console.error('Failed to refresh notifications:', err));
    }
    setShowNotifications(!showNotifications);
  };

  // Fetch active chats on component mount
  useEffect(() => {
    if (user && fetchActiveChats) {
      fetchActiveChats();
    }
  }, [user, fetchActiveChats]);

<<<<<<< HEAD
  // Effect for initial data load and periodic updates
  useEffect(() => {
    if (!user) return;
    
    // Initial load - force immediate fetch
    setIsLoading(true);
    console.log('Initial data load...');
    
    // Use Promise.all to load both data types in parallel
    Promise.all([fetchLiveUsers(), fetchLivePaths()])
      .then(([users, paths]) => {
        console.log(`Initial load complete: ${users?.length || 0} users, ${paths?.length || 0} paths`);
        setLastUpdated(new Date());
      })
      .catch(error => {
        console.error('Error in initial data load:', error);
      })
      .finally(() => {
        setIsLoading(false);
      });
    
    // Then set up regular polling
    let isMounted = true;
=======
  // IMPORTANT: Two-step loading process - first fetch data, then initialize map
  useEffect(() => {
    if (!user) return;
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
    
    // Step 1: Fetch initial data
    const loadInitialData = async () => {
      setIsLoading(true);
      console.log('Loading initial data...');
      
      try {
        // Use Promise.all to load both data types in parallel
        const [users, paths] = await Promise.all([fetchLiveUsers(), fetchLivePaths()]);
        console.log(`Initial load complete: ${users?.length || 0} users, ${paths?.length || 0} paths`);
        setLastUpdated(new Date());
        setDataFetched(true);
      } catch (error) {
        console.error('Error in initial data load:', error);
      } finally {
        setIsLoading(false);
      }
    };
<<<<<<< HEAD

    const intervalId = setInterval(loadMapData, 60000); // Increased to 60 seconds to reduce load
    
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [user, fetchLiveUsers, fetchLivePaths, isLoading, lastUpdated]);

  // Effect to process user data
  useEffect(() => {
    if (liveUsers && Array.isArray(liveUsers)) {
      console.log(`Processing ${liveUsers.length} users`);
      
      // Filter users with valid coordinates and process them
      const filtered = liveUsers.filter(u => {
        // Ensure the coordinates are valid numbers within range
        const lat = parseFloat(u.latitude);
        const lng = parseFloat(u.longitude);
        return !isNaN(lat) && !isNaN(lng) && 
               Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
      });
      
      console.log(`Found ${filtered.length} users with valid coordinates`);
      
      // Update center point if we have valid users
      if (filtered.length > 0) {
        // Calculate average position for map center
        const totalLat = filtered.reduce((sum, u) => sum + parseFloat(u.latitude), 0);
        const totalLng = filtered.reduce((sum, u) => sum + parseFloat(u.longitude), 0);
        
        mapCenter.current = [
          totalLat / filtered.length,
          totalLng / filtered.length
        ];
        
        console.log(`Map center set to: [${mapCenter.current[0]}, ${mapCenter.current[1]}]`);
      }
      
      setUsersWithLocation(filtered);
    } else {
      console.warn('liveUsers is not valid array:', liveUsers);
      setUsersWithLocation([]);
=======
    
    loadInitialData();
    
    // Step 2: Setup regular polling with reduced frequency (1 minute)
    const intervalId = setInterval(() => {
      if (!isLoading) {
        console.log('Periodic refresh at', new Date().toLocaleTimeString());
        fetchLiveUsers().catch(err => console.error('Failed to fetch users:', err));
        fetchLivePaths().catch(err => console.error('Failed to fetch paths:', err));
        setLastUpdated(new Date());
      }
    }, 60000); // Poll every minute
    
    return () => clearInterval(intervalId);
  }, [user, fetchLiveUsers, fetchLivePaths]);

  // Process user data with improved error handling
  useEffect(() => {
    if (!liveUsers || !Array.isArray(liveUsers)) {
      console.warn('Invalid users data:', liveUsers);
      setUsersWithLocation([]);
      return;
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
    }
    
    console.log(`Processing ${liveUsers.length} users`);
    
    // More robust validation to ensure coordinates are valid
    const filtered = liveUsers.filter(u => {
      if (!u) return false;
      
      // Convert to numbers and validate
      const lat = typeof u.latitude === 'string' ? parseFloat(u.latitude) : u.latitude;
      const lng = typeof u.longitude === 'string' ? parseFloat(u.longitude) : u.longitude;
      
      const isValid = 
        u.id && 
        u.username && 
        lat !== undefined &&
        lng !== undefined &&
        !isNaN(lat) && 
        !isNaN(lng) && 
        Math.abs(lat) <= 90 && 
        Math.abs(lng) <= 180;
      
      if (!isValid) {
        console.warn(`Filtered out user with invalid data:`, u);
      }
      
      return isValid;
    });
    
    console.log(`Found ${filtered.length} users with valid location data`);
    
    // Update center point if we have valid users
    if (filtered.length > 0) {
      // Calculate average position for map center
      const totalLat = filtered.reduce((sum, u) => {
        const lat = typeof u.latitude === 'string' ? parseFloat(u.latitude) : u.latitude;
        return sum + lat;
      }, 0);
      
      const totalLng = filtered.reduce((sum, u) => {
        const lng = typeof u.longitude === 'string' ? parseFloat(u.longitude) : u.longitude;
        return sum + lng;
      }, 0);
      
      mapCenter.current = [
        totalLat / filtered.length,
        totalLng / filtered.length
      ];
      
      console.log(`Map center set to: [${mapCenter.current[0]}, ${mapCenter.current[1]}]`);
    }
    
    setUsersWithLocation(filtered);
    
    // Mark map as ready once we have processed user data
    setMapReady(true);
  }, [liveUsers]);

<<<<<<< HEAD
  // Effect to process path data
  useEffect(() => {
    if (livePaths) {
=======
  // Process path data
  useEffect(() => {
    if (livePaths && Array.isArray(livePaths)) {
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
      console.log(`Processing ${livePaths.length} paths`);
      const parsed = livePaths.map(path => ({
        ...path,
        parsedRoute: parseRouteData(path.route)
      })).filter(path => {
<<<<<<< HEAD
        const isValid = path.parsedRoute && path.parsedRoute.length > 0;
        if (!isValid) {
          console.log(`Path ${path.id} has invalid route data`);
        }
=======
        const isValid = path && path.parsedRoute && path.parsedRoute.length > 0;
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
        return isValid;
      });
      
      console.log(`Found ${parsed.length} paths with valid route data`);
      setPathsWithCoordinates(parsed);
    } else {
<<<<<<< HEAD
      console.log('No live paths data available');
=======
      console.log('No path data or invalid data:', livePaths);
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
      setPathsWithCoordinates([]);
    }
  }, [livePaths]);

  const toggleRouteMode = () => {
    setRouteMode(!routeMode);
    if (routeMode) {
      setSelectedSource(null);
    }
  };

  const handleCreatePath = (source, destination) => {
    createPath(source, destination);
    setRouteMode(false);
    setSelectedSource(null);
  };

  const handleToggleIntersectionFilter = () => {
    toggleIntersectionFilter();
  };

  const formatTime = (date) => {
    if (!(date instanceof Date)) {
      try {
        date = new Date(date);
      } catch (e) {
        return 'Unknown';
      }
    }
    return date.toLocaleTimeString();
  };

<<<<<<< HEAD
  if (isLoading && usersWithLocation.length === 0 && pathsWithCoordinates.length === 0) {
    return <div className="map-loading">Loading map data...</div>;
  }

  // Calculate center point for map display or use a default
  let centerLat = 0, centerLng = 0;
  
  if (usersWithLocation.length > 0) {
    centerLat = usersWithLocation.reduce((sum, u) => sum + parseFloat(u.latitude || 0), 0) / usersWithLocation.length;
    centerLng = usersWithLocation.reduce((sum, u) => sum + parseFloat(u.longitude || 0), 0) / usersWithLocation.length;
  } else {
    // Default to a central location if no users
    centerLat = 37.7749; // San Francisco as a default
    centerLng = -122.4194;
=======
  // Calculate center point for map
  let centerLat = mapCenter.current[0];
  let centerLng = mapCenter.current[1];
  
  if (usersWithLocation.length > 0) {
    // Calculate the average of all valid user positions
    centerLat = usersWithLocation.reduce((sum, u) => {
      const lat = typeof u.latitude === 'string' ? parseFloat(u.latitude) : u.latitude;
      return sum + lat;
    }, 0) / usersWithLocation.length;
    
    centerLng = usersWithLocation.reduce((sum, u) => {
      const lng = typeof u.longitude === 'string' ? parseFloat(u.longitude) : u.longitude;
      return sum + lng;
    }, 0) / usersWithLocation.length;
  }

  // Show loading screen if we're still loading initial data
  if (isLoading && !dataFetched) {
    return (
      <div className="map-loading-screen">
        <FontAwesomeIcon icon={faSpinner} spin />
        <h3>Loading Map Data...</h3>
        <p>Please wait while we fetch the latest user locations</p>
      </div>
    );
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
  }

  return (
    <div className="map-container">
      <div className="map-header">
<<<<<<< HEAD
        <h3>Live User Map</h3>
=======
        <div className="map-title">
          <h3>Live User Map</h3>
          <MapUserInfo user={user} />
        </div>
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
        <div className="map-controls">
          <div className="notification-controls">
            <NotificationButton 
              notificationCount={notifications ? notifications.length : 0}
              onClick={toggleNotifications}
            />
            
            {/* Manual refresh button */}
            <button 
              className="refresh-button"
              onClick={handleRefresh}
              title="Refresh map data"
<<<<<<< HEAD
            >
              <FontAwesomeIcon icon={faSync} />
            </button>
            
            {/* Toggle test markers button */}
            <button 
              className="refresh-button"
              onClick={() => setShowTestMarkers(!showTestMarkers)}
              title={showTestMarkers ? "Hide test markers" : "Show test markers"}
            >
              {showTestMarkers ? "Hide Tests" : "Show Tests"}
=======
              disabled={isLoading}
            >
              <FontAwesomeIcon icon={isLoading ? faSpinner : faSync} spin={isLoading} />
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
            </button>
            
            {/* Filter button */}
            <button
              className={`filter-button ${showIntersectingOnly ? 'active' : ''}`}
              onClick={handleToggleIntersectionFilter}
              title="Show only paths that intersect with your route"
            >
              {showIntersectingOnly ? 'Show All Paths' : 'Show Intersecting Only'}
            </button>
          </div>
          
          <button 
            className={`route-button ${routeMode ? 'active' : ''}`} 
            onClick={toggleRouteMode}
          >
            {routeMode ? 'Cancel Route' : 'Create Route'}
          </button>
          
          {routeMode && !selectedSource && (
            <div className="route-instructions">Click on map to set starting point</div>
          )}
          
          {routeMode && selectedSource && (
            <div className="route-instructions">Click on map to set destination</div>
          )}
          
          <span className="last-updated">
            Last updated: {formatTime(lastUpdated)}
          </span>
        </div>
      </div>
      
<<<<<<< HEAD
      {/* Debug panel to show raw user data */}
      {isLoading ? (
        <div className="debug-banner">Loading map data...</div>
      ) : usersWithLocation.length === 0 ? (
        <div className="debug-banner">
          No users with location. Raw data: {debugContent}
        </div>
      ) : null}
=======
      {/* User count info */}
      <div className="user-count-info">
        {usersWithLocation.length === 0 ? (
          <div className="no-users-warning">No users with location data are currently available</div>
        ) : (
          <div className="user-count">
            Showing {usersWithLocation.length} active users on the map
          </div>
        )}
      </div>
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
      
      {/* Show notifications panel when toggled */}
      {showNotifications && (
        <NotificationsPanel onClose={() => setShowNotifications(false)} />
      )}
      
      {/* Intersection filter info message */}
      {showIntersectingOnly && (
        <div className="intersection-filter-info">
          <i className="fas fa-info-circle"></i> 
          Showing only paths that intersect with your route. 
          {pathsWithCoordinates.length === 0 && (
            <span className="no-intersections"> No intersecting paths found.</span>
          )}
        </div>
      )}
      
<<<<<<< HEAD
      <MapContainer 
        center={[centerLat || 37.7749, centerLng || -122.4194]} 
        zoom={4} 
        style={{ height: '600px', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Show test markers to verify marker rendering works */}
        {showTestMarkers && <TestMarkers />}
        
        {/* Map click handler for route creation */}
        <MapClickHandler 
          routeMode={routeMode} 
          selectedSource={selectedSource} 
          setSelectedSource={setSelectedSource} 
          createPath={handleCreatePath}
        />
        
        {/* Display user markers with better error handling */}
        {usersWithLocation && usersWithLocation.length > 0 ? (
          usersWithLocation.map(u => {
            try {
              // Ensure coordinates are valid numbers
              const lat = parseFloat(u.latitude);
              const lng = parseFloat(u.longitude);
              
              // Skip invalid coordinates
              if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
                console.warn(`Invalid coordinates for user ${u.username}: [${u.latitude}, ${u.longitude}]`);
                return null;
              }
              
              console.log(`Rendering marker for ${u.username} at [${lat}, ${lng}]`);
              
              // Use default icon for more reliability
              const markerIcon = u.id === user?.id ? 
                createCustomIcon('#4285F4') : createCustomIcon('#FF5722');
              
              return (
                <Marker 
                  key={`user-${u.id}`} 
                  position={[lat, lng]}
                  icon={markerIcon}
                >
                  <Popup>
                    <div className="user-popup">
                      <h3>{u.username}</h3>
                      <div className="user-status">
                        <span className="status-dot"></span>
                        Online
                      </div>
                      <div className="user-location">
                        Coordinates: {lat.toFixed(4)}, {lng.toFixed(4)}
                      </div>
                      <div className="user-last-active">
                        Last active: {formatTime(u.last_active)}
                      </div>
                      {u.id === user?.id ? (
                        <div className="current-user-tag">This is you</div>
                      ) : (
                        <div className="chat-button-container">
                          <button 
                            className="chat-request-button"
                            onClick={() => handleChatRequest(u.id)}
                          >
                            Chat with {u.username}
                          </button>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            } catch (error) {
              console.error(`Error rendering marker for user ${u.username}:`, error);
              return null;
            }
          })
        ) : (
          <div className="no-users-message">No users with location data found</div>
        )}

        {/* Display route source marker if in route mode */}
        {routeMode && selectedSource && (
          <Marker 
            position={[selectedSource.lat, selectedSource.lng]}
            icon={createCustomIcon('#00C853')}
          >
            <Popup>Starting point</Popup>
          </Marker>
        )}
        
        {/* Display paths as polylines */}
        {pathsWithCoordinates.map((path, idx) => (
          <Polyline 
            key={`path-${path.id || idx}`} 
            positions={path.parsedRoute} 
            // Use a special color for intersecting paths
            color={path.user_id === user?.id ? '#2196F3' : (path.intersects_with_user ? '#4CAF50' : '#FF5722')} 
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
        ))}
=======
      {/* Render the map only if we have data and are ready */}
      {mapReady && (
        <MapContainer 
          center={[centerLat, centerLng]} 
          zoom={4} 
          style={{ height: '600px', width: '100%' }}
          ref={mapRef}
          whenCreated={(map) => {
            console.log("Map created with center:", [centerLat, centerLng]);
            // Force an update after map is created
            setTimeout(() => {
              map.invalidateSize();
            }, 100);
          }}
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
          />
          
          {/* Display user markers */}
          {usersWithLocation.map(u => {
            // Convert latitude and longitude to numbers if they're strings
            const lat = typeof u.latitude === 'string' ? parseFloat(u.latitude) : u.latitude;
            const lng = typeof u.longitude === 'string' ? parseFloat(u.longitude) : u.longitude;
            
            // Create different icon based on if it's current user or not
            const markerIcon = u.id === user?.id ? 
              createCustomIcon('#4285F4') : createCustomIcon('#FF5722');
            
            return (
              <Marker 
                key={`user-${u.id}`} 
                position={[lat, lng]}
                icon={markerIcon}
              >
                <Popup>
                  <div className="user-popup">
                    <h3>{u.username}</h3>
                    <div className="user-status">
                      <span className="status-dot"></span>
                      Online
                    </div>
                    <div className="user-location">
                      Coordinates: {lat.toFixed(4)}, {lng.toFixed(4)}
                    </div>
                    <div className="user-last-active">
                      Last active: {formatTime(u.last_active)}
                    </div>
                    {u.id === user?.id ? (
                      <div className="current-user-tag">This is you</div>
                    ) : (
                      <div className="chat-button-container">
                        <button 
                          className="chat-request-button"
                          onClick={() => handleChatRequest(u.id)}
                        >
                          Chat with {u.username}
                        </button>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Display route source marker if in route mode */}
          {routeMode && selectedSource && (
            <Marker 
              position={[selectedSource.lat, selectedSource.lng]}
              icon={createCustomIcon('#00C853')}
            >
              <Popup>Starting point</Popup>
            </Marker>
          )}
          
          {/* Display paths as polylines */}
          {pathsWithCoordinates.map((path, idx) => (
            <Polyline 
              key={`path-${path.id || idx}`} 
              positions={path.parsedRoute} 
              // Use a special color for intersecting paths
              color={path.user_id === user?.id ? '#2196F3' : (path.intersects_with_user ? '#4CAF50' : '#FF5722')} 
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
          ))}
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd

          {/* Map bounds updater component */}
          <MapBoundsUpdater 
            users={usersWithLocation} 
            paths={pathsWithCoordinates} 
          />
        </MapContainer>
      )}
      
      <div className="map-legend">
        <h4>Map Legend</h4>
        <div className="legend-items">
          <div className="legend-item">
            <div className="legend-marker" style={{ backgroundColor: '#4285F4' }}></div>
            <span>Your location</span>
          </div>
          <div className="legend-item">
            <div className="legend-marker" style={{ backgroundColor: '#FF5722' }}></div>
            <span>Other users</span>
          </div>
          <div className="legend-item">
            <div className="legend-line" style={{ backgroundColor: '#2196F3' }}></div>
            <span>Your path</span>
          </div>
<<<<<<< HEAD
          {/* New legend item for intersecting paths */}
=======
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
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
              <span>Selected starting point</span>
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
            <strong>Active Paths:</strong> {pathsWithCoordinates.length}
          </div>
          <div className="stat-item">
            <strong>Last Updated:</strong> {formatTime(lastUpdated)}
          </div>
          {showIntersectingOnly && (
            <div className="stat-item">
              <strong>Filter:</strong> Showing intersecting paths only
            </div>
          )}
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
        
        {pathsWithCoordinates.length > 0 && (
          <div className="recent-paths">
            <h4>Recent Paths</h4>
            <div className="paths-list">
              {pathsWithCoordinates.slice(0, 5).map((path, idx) => (
                <div key={idx} className={`path-item ${path.intersects_with_user ? 'intersecting' : ''}`}>
                  <div className="path-header">
                    <strong>{path.username || 'Unknown user'}</strong>
                    <span>{formatTime(path.created_at)}</span>
                  </div>
                  <div className="path-details">
                    {path.intersects_with_user && (
                      <div className="intersect-badge">Intersects with your route</div>
                    )}
                    {path.parsedRoute.length > 0 && (
                      <>
                        <small>
                          From: {path.parsedRoute[0][0].toFixed(4)}, {path.parsedRoute[0][1].toFixed(4)}
                        </small>
                        <small>
                          To: {path.parsedRoute[path.parsedRoute.length-1][0].toFixed(4)}, {path.parsedRoute[path.parsedRoute.length-1][1].toFixed(4)}
                        </small>
                        <small>
                          Route Points: {path.parsedRoute.length}
                        </small>
                      </>
                    )}
                  </div>
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

export default UserLocationMap;