import React from 'react';
import './NotificationButton.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';

const NotificationButton = ({ notificationCount, onClick, isLoading }) => {
  return (
    <button 
      className={`notification-btn ${isLoading ? 'loading' : ''}`}
      onClick={onClick}
      aria-label="Notifications"
      title="View notifications"
      disabled={isLoading}
    >
      <FontAwesomeIcon icon={faBell} className="bell-icon" />
      {notificationCount > 0 && (
        <span className="notification-badge">{notificationCount}</span>
      )}
      {isLoading && <span className="loading-spinner"></span>}
    </button>
  );
};

export default NotificationButton;