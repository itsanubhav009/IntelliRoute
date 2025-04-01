import React, { useState, useContext } from 'react';
import { LocationContext } from '../context/LocationContext';
import { PREDEFINED_LOCATIONS } from '../utils/locationData';
import api from '../utils/api';
import './LocationSelector.css';

const LocationSelector = () => {
  const { updateLocation, position } = useContext(LocationContext);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState(null);

  // Filter locations based on search term
  const filteredLocations = searchTerm 
    ? PREDEFINED_LOCATIONS.filter(loc => 
        loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : PREDEFINED_LOCATIONS;

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    setMessage(null);
  };

  const handleSubmit = async () => {
    if (!selectedLocation) {
      setMessage({ type: 'error', text: 'Please select a location' });
      return;
    }

    setIsUpdating(true);
    try {
      await api.post('/location/update', { 
        latitude: selectedLocation.latitude, 
        longitude: selectedLocation.longitude 
      });
      
      // Update context
      updateLocation(selectedLocation.latitude, selectedLocation.longitude);
      
      setMessage({ 
        type: 'success', 
        text: `Location updated to ${selectedLocation.name}` 
      });
    } catch (error) {
      console.error('Failed to update location:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to update location. Please try again.' 
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Find location name by coordinates
  const getLocationName = (lat, lng) => {
    const location = PREDEFINED_LOCATIONS.find(loc => 
      Math.abs(loc.latitude - lat) < 0.01 && 
      Math.abs(loc.longitude - lng) < 0.01
    );
    return location ? location.name : "Custom Location";
  };

  return (
    <div className="location-selector">
      <div className="location-selector-header">
        <h3>Select Your Location</h3>
        <p>Choose a location from the list below</p>
      </div>
      
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
      
      <div className="current-location-status">
        <h4>Current Location</h4>
        {position ? (
          <div className="current-location-info">
            <p className="current-location-name">
              {getLocationName(position.latitude, position.longitude)}
            </p>
            <p>
              Latitude: {position.latitude.toFixed(4)}, 
              Longitude: {position.longitude.toFixed(4)}
            </p>
            {/* Fix for the lastUpdated error */}
            <p className="location-timestamp">
              Last updated: {new Date().toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="no-location">No location set. Please select a location.</p>
        )}
      </div>
      
      <div className="location-search">
        <input
          type="text"
          placeholder="Search locations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>
      
      <div className="locations-list">
        {filteredLocations.map(location => (
          <div 
            key={location.id}
            className={`location-item ${selectedLocation?.id === location.id ? 'selected' : ''}`}
            onClick={() => handleLocationSelect(location)}
          >
            <h4>{location.name}</h4>
            <p>{location.description}</p>
            <div className="coordinates">
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </div>
          </div>
        ))}
      </div>
      
      <div className="location-actions">
        <button 
          className="update-button"
          onClick={handleSubmit}
          disabled={!selectedLocation || isUpdating}
        >
          {isUpdating ? 'Updating...' : 'Update My Location'}
        </button>
      </div>
    </div>
  );
};

export default LocationSelector;