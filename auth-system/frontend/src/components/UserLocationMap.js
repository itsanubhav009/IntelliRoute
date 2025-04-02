import React, { useEffect, useState, useContext, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
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

// Component to update map bounds based on users' positions
function MapBoundsUpdater({ users }) {
  const map = useMap();
  
  useEffect(() => {
    if (users.length > 0) {
      const bounds = L.latLngBounds(users.map(user => [user.latitude, user.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [users, map]);
  
  return null;
}

// Helper to parse route data in either WKT LINESTRING or JSON format
const parseRouteData = (routeData) => {
  if (!routeData) return [];
  
  // Check if it's a WKT LINESTRING
  if (typeof routeData === 'string' && routeData.startsWith('LINESTRING')) {
    // Parse the LINESTRING(lng lat, lng lat, ...) format
    const coordsStr = routeData.substring(11, routeData.length - 1);
    return coordsStr.split(',').map(pair => {
      const [lng, lat] = pair.trim().split(' ');
      return [parseFloat(lat), parseFloat(lng)];
    });
  }
  
  // Check if it's a JSON string
  if (typeof routeData === 'string' && (routeData.startsWith('[') || routeData.startsWith('{'))) {
    try {
      const parsed = JSON.parse(routeData);
      // Handle array of {lat, lng} objects
      if (Array.isArray(parsed)) {
        return parsed.map(point => [point.lat, point.lng]);
      }
    } catch (e) {
      console.error('Error parsing JSON route data:', e);
    }
  }
  
  return [];
};

const UserLocationMap = () => {
  const { liveUsers, fetchLiveUsers, livePaths, fetchLivePaths } = useContext(LocationContext);
  const { user } = useContext(AuthContext);
  const [usersWithLocation, setUsersWithLocation] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleString());
  const mapRef = useRef(null);

  useEffect(() => {
    const loadMapData = async () => {
      setIsLoading(true);
      await fetchLiveUsers();
      await fetchLivePaths();
      const now = new Date();
      setLastUpdated(now);
      setCurrentTime(now.toLocaleString());
      setIsLoading(false);
    };

    loadMapData();
    const intervalId = setInterval(() => {
      loadMapData();
    }, 15000);
    
    return () => clearInterval(intervalId);
  }, [fetchLiveUsers, fetchLivePaths]);

  useEffect(() => {
    if (liveUsers) {
      const filtered = liveUsers.filter(u => u.latitude && u.longitude);
      setUsersWithLocation(filtered);
    }
  }, [liveUsers]);

  const formatTime = (date) => date.toLocaleTimeString();

  if (isLoading && usersWithLocation.length === 0) {
    return <div className="map-loading">Loading map...</div>;
  }

  if (usersWithLocation.length === 0) {
    return (
      <div className="no-location-data">
        <h3>No Location Data Available</h3>
        <p>None of the active users have selected a location yet.</p>
      </div>
    );
  }

  // Calculate center point for map display
  const centerLat = usersWithLocation.reduce((sum, u) => sum + u.latitude, 0) / usersWithLocation.length;
  const centerLng = usersWithLocation.reduce((sum, u) => sum + u.longitude, 0) / usersWithLocation.length;

  return (
    <div className="map-container">
      <div className="map-header">
        <h3>Live User Map</h3>
        <div className="map-stats">
          <span>{usersWithLocation.length} users with location</span>
          <span>Last updated: {formatTime(lastUpdated)}</span>
          <span>Current user: {user?.username || 'Guest'}</span>
          <span>Current time: {currentTime}</span>
        </div>
      </div>
      
      <MapContainer 
        center={[centerLat, centerLng]} 
        zoom={2} 
        style={{ height: '500px', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {usersWithLocation.map(u => (
          <Marker 
            key={u.id} 
            position={[u.latitude, u.longitude]}
            icon={u.id === user?.id ? 
              L.divIcon({
                className: 'custom-div-icon',
                html: `<div class="marker-pin current-user"></div>`,
                iconSize: [30, 42],
                iconAnchor: [15, 42]
              }) : 
              L.divIcon({
                className: 'custom-div-icon',
                html: `<div class="marker-pin other-user"></div>`,
                iconSize: [30, 42],
                iconAnchor: [15, 42]
              })
            }
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
                {u.id === user?.id && (
                  <div className="current-user-tag">This is you</div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* Draw live user paths as polylines */}
        {livePaths && livePaths.map((p, idx) => {
          // Use the more robust parseRouteData function that can handle both formats
          const positions = parseRouteData(p.route);
          
          // Only render if we have valid positions
          if (positions && positions.length > 0) {
            // Create markers for source and destination
            const sourcePoint = positions[0];
            const destPoint = positions[positions.length - 1];
            
            return (
              <React.Fragment key={idx}>
                <Polyline 
                  positions={positions} 
                  color={p.user_id === user?.id ? 'blue' : 'red'} 
                  weight={4}
                >
                  <Popup>
                    <div className="path-popup">
                      <h4>Route Information</h4>
                      <p><strong>User:</strong> {p.username || 'Unknown'}</p>
                      <p><strong>Created:</strong> {p.timestamp || 'Unknown time'}</p>
                      <p><strong>From:</strong> {sourcePoint[0].toFixed(4)}, {sourcePoint[1].toFixed(4)}</p>
                      <p><strong>To:</strong> {destPoint[0].toFixed(4)}, {destPoint[1].toFixed(4)}</p>
                    </div>
                  </Popup>
                </Polyline>

                {/* Source marker with different icon */}
                <Marker 
                  position={sourcePoint}
                  icon={L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div class="marker-pin source-point"></div>`,
                    iconSize: [20, 32],
                    iconAnchor: [10, 32]
                  })}
                >
                  <Popup>
                    <div>
                      <h4>Source Point</h4>
                      <p>User: {p.username || 'Unknown'}</p>
                      <p>Coordinates: {sourcePoint[0].toFixed(4)}, {sourcePoint[1].toFixed(4)}</p>
                    </div>
                  </Popup>
                </Marker>

                {/* Destination marker with different icon */}
                <Marker 
                  position={destPoint}
                  icon={L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div class="marker-pin destination-point"></div>`,
                    iconSize: [20, 32],
                    iconAnchor: [10, 32]
                  })}
                >
                  <Popup>
                    <div>
                      <h4>Destination Point</h4>
                      <p>User: {p.username || 'Unknown'}</p>
                      <p>Coordinates: {destPoint[0].toFixed(4)}, {destPoint[1].toFixed(4)}</p>
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            );
          }
          return null;
        })}

        <MapBoundsUpdater users={usersWithLocation} />
      </MapContainer>
      
      <div className="map-legend">
        <div className="legend-item">
          <div className="legend-marker current-user"></div>
          <span>Your location</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker other-user"></div>
          <span>Other users</span>
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ backgroundColor: 'blue' }}></div>
          <span>Your path</span>
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ backgroundColor: 'red' }}></div>
          <span>Other users' paths</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker source-point"></div>
          <span>Starting point</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker destination-point"></div>
          <span>Destination</span>
        </div>
      </div>

      {/* Display route information box */}
      <div className="route-info-panel">
        <h4>Current Route Information</h4>
        <p><strong>Date/Time:</strong> {currentTime}</p>
        <p><strong>User:</strong> {user?.username || 'Guest'}</p>

        <div className="route-list">
          <h5>Active Routes</h5>
          {livePaths && livePaths.length > 0 ? (
            livePaths.map((path, idx) => (
              <div key={idx} className="route-item">
                <p><strong>User:</strong> {path.username || 'Unknown'}</p>
                <p><strong>Created:</strong> {path.timestamp || 'Unknown'}</p>
                <p><strong>Source:</strong> {path.source ? 
                  `${path.source.lat.toFixed(4)}, ${path.source.lng.toFixed(4)}` : 
                  'Unknown'}</p>
                <p><strong>Destination:</strong> {path.destination ? 
                  `${path.destination.lat.toFixed(4)}, ${path.destination.lng.toFixed(4)}` : 
                  'Unknown'}</p>
              </div>
            ))
          ) : (
            <p>No active routes</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserLocationMap;