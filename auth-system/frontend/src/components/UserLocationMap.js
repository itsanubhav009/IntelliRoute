import React, { useEffect, useState, useContext, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { LocationContext } from '../context/LocationContext';
import { AuthContext } from '../context/AuthContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './UserLocationMap.css';

// Fix for default icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Create custom icons
const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="marker-pin" style="background-color: ${color};"></div>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42]
  });
};

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

const UserLocationMap = () => {
  const { liveUsers, fetchLiveUsers, livePaths, fetchLivePaths, createPath } = useContext(LocationContext);
  const { user } = useContext(AuthContext);
  const [usersWithLocation, setUsersWithLocation] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [pathsWithCoordinates, setPathsWithCoordinates] = useState([]);
  const [routeMode, setRouteMode] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const loadMapData = async () => {
      setIsLoading(true);
      await Promise.all([fetchLiveUsers(), fetchLivePaths()]);
      setLastUpdated(new Date());
      setIsLoading(false);
    };

    loadMapData();
    const intervalId = setInterval(loadMapData, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [fetchLiveUsers, fetchLivePaths]);

  useEffect(() => {
    if (liveUsers) {
      const filtered = liveUsers.filter(u => u.latitude && u.longitude);
      setUsersWithLocation(filtered);
    }
  }, [liveUsers]);

  useEffect(() => {
    if (livePaths) {
      const parsed = livePaths.map(path => ({
        ...path,
        parsedRoute: parseRouteData(path.route)
      })).filter(path => path.parsedRoute.length > 0);
      
      setPathsWithCoordinates(parsed);
    }
  }, [livePaths]);

  const toggleRouteMode = () => {
    setRouteMode(!routeMode);
    if (routeMode) {
      // If turning off, clear selected source
      setSelectedSource(null);
    }
  };

  const handleCreatePath = (source, destination) => {
    createPath(source, destination);
    setRouteMode(false);
    setSelectedSource(null);
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

  if (isLoading && usersWithLocation.length === 0 && pathsWithCoordinates.length === 0) {
    return <div className="map-loading">Loading map...</div>;
  }

  // Calculate center point for map display or use a default
  let centerLat = 0, centerLng = 0;
  
  if (usersWithLocation.length > 0) {
    centerLat = usersWithLocation.reduce((sum, u) => sum + u.latitude, 0) / usersWithLocation.length;
    centerLng = usersWithLocation.reduce((sum, u) => sum + u.longitude, 0) / usersWithLocation.length;
  } else {
    // Default to a central location if no users
    centerLat = 0;
    centerLng = 0;
  }

  return (
    <div className="map-container">
      <div className="map-header">
        <h3>Live User Map</h3>
        <div className="map-controls">
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
      
      <MapContainer 
        center={[centerLat, centerLng]} 
        zoom={3} 
        style={{ height: '600px', width: '100%' }}
        ref={mapRef}
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
        {usersWithLocation.map(u => (
          <Marker 
            key={`user-${u.id}`} 
            position={[u.latitude, u.longitude]}
            icon={createCustomIcon(u.id === user?.id ? '#4285F4' : '#FF5722')}
          >
            <Popup>
              <div className="user-popup">
                <h3>{u.username}</h3>
                <div className="user-status">
                  <span className="status-dot"></span>
                  Online
                </div>
                <div className="user-location">
                  Coordinates: {u.latitude.toFixed(4)}, {u.longitude.toFixed(4)}
                </div>
                <div className="user-last-active">
                  Last active: {formatTime(u.last_active)}
                </div>
                {u.id === user?.id && (
                  <div className="current-user-tag">This is you</div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        
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
            color={path.user_id === user?.id ? '#2196F3' : '#FF5722'} 
            weight={4}
            opacity={0.7}
          >
            <Popup>
              <div className="path-popup">
                <h4>Route Information</h4>
                <p><strong>User:</strong> {path.username || 'Unknown'}</p>
                <p><strong>Created:</strong> {formatTime(path.created_at)}</p>
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
            <span>Your paths</span>
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

      {/* Display path information */}
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
        </div>
        
        {pathsWithCoordinates.length > 0 && (
          <div className="recent-paths">
            <h4>Recent Paths</h4>
            <div className="paths-list">
              {pathsWithCoordinates.slice(0, 5).map((path, idx) => (
                <div key={idx} className="path-item">
                  <div className="path-header">
                    <strong>{path.username || 'Unknown user'}</strong>
                    <span>{formatTime(path.created_at)}</span>
                  </div>
                  <div className="path-details">
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
    </div>
  );
};

export default UserLocationMap;