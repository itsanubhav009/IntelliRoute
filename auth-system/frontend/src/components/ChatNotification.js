import React, { useContext, useState } from 'react';
import { ChatContext } from '../context/ChatContext';
import './ChatNotification.css';

const ChatNotification = ({ notification }) => {
  const { acceptChatRequest, declineChatRequest, openChat } = useContext(ChatContext);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [error, setError] = useState(null);

  const handleAccept = async () => {
    try {
      setIsAccepting(true);
      setError(null);
      
      console.log('Accepting chat request for room:', notification.chat_room_id);
      await acceptChatRequest(notification.chat_room_id);
      
      // Explicitly open the chat after accepting
<<<<<<< HEAD
      await openChat(notification.chat_room_id);
=======
      setTimeout(() => {
        openChat(notification.chat_room_id);
      }, 1000);
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
    } catch (error) {
      console.error('Failed to accept chat request', error);
      setError('Could not accept chat request. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    try {
      setIsDeclining(true);
      setError(null);
      
      console.log('Declining chat request');
      await declineChatRequest(notification.chat_room_id);
    } catch (error) {
      console.error('Failed to decline chat request', error);
      setError('Could not decline chat request. Please try again.');
    } finally {
      setIsDeclining(false);
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
      
      {error && <div className="notification-error">{error}</div>}
      
      {/* For chat requests, show accept/decline buttons */}
      {notification.type === 'chat_request' && (
        <div className="notification-actions">
          <button 
            className="accept-button" 
            onClick={handleAccept}
            disabled={isAccepting || isDeclining}
          >
            {isAccepting ? 'Accepting...' : 'Accept'}
          </button>
          <button 
            className="decline-button" 
            onClick={handleDecline}
            disabled={isAccepting || isDeclining}
          >
            {isDeclining ? 'Declining...' : 'Decline'}
          </button>
        </div>
      )}
      
      {/* For accepted chats, show open button */}
      {notification.type === 'chat_accepted' && (
        <div className="notification-actions">
          <button 
            className="open-chat-button" 
            onClick={() => openChat(notification.chat_room_id)}
          >
            Open Chat
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatNotification;