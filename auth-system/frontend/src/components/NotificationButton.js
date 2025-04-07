import React from 'react';
import './NotificationButton.css';

const NotificationButton = ({ notificationCount, onClick }) => {
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Notification button clicked");
    if (onClick) onClick();
  };

  return (
    <button 
      className="custom-notification-btn" 
      onClick={handleClick}
      aria-label="Notifications"
    >
      <div className="bell-icon">
        <div className="bell-top"></div>
        <div className="bell-body"></div>
      </div>
      {notificationCount > 0 && (
        <span className="notification-count">{notificationCount}</span>
      )}
    </button>
  );
};

export default NotificationButton;