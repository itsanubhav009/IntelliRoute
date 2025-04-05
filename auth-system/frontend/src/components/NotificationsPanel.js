import React, { useContext } from 'react';
import { ChatContext } from '../context/ChatContext';
import ChatNotification from './ChatNotification';
import './NotificationsPanel.css';

const NotificationsPanel = ({ onClose }) => {
  const { notifications, loading } = useContext(ChatContext);

  return (
    <div className="notifications-panel">
      <div className="notifications-header">
        <h3>Notifications</h3>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="notifications-list">
        {loading ? (
          <div className="loading-notifications">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="no-notifications">No new notifications</div>
        ) : (
          notifications.map(notification => (
            <ChatNotification 
              key={notification.id} 
              notification={notification} 
            />
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsPanel;