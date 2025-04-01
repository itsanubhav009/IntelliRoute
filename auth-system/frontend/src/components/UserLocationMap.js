import React, { useEffect, useState, useContext, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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

// Component to fit bounds when users change
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

const UserLocationMap = () => {
  const { liveUsers, fetchLiveUsers } = useContext(LocationContext);
  const { user } = useContext(AuthContext);
  const [usersWithLocation, setUsersWithLocation] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const mapRef = useRef(null);

  useEffect(() => {
    const loadMapData = async () => {
      setIsLoading(true);
      await fetchLiveUsers();
      setLastUpdated(new Date());
      setIsLoading(false);
    };

    loadMapData();

    // Refresh map data every 15 seconds
    const intervalId = setInterval(() => {
      loadMapData();
    }, 15000);
    
    return () => clearInterval(intervalId);
  }, [fetchLiveUsers]);

  useEffect(() => {
    if (liveUsers) {
      const filtered = liveUsers.filter(u => u.latitude && u.longitude);
      setUsersWithLocation(filtered);
    }
  }, [liveUsers]);

  const formatTime = (date) => {
    return date.toLocaleTimeString();
  };

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

  // Calculate center point
  const centerLat = usersWithLocation.reduce((sum, u) => sum + u.latitude, 0) / usersWithLocation.length;
  const centerLng = usersWithLocation.reduce((sum, u) => sum + u.longitude, 0) / usersWithLocation.length;

  return (
    <div className="map-container">
      <div className="map-header">
        <h3>Live User Map</h3>
        <div className="map-stats">
          <span>{usersWithLocation.length} users with location</span>
          <span>Last updated: {formatTime(lastUpdated)}</span>
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
      </div>
    </div>
  );
};

export default UserLocationMap;