import React, { useContext, useEffect, useState } from 'react';
import { ChatContext } from '../context/ChatContext';
import ChatNotification from './ChatNotification';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync } from '@fortawesome/free-solid-svg-icons';
import './NotificationsPanel.css';

const NotificationsPanel = ({ onClose }) => {
  const { notifications, fetchNotifications } = useContext(ChatContext);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Force refresh notifications
  const handleRefreshNotifications = async () => {
    setIsRefreshing(true);
    try {
      await fetchNotifications(true); // Force refresh by passing true
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Failed to refresh notifications:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get current time in format HH:MM:SS
  const getTimeString = () => {
    return lastRefreshed.toLocaleTimeString();
  };

  return (
    <div className="notifications-panel">
      <div className="notifications-header">
        <h3>Notifications</h3>
        <div className="notification-actions">
          <button 
            className="refresh-notifications-btn" 
            onClick={handleRefreshNotifications}
            disabled={isRefreshing}
            title="Refresh notifications"
          >
            <FontAwesomeIcon icon={faSync} spin={isRefreshing} />
          </button>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
      </div>
      
      <div className="last-refreshed">
        Last refreshed: {getTimeString()}
      </div>
      
      <div className="notifications-list">
        {notifications && notifications.length > 0 ? (
          notifications.map(notification => (
            <ChatNotification 
              key={notification.id} 
              notification={notification} 
            />
          ))
        ) : (
          <div className="no-notifications">
            <p>No notifications</p>
            <p className="no-notifications-sub">You will see chat requests and other notifications here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPanel;