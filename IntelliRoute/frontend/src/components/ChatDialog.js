import React, { useState, useEffect, useContext, useRef } from 'react';
import { ChatContext } from '../context/ChatContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPaperPlane, faSpinner, faInfoCircle, faCheck } from '@fortawesome/free-solid-svg-icons';
import './ChatDialog.css';

const ChatDialog = () => {
  const { 
    currentChat, 
    messages, 
    sendMessage, 
    closeChat, 
    fetchMessages,
    chatStatus,
    fetchActiveChats
  } = useContext(ChatContext);
  
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [localChatState, setLocalChatState] = useState({
    isActive: false,
    hasJoined: false,
    isReady: false
  });
  const messagesEndRef = useRef(null);
  
  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // Effect to scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Effect to check and update chat status
  useEffect(() => {
    if (!currentChat) return;
    
    console.log('Current chat state:', currentChat);
    
    // Force active if we already have messages (a reliable indicator of an active chat)
    const forceActive = messages && messages.length > 0;
    
    // Update local state based on current chat and message presence
    setLocalChatState({
      isActive: forceActive || currentChat.isActive,
      hasJoined: forceActive || currentChat.hasJoined,
      isReady: forceActive || (currentChat.isActive && currentChat.hasJoined)
    });
    
    // If chat appears inactive but we have messages, refresh chat status
    if (!currentChat.isActive && messages && messages.length > 0) {
      console.log('Chat appears active (has messages) but status shows inactive. Refreshing...');
      fetchActiveChats(true).then(updatedChats => {
        const updatedChat = updatedChats.find(c => c.id === currentChat.id);
        if (updatedChat) {
          console.log('Updated chat status:', updatedChat);
          if (updatedChat.isActive) {
            setLocalChatState({
              isActive: true,
              hasJoined: true,
              isReady: true
            });
          }
        }
      });
    }
    
    // Set up polling to check status if needed
    let checkInterval;
    
    if (!currentChat.isActive || !currentChat.hasJoined) {
      console.log('Setting up status polling for chat room', currentChat.id);
      
      checkInterval = setInterval(() => {
        fetchActiveChats(true).then(updatedChats => {
          const updatedChat = updatedChats.find(c => c.id === currentChat.id);
          if (updatedChat && (updatedChat.isActive || messages.length > 0)) {
            console.log('Updated chat status:', updatedChat);
            setLocalChatState({
              isActive: true,
              hasJoined: true, 
              isReady: true
            });
            clearInterval(checkInterval);
          }
        });
      }, 3000);
    }
    
    // Regular message polling
    const messagePollingId = setInterval(() => {
      fetchMessages(currentChat.id);
    }, 5000);
    
    return () => {
      if (checkInterval) clearInterval(checkInterval);
      clearInterval(messagePollingId);
    };
  }, [currentChat, messages, fetchActiveChats, fetchMessages]);
  
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!messageText.trim() || !currentChat) return;
    
    try {
      setSending(true);
      setSendError(null);
      await sendMessage(currentChat.id, messageText);
      setMessageText('');
      
      // If we successfully sent a message, the chat must be active
      setLocalChatState({
        isActive: true,
        hasJoined: true,
        isReady: true
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      setSendError('Failed to send message: ' + (error.response?.data?.message || error.message));
      
      // Clear error after 5 seconds
      setTimeout(() => setSendError(null), 5000);
    } finally {
      setSending(false);
    }
  };
  
  if (!currentChat) return null;
  
  const otherUser = currentChat.otherParticipants && currentChat.otherParticipants[0];
  // Use the local state which may override the current chat state
  const isActive = localChatState.isActive || (messages && messages.length > 0);
  const isReady = localChatState.isReady || (messages && messages.length > 0);
  
  return (
    <div className="chat-dialog">
      <div className="chat-header">
        <div className="chat-title">
          {otherUser ? otherUser.username : 'Chat'}
          {!isActive && <span className="chat-status-pill">Pending</span>}
          {isActive && <span className="chat-status-pill active">Active</span>}
        </div>
        <button className="close-button" onClick={closeChat}>
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
      
      {!isReady && (
        <div className="chat-pending-banner">
          <FontAwesomeIcon icon={faInfoCircle} />
          Checking chat status...
        </div>
      )}
      
      {isReady && messages.length > 0 && (
        <div className="chat-active-banner">
          <FontAwesomeIcon icon={faCheck} />
          Chat is active. You can now send messages.
        </div>
      )}
      
      <div className="chat-messages">
        {messages.length > 0 ? (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`message ${msg.user_id === currentChat.otherParticipants[0]?.id ? 'received' : 'sent'}`}
            >
              <div className="message-bubble">
                {msg.message}
              </div>
              <div className="message-info">
                {msg.profiles?.username || 'User'} · {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </div>
            </div>
          ))
        ) : (
          <div className="no-messages">
            {isReady
              ? "No messages yet. Start the conversation!"
              : "Waiting for chat to activate. Messages will appear here once both users have joined."}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {chatStatus && (
        <div className={`chat-dialog-status ${chatStatus.type}`}>
          {chatStatus.message}
        </div>
      )}
      
      {sendError && (
        <div className="chat-dialog-status error">
          {sendError}
        </div>
      )}
      
      <form className="chat-input" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder={isReady 
            ? "Type your message..." 
            : "Waiting for chat to activate..."}
          disabled={sending || !isReady}
        />
        <button 
          type="submit" 
          disabled={sending || !messageText.trim() || !isReady}
          className={isReady ? "active" : ""}
        >
          {sending ? (
            <FontAwesomeIcon icon={faSpinner} className="fa-spin" />
          ) : (
            <FontAwesomeIcon icon={faPaperPlane} />
          )}
        </button>
      </form>
    </div>
  );
};

export default ChatDialog;