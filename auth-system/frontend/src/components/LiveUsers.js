import React, { useState, useEffect, useContext } from 'react';
import { LocationContext } from '../context/LocationContext';
import { AuthContext } from '../context/AuthContext';
import './LiveUsers.css';

const LiveUsers = () => {
  // Add default empty array and default values to prevent undefined errors
  const { liveUsers = [], loadingUsers = false, fetchLiveUsers = () => {} } = useContext(LocationContext) || {};
  const { user } = useContext(AuthContext) || {};
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds default
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  useEffect(() => {
    // Check if fetchLiveUsers exists before calling
    if (typeof fetchLiveUsers === 'function') {
      // Initial fetch
      fetchLiveUsers();
      
      // Set up auto-refresh
      const intervalId = setInterval(() => {
        fetchLiveUsers();
        setLastUpdated(new Date());
      }, refreshInterval);
      
      // Cleanup
      return () => clearInterval(intervalId);
    }
  }, [refreshInterval, fetchLiveUsers]);

  const formatLastActive = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffSeconds = Math.floor((now - date) / 1000);
      
      if (diffSeconds < 60) {
        return 'Just now';
      } else if (diffSeconds < 3600) {
        const minutes = Math.floor(diffSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      } else if (diffSeconds < 86400) {
        const hours = Math.floor(diffSeconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else {
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      }
    } catch (e) {
      return 'Invalid date';
    }
  };

  const handleRefresh = () => {
    if (typeof fetchLiveUsers === 'function') {
      fetchLiveUsers();
      setLastUpdated(new Date());
    }
  };

  const changeRefreshInterval = (interval) => {
    setRefreshInterval(interval);
  };

  return (
    <div className="live-users-container">
      <div className="live-users-header">
        <h2>Live Users ({Array.isArray(liveUsers) ? liveUsers.length : 0})</h2>
        <div className="refresh-control">
          <button 
            onClick={handleRefresh} 
            disabled={loadingUsers}
            className="refresh-button"
          >
            {loadingUsers ? 'Refreshing...' : 'Refresh Now'}
          </button>
          
          <div className="refresh-interval">
            <span>Auto-refresh: </span>
            <select 
              value={refreshInterval} 
              onChange={(e) => changeRefreshInterval(Number(e.target.value))}
            >
              <option value={10000}>10 seconds</option>
              <option value={30000}>30 seconds</option>
              <option value={60000}>1 minute</option>
              <option value={300000}>5 minutes</option>
            </select>
          </div>
          
          <span className="last-updated">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>
      
      {loadingUsers && (!Array.isArray(liveUsers) || liveUsers.length === 0) ? (
        <div className="live-users-loading">Loading users...</div>
      ) : !Array.isArray(liveUsers) || liveUsers.length === 0 ? (
        <p className="no-users-message">No users are currently online</p>
      ) : (
        <div className="live-users-list">
          {liveUsers.map((userItem) => (
            <div 
              key={userItem?.id || `user-${Math.random()}`} 
              className={`user-card ${userItem?.id === user?.id ? 'current-user' : ''}`}
            >
              <div 
                className="user-avatar"
                style={{ 
                  backgroundColor: userItem?.id === user?.id ? '#4285F4' : '#FF5722'
                }}
              >
                {(userItem?.username || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <div className="user-name-status">
                  <span className="username">
                    {userItem?.username || 'Unknown User'}
                    {userItem?.id === user?.id && (
                      <span className="self-indicator"> (You)</span>
                    )}
                  </span>
                  <div className="user-status">
                    <span className="status-dot"></span>
                    <span>Online</span>
                  </div>
                </div>
                
                <div className="user-details">
                  <span className="last-active">
                    Last active: {formatLastActive(userItem?.last_active)}
                  </span>
                  
                  {userItem?.latitude && userItem?.longitude ? (
                    <div className="location-info">
                      <span className="coordinates">
                        {parseFloat(userItem.latitude).toFixed(4)}, {parseFloat(userItem.longitude).toFixed(4)}
                      </span>
                      <a 
                        href={`https://www.google.com/maps?q=${userItem.latitude},${userItem.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="view-map-link"
                      >
                        View on Google Maps
                      </a>
                    </div>
                  ) : (
                    <span className="no-location">No location data available</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveUsers;