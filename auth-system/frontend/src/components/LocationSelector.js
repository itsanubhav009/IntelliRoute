import React, { useState, useContext, useEffect } from 'react';
import { LocationContext } from '../context/LocationContext';
import { PREDEFINED_LOCATIONS } from '../utils/locationData';
import api from '../utils/api';
import './LocationSelector.css';

const LocationSelector = () => {
  const { updateLocation, position } = useContext(LocationContext);
  const [selectedSource, setSelectedSource] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');

  // Set current position as selected source when available
  useEffect(() => {
    if (position && !selectedSource) {
      const matchingLocation = findNearestPredefinedLocation(position.latitude, position.longitude);
      if (matchingLocation) {
        setSelectedSource(matchingLocation);
      }
    }
  }, [position]);

  // Helper to find the nearest predefined location to given coordinates
  const findNearestPredefinedLocation = (lat, lng) => {
    const threshold = 0.01; // ~1km threshold for "near" locations
    return PREDEFINED_LOCATIONS.find(loc => 
      Math.abs(loc.latitude - lat) < threshold && 
      Math.abs(loc.longitude - lng) < threshold
    );
  };

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

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  // Direct API call to create a path
  const sendPathToServer = async (source, destination) => {
    setDebugInfo('Preparing to send path data to server...');
    
    try {
      console.log('Sending path data:', {
        endpoint: '/path/set',
        payload: { source, destination }
      });
      
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/path/set', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          source,
          destination
        })
      });
      
      const data = await response.json();
      
      console.log('Path API response:', data);
      setDebugInfo(`API response received: ${response.status} - ${JSON.stringify(data)}`);
      
      if (!response.ok) {
        throw { response: { data } };
      }
      
      return data;
    } catch (error) {
      console.error('Path API error details:', error);
      setDebugInfo(`Error: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };
  // Submit function to update both current location and destination path.
  // This adds to your existing component
// Inside the handleSubmit function:

const handleSubmit = async () => {
  if (!selectedSource || !selectedDestination) {
    setMessage({ type: 'error', text: 'Please select both your current location and destination.' });
    return;
  }
  
  setIsUpdating(true);
  setDebugInfo('Starting update process...');
  
  try {
    // Update current location on server
    setDebugInfo('Updating location...');
    await updateLocation(selectedSource.latitude, selectedSource.longitude);
    
    // Prepare the path data
    const sourcePoint = {
      lat: selectedSource.latitude,
      lng: selectedSource.longitude
    };
    
    const destPoint = {
      lat: selectedDestination.latitude,
      lng: selectedDestination.longitude
    };
    
    setDebugInfo('Sending path data to server for route calculation...');
    
    // We no longer create the routeWKT here - the server will handle it
    // Just send source and destination points
    const response = await sendPathToServer(sourcePoint, destPoint);
    
    if (response.routeWKT) {
      setDebugInfo(`Server calculated route with ${response.routeWKT.split(',').length} points`);
    }
    
    setDebugInfo('Update completed successfully');
    setMessage({ 
      type: 'success', 
      text: `Location updated to ${selectedSource.name} and route to ${selectedDestination.name} created.`
    });
  } catch (error) {
    console.error('Failed to update location/path:', error);
    
    // Better error handling
    let errorMessage = 'Failed to update. Please try again.';
    
    if (error.response && error.response.data && error.response.data.message) {
      errorMessage = error.response.data.message;
      
      // Special handling for inactive user error
      if (errorMessage.includes('Only active users')) {
        errorMessage = 'Your location needs to be updated first. Please try again in a moment.';
      }
    }
    
    setMessage({ type: 'error', text: errorMessage });
  } finally {
    setIsUpdating(false);
  }
};

// Update sendPathToServer function


  // For debugging - directly test API call
  const testApiCall = async () => {
    setDebugInfo('Testing API call...');
    try {
      // Test basic authentication
      const token = localStorage.getItem('token');
      
      if (!token) {
        setDebugInfo('No auth token found! Please log in first.');
        return;
      }
      
      setDebugInfo(`Token found: ${token.substring(0, 10)}...`);
      
      // Test both with axios and fetch to compare
      const axiosResponse = await api.get('/auth/profile');
      
      setDebugInfo(`Axios API test successful. Status: ${axiosResponse.status}`);
      
      // Now try a direct fetch to the path endpoint
      const response = await fetch('http://localhost:5000/api/path/live', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      setDebugInfo(`Direct fetch to /path/live successful. Status: ${response.status}`);
      
      console.log('API test response:', { axios: axiosResponse.data, fetch: data });
    } catch (error) {
      setDebugInfo(`API test failed: ${error.message}`);
      console.error('API test error:', error);
    }
  };

  return (
    <div className="location-selector">
      <div className="location-selector-header">
        <h3>Select Your Location &amp; Destination</h3>
        <p>Choose your current location and a destination for path calculation</p>
      </div>
      
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
          <button className="close-message" onClick={() => setMessage(null)}>×</button>
        </div>
      )}
      
      {/* Debug information */}
      {debugInfo && (
        <div className="debug-info">
          <strong>Debug:</strong> {debugInfo}
        </div>
      )}
      
      {/* Search functionality */}
      <div className="search-container">
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search locations..."
          className="search-input"
        />
        {searchTerm && (
          <button className="clear-search" onClick={handleClearSearch}>×</button>
        )}
      </div>
      
      <div className="location-group">
        <h4>Your Current Location</h4>
        {selectedSource ? (
          <div className="selected-location">
            <p className="selected-name">{selectedSource.name}</p>
            <p className="selected-coords">
              {selectedSource.latitude.toFixed(4)}, {selectedSource.longitude.toFixed(4)}
            </p>
          </div>
        ) : (
          <p className="no-selection">No location selected.</p>
        )}
        <div className="locations-list">
          {filteredLocations.map(location => (
            <div 
              key={`source-${location.id}`}
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
            <p className="selected-name">{selectedDestination.name}</p>
            <p className="selected-coords">
              {selectedDestination.latitude.toFixed(4)}, {selectedDestination.longitude.toFixed(4)}
            </p>
          </div>
        ) : (
          <p className="no-selection">No destination selected.</p>
        )}
        <div className="locations-list">
          {filteredLocations.map(location => (
            <div 
              key={`dest-${location.id}`}
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
          {isUpdating ? 'Updating...' : 'Update Location & Set Path'}
        </button>
        
        {/* Debug button */}
        <button 
          className="test-api-button"
          onClick={testApiCall}
        >
          Test API Connection
        </button>
      </div>
      
      <div className="route-info">
        {selectedSource && selectedDestination && (
          <div className="route-summary">
            <h4>Route Summary</h4>
            <p>From: {selectedSource.name}</p>
            <p>To: {selectedDestination.name}</p>
            <p className="hint">Click "Update Location & Set Path" to create a route between these points</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationSelector;