import React, { useState, useContext, useEffect, useRef } from 'react';
import { ChatContext } from '../context/ChatContext';
import './ChatDialog.css';

const ChatDialog = () => {
  const { 
    currentChat, 
    messages, 
    sendMessage, 
    closeChat, 
    loading 
  } = useContext(ChatContext);
  
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  console.log('ChatDialog rendered. Current chat:', currentChat);
  console.log('Messages:', messages);

  // Scroll to bottom of messages when new messages come in
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    try {
      await sendMessage(currentChat.id, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message', error);
    }
  };

  // Safety check - should never happen but just in case
  if (!currentChat) {
    console.warn('ChatDialog rendered without a currentChat');
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
    <div className="chat-dialog-overlay">
      <div className="chat-dialog">
        <div className="chat-header">
          <h3>{chatName}</h3>
          <button className="close-button" onClick={closeChat}>×</button>
        </div>
        
        <div className="chat-messages">
          {loading && messages.length === 0 ? (
            <div className="loading-messages">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="no-messages">No messages yet. Say hello!</div>
          ) : (
            messages.map(msg => {
              // Determine if this is my message or the other person's
              const isMyMessage = msg.user_id === currentChat.otherParticipants[0]?.id ? false : true;
              
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
        
        <form className="chat-input-form" onSubmit={handleSend}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="chat-input"
          />
          <button 
            type="submit" 
            className="send-button" 
            disabled={!newMessage.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatDialog;