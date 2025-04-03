import React, { useState, useEffect, useContext } from 'react';
import { LocationContext } from '../context/LocationContext';
import './LiveUsers.css';

const LiveUsers = () => {
  const { liveUsers, loadingUsers, fetchLiveUsers } = useContext(LocationContext);
  const [refreshInterval, setRefreshInterval] = useState(null);

  useEffect(() => {
    // Initial fetch
    fetchLiveUsers();
    
    // Set up auto-refresh
    const intervalId = setInterval(() => {
      fetchLiveUsers();
    }, 1000000); // Refresh every 10 seconds
    
    setRefreshInterval(intervalId);
    
    // Cleanup
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  const formatLastActive = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);
    
    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleTimeString();
    }
  };

  const handleRefresh = () => {
    fetchLiveUsers();
  };

  return (
    <div className="live-users-container">
      <div className="live-users-header">
        <h2>Live Users ({liveUsers.length})</h2>
        <div className="refresh-control">
          <button onClick={handleRefresh} disabled={loadingUsers}>
            {loadingUsers ? 'Refreshing...' : 'Refresh Now'}
          </button>
          <span className="last-updated">
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
      
      {loadingUsers && liveUsers.length === 0 ? (
        <div className="live-users-loading">Loading users...</div>
      ) : liveUsers.length === 0 ? (
        <p className="no-users-message">No users are currently online</p>
      ) : (
        <div className="live-users-list">
          {liveUsers.map((user) => (
            <div key={user.id} className="user-card">
              <div className="user-avatar">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <span className="username">{user.username}</span>
                <div className="user-status">
                  <span className="status-dot"></span>
                  <span>Online</span>
                </div>
                <div className="user-details">
                  <span>Last active: {formatLastActive(user.last_active)}</span>
                  
                  {user.latitude && user.longitude ? (
                    <div className="location-link">
                      <a 
                        href={`https://www.google.com/maps?q=${user.latitude},${user.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on Map
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