import React, { useState, useContext } from 'react';
import { LocationContext } from '../context/LocationContext';
import { PREDEFINED_LOCATIONS } from '../utils/locationData';
import api from '../utils/api';
import './LocationSelector.css';

const LocationSelector = () => {
  const { updateLocation, updatePath, position } = useContext(LocationContext);
  const [selectedSource, setSelectedSource] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState(null);

  // Filter locations using search term
  const filteredLocations = searchTerm 
    ? PREDEFINED_LOCATIONS.filter(loc => 
        loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : PREDEFINED_LOCATIONS;

  const handleSourceSelect = (location) => {
    setSelectedSource(location);
    setMessage(null);
  };

  const handleDestinationSelect = (location) => {
    setSelectedDestination(location);
    setMessage(null);
  };

  // Submit function to update both current location and destination path.
  const handleSubmit = async () => {
    if (!selectedSource || !selectedDestination) {
      setMessage({ type: 'error', text: 'Please select both your current location and destination.' });
      return;
    }
    setIsUpdating(true);
    try {
      // Update current location on server
      await api.post('/location/update', { 
        latitude: selectedSource.latitude, 
        longitude: selectedSource.longitude 
      });
      updateLocation(selectedSource.latitude, selectedSource.longitude);
      
      // Set the path between source and destination
      const pathResponse = await updatePath(
        { lat: selectedSource.latitude, lng: selectedSource.longitude },
        { lat: selectedDestination.latitude, lng: selectedDestination.longitude }
      );
      
      setMessage({ 
        type: 'success', 
        text: `Location updated to ${selectedSource.name} and destination set to ${selectedDestination.name}.`
      });
    } catch (error) {
      console.error('Failed to update location/path:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to update. Please try again.'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Helper to determine a location name from coordinates.
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
        <h3>Select Your Location &amp; Destination</h3>
        <p>Choose your current location and a destination from the list below</p>
      </div>
      
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
      
      <div className="location-group">
        <h4>Your Current Location</h4>
        {selectedSource ? (
          <div className="selected-location">
            <p>{selectedSource.name}</p>
            <p>
              {selectedSource.latitude.toFixed(4)}, {selectedSource.longitude.toFixed(4)}
            </p>
          </div>
        ) : (
          <p className="no-selection">No location selected.</p>
        )}
        <div className="locations-list">
          {filteredLocations.map(location => (
            <div 
              key={location.id}
              className={`location-item ${selectedSource?.id === location.id ? 'selected' : ''}`}
              onClick={() => handleSourceSelect(location)}
            >
              <h4>{location.name}</h4>
              <p>{location.description}</p>
              <div className="coordinates">
                {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="location-group">
        <h4>Select Destination</h4>
        {selectedDestination ? (
          <div className="selected-location">
            <p>{selectedDestination.name}</p>
            <p>
              {selectedDestination.latitude.toFixed(4)}, {selectedDestination.longitude.toFixed(4)}
            </p>
          </div>
        ) : (
          <p className="no-selection">No destination selected.</p>
        )}
        <div className="locations-list">
          {filteredLocations.map(location => (
            <div 
              key={location.id}
              className={`location-item ${selectedDestination?.id === location.id ? 'selected' : ''}`}
              onClick={() => handleDestinationSelect(location)}
            >
              <h4>{location.name}</h4>
              <p>{location.description}</p>
              <div className="coordinates">
                {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="location-actions">
        <button 
          className="update-button"
          onClick={handleSubmit}
          disabled={!selectedSource || !selectedDestination || isUpdating}
        >
          {isUpdating ? 'Updating...' : 'Update My Location & Set Destination'}
        </button>
      </div>
    </div>
  );
};

export default LocationSelector;