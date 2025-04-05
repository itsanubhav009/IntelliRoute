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
import { faComments, faSync, faSpinner } from '@fortawesome/free-solid-svg-icons';

// Define default Leaflet icon - make sure it works correctly
const DefaultIcon = L.icon({
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
  
  const [usersWithLocation, setUsersWithLocation] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [pathsWithCoordinates, setPathsWithCoordinates] = useState([]);
  const [routeMode, setRouteMode] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);
  
  const mapRef = useRef(null);
  const mapCenter = useRef([37.7749, -122.4194]); // Default to San Francisco

  // Create custom icon function
  const createCustomIcon = (color) => {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="marker-pin" style="background-color: ${color};"></div>`,
      iconSize: [30, 42],
      iconAnchor: [15, 42]
    });
  };

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

  // IMPORTANT: Two-step loading process - first fetch data, then initialize map
  useEffect(() => {
    if (!user) return;
    
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

  // Process path data
  useEffect(() => {
    if (livePaths && Array.isArray(livePaths)) {
      console.log(`Processing ${livePaths.length} paths`);
      const parsed = livePaths.map(path => ({
        ...path,
        parsedRoute: parseRouteData(path.route)
      })).filter(path => {
        const isValid = path && path.parsedRoute && path.parsedRoute.length > 0;
        return isValid;
      });
      
      console.log(`Found ${parsed.length} paths with valid route data`);
      setPathsWithCoordinates(parsed);
    } else {
      console.log('No path data or invalid data:', livePaths);
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
  }

  return (
    <div className="map-container">
      <div className="map-header">
        <div className="map-title">
          <h3>Live User Map</h3>
          <MapUserInfo user={user} />
        </div>
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
              disabled={isLoading}
            >
              <FontAwesomeIcon icon={isLoading ? faSpinner : faSync} spin={isLoading} />
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