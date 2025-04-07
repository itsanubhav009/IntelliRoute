import React, { useState, useContext, useEffect, useRef } from 'react';
import { ChatContext } from '../context/ChatContext';
import { AuthContext } from '../context/AuthContext';
import './ChatDialog.css';

const ChatDialog = () => {
  const { user } = useContext(AuthContext);
  const { 
    currentChat, 
    messages, 
    sendMessage, 
    closeChat, 
    loading,
    fetchMessages
  } = useContext(ChatContext);
  
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    // Scroll to bottom on new messages
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Re-fetch messages periodically while chat is open
  useEffect(() => {
    if (currentChat) {
      // Initial fetch
      fetchMessages(currentChat.id);
      
      // Set up polling for new messages
      const intervalId = setInterval(() => {
        fetchMessages(currentChat.id);
      }, 5000);
      
      return () => clearInterval(intervalId);
    }
  }, [currentChat, fetchMessages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sendingMessage) return;
    
    try {
      setSendingMessage(true);
      setError(null);
      
      await sendMessage(currentChat.id, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message', error);
      setError('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  // Safety check
  if (!currentChat) {
    return null;
  }

  // Get the name of the other participant
  const otherParticipant = currentChat.otherParticipants && 
                          currentChat.otherParticipants.length > 0 ? 
                          currentChat.otherParticipants[0] : null;
  const chatName = otherParticipant ? otherParticipant.username : 'Chat';

  // Format time
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-dialog-overlay" onClick={(e) => {
      // Close when clicking outside the dialog
      if (e.target.className === 'chat-dialog-overlay') {
        closeChat();
      }
    }}>
      <div className="chat-dialog">
        <div className="chat-header">
          <h3>{chatName}</h3>
          <button className="close-button" onClick={closeChat}>×</button>
        </div>
        
        <div className="chat-messages" ref={messagesContainerRef}>
          {loading && messages.length === 0 ? (
            <div className="loading-messages">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="no-messages">No messages yet. Say hello!</div>
          ) : (
            messages.map(msg => {
              // Determine if this is my message or the other person's
              const isMyMessage = msg.user_id === user.id;
              
              return (
                <div 
                  key={msg.id}
                  className={`message ${isMyMessage ? 'sent' : 'received'}`}
                >
                  <div className="message-content">{msg.message}</div>
                  <div className="message-time">{formatTime(msg.created_at)}</div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {error && <div className="chat-error">{error}</div>}
        
        <form className="chat-input-form" onSubmit={handleSend}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="chat-input"
            disabled={sendingMessage}
          />
          <button 
            type="submit" 
            className="send-button" 
            disabled={!newMessage.trim() || sendingMessage}
          >
            {sendingMessage ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatDialog;