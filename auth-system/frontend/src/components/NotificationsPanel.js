import React, { useContext, useState } from 'react';
import { ChatContext } from '../context/ChatContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faBell, faComment, faSpinner } from '@fortawesome/free-solid-svg-icons';
import './NotificationsPanel.css';

const NotificationsPanel = ({ onClose }) => {
  const { 
    notifications, 
    acceptChatRequest, 
    declineChatRequest, 
    loading,
    chatStatus,
    handleNotificationClick
  } = useContext(ChatContext);
  
  // Track which notification is being processed
  const [processingNotifications, setProcessingNotifications] = useState({});

  const handleAccept = async (chatRoomId, notificationId) => {
    try {
      // Mark this notification as processing
      setProcessingNotifications(prev => ({
        ...prev,
        [notificationId]: 'accepting'
      }));
      
      console.log(`[${new Date().toISOString()}] User itsanubhav009 is accepting chat request ${chatRoomId}`);
      
      // Call the acceptChatRequest function from context
      const result = await acceptChatRequest(chatRoomId);
      console.log('Accept chat request result:', result);
      
      // Only close the panel if the acceptance was successful
      if (result && result.success) {
        console.log('Chat request accepted successfully, closing panel');
        if (onClose) setTimeout(onClose, 500); // Slight delay to show success state
      } else {
        console.error('Chat request acceptance failed:', result?.error || 'Unknown error');
        setProcessingNotifications(prev => ({
          ...prev,
          [notificationId]: 'error'
        }));
        
        // Reset the status after a delay
        setTimeout(() => {
          setProcessingNotifications(prev => {
            const newState = {...prev};
            delete newState[notificationId];
            return newState;
          });
        }, 3000);
      }
    } catch (error) {
      console.error('Error in handleAccept:', error);
      setProcessingNotifications(prev => ({
        ...prev,
        [notificationId]: 'error'
      }));
      
      // Reset the status after a delay
      setTimeout(() => {
        setProcessingNotifications(prev => {
          const newState = {...prev};
          delete newState[notificationId];
          return newState;
        });
      }, 3000);
    }
  };

  const handleDecline = async (chatRoomId, notificationId) => {
    try {
      // Mark this notification as processing
      setProcessingNotifications(prev => ({
        ...prev,
        [notificationId]: 'declining'
      }));
      
      console.log(`[${new Date().toISOString()}] User itsanubhav009 is declining chat request ${chatRoomId}`);
      await declineChatRequest(chatRoomId);
      
      // Mark as complete
      setProcessingNotifications(prev => ({
        ...prev,
        [notificationId]: 'complete'
      }));
      
      // Remove from list after a delay
      setTimeout(() => {
        setProcessingNotifications(prev => {
          const newState = {...prev};
          delete newState[notificationId];
          return newState;
        });
      }, 1000);
    } catch (error) {
      console.error('Error declining chat request:', error);
      setProcessingNotifications(prev => ({
        ...prev,
        [notificationId]: 'error'
      }));
      
      // Reset the status after a delay
      setTimeout(() => {
        setProcessingNotifications(prev => {
          const newState = {...prev};
          delete newState[notificationId];
          return newState;
        });
      }, 3000);
    }
  };

  const handleNotificationItemClick = async (notification) => {
    // For chat_request notifications, don't do anything on click
    // since we have explicit accept/decline buttons
    if (notification.type === 'chat_request') {
      return;
    }
    
    // Already processing this notification
    if (processingNotifications[notification.id]) {
      return;
    }
    
    try {
      setProcessingNotifications(prev => ({
        ...prev,
        [notification.id]: 'processing'
      }));
      
      await handleNotificationClick(notification);
      
      // Close the panel with a slight delay
      setTimeout(() => {
        if (onClose) onClose();
      }, 300);
    } catch (error) {
      console.error('Error handling notification click:', error);
      setProcessingNotifications(prev => ({
        ...prev,
        [notification.id]: 'error'
      }));
      
      // Reset the status after a delay
      setTimeout(() => {
        setProcessingNotifications(prev => {
          const newState = {...prev};
          delete newState[notification.id];
          return newState;
        });
      }, 3000);
    }
  };

  const formatTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  // Helper function to get button states
  const getButtonState = (notificationId, type) => {
    const state = processingNotifications[notificationId];
    if (!state) return 'normal';
    
    if (type === 'accept') {
      return state === 'accepting' ? 'processing' : 
             state === 'error' ? 'error' : 
             state === 'complete' ? 'success' : 'disabled';
    } else {
      return state === 'declining' ? 'processing' : 
             state === 'error' ? 'error' : 
             state === 'complete' ? 'success' : 'disabled';
    }
  };

  return (
    <div className="notifications-panel">
      <div className="notifications-header">
        <h3><FontAwesomeIcon icon={faBell} /> Notifications</h3>
        <button className="close-button" onClick={onClose}>&times;</button>
      </div>
      
      {chatStatus && (
        <div className={`chat-status ${chatStatus.type}`}>
          {chatStatus.message}
        </div>
      )}
      
      <div className="notifications-list">
        {notifications && notifications.length > 0 ? (
          notifications.map(notification => {
            const acceptBtnState = getButtonState(notification.id, 'accept');
            const declineBtnState = getButtonState(notification.id, 'decline');
            
            return (
              <div 
                key={notification.id} 
                className={`notification-item ${notification.type} ${processingNotifications[notification.id] ? 'processing' : ''}`}
                onClick={() => handleNotificationItemClick(notification)}
              >
                <div className="notification-icon">
                  <FontAwesomeIcon icon={notification.type.includes('chat') ? faComment : faBell} />
                </div>
                <div className="notification-content">
                  <div className="notification-message">{notification.message}</div>
                  <div className="notification-time">{formatTime(notification.created_at)}</div>
                </div>
                
                {notification.type === 'chat_request' && (
                  <div className="notification-actions">
                    <button 
                      className={`notification-accept ${acceptBtnState}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (acceptBtnState === 'normal') {
                          handleAccept(notification.chat_room_id, notification.id);
                        }
                      }}
                      disabled={acceptBtnState !== 'normal'}
                    >
                      {acceptBtnState === 'processing' ? (
                        <FontAwesomeIcon icon={faSpinner} className="fa-spin" />
                      ) : (
                        <FontAwesomeIcon icon={faCheck} />
                      )}
                    </button>
                    <button 
                      className={`notification-decline ${declineBtnState}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (declineBtnState === 'normal') {
                          handleDecline(notification.chat_room_id, notification.id);
                        }
                      }}
                      disabled={declineBtnState !== 'normal'}
                    >
                      {declineBtnState === 'processing' ? (
                        <FontAwesomeIcon icon={faSpinner} className="fa-spin" />
                      ) : (
                        <FontAwesomeIcon icon={faTimes} />
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="no-notifications">No new notifications</div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPanel;