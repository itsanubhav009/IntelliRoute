import React, { useContext } from 'react';
import { ChatContext } from '../context/ChatContext';
import './ChatNotification.css';

const ChatNotification = ({ notification }) => {
  const { acceptChatRequest, declineChatRequest, openChat } = useContext(ChatContext);

  const handleAccept = async () => {
    try {
      console.log('Accepting chat request for room:', notification.chat_room_id);
      const result = await acceptChatRequest(notification.chat_room_id);
      console.log('Chat request accepted, result:', result);
      
      // Important: Open the chat after accepting
      openChat(notification.chat_room_id);
    } catch (error) {
      console.error('Failed to accept chat request', error);
    }
  };

  const handleDecline = async () => {
    try {
      console.log('Declining chat request');
      await declineChatRequest(notification.chat_room_id);
    } catch (error) {
      console.error('Failed to decline chat request', error);
    }
  };

  // Format time
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-notification">
      <div className="notification-content">
        <div className="notification-message">{notification.message}</div>
        <div className="notification-time">{formatTime(notification.created_at)}</div>
      </div>
      
      {/* For chat requests, show accept/decline buttons */}
      {notification.type === 'chat_request' && (
        <div className="notification-actions">
          <button 
            className="accept-button" 
            onClick={handleAccept}
          >
            Accept
          </button>
          <button 
            className="decline-button" 
            onClick={handleDecline}
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatNotification;