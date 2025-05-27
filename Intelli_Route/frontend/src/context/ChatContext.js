import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import api from '../utils/api';
import { AuthContext } from './AuthContext';

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [activeChats, setActiveChats] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chatStatus, setChatStatus] = useState(null);
  
  // Add these to track last request times
  const lastRequest = useRef({
    chat: 0,
    notifications: 0,
    messages: 0
  });
  
  // Add this to prevent concurrent requests
  const pendingRequests = useRef({
    chat: false,
    notifications: false,
    messages: false
  });

  // Enforce API delay function
  const enforceApiDelay = useCallback(async (requestType, minDelay = 2000) => {
    if (pendingRequests.current[requestType]) {
      console.log(`${requestType} request already in progress, skipping`);
      return false;
    }
    
    const now = Date.now();
    if (now - lastRequest.current[requestType] < minDelay) {
      console.log(`Throttling ${requestType} request, too soon`);
      return false;
    }
    
    pendingRequests.current[requestType] = true;
    lastRequest.current[requestType] = now;
    return true;
  }, []);

  // Throttled fetch notifications
  const fetchNotifications = useCallback(async (force = false) => {
    if (!user) return [];
    
    if (pendingRequests.current.notifications) {
      return notifications;
    }
    
    const now = Date.now();
    if (!force && now - lastRequest.current.notifications < 10000) {
      return notifications;
    }
    
    try {
      pendingRequests.current.notifications = true;
      const response = await api.get('/chat/notifications');
      lastRequest.current.notifications = now;
      
      const newNotifications = response.data.notifications || [];
      if (JSON.stringify(newNotifications) !== JSON.stringify(notifications)) {
        setNotifications(newNotifications);
      }
      
      return newNotifications;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    } finally {
      pendingRequests.current.notifications = false;
    }
  }, [user, notifications]);

  // Throttled fetch active chats
  const fetchActiveChats = useCallback(async (force = false) => {
    if (!user) return [];
    
    if (pendingRequests.current.chat) {
      return activeChats;
    }
    
    const now = Date.now();
    if (!force && now - lastRequest.current.chat < 10000) {
      return activeChats;
    }
    
    try {
      pendingRequests.current.chat = true;
      setLoading(true);
      
      const response = await api.get('/chat/active');
      lastRequest.current.chat = now;
      
      const newChats = response.data.chats || [];
      
      if (JSON.stringify(newChats) !== JSON.stringify(activeChats)) {
        setActiveChats(newChats);
      }
      
      return newChats;
    } catch (error) {
      console.error('Error fetching active chats:', error);
      setError('Failed to fetch active chats');
      return [];
    } finally {
      setLoading(false);
      pendingRequests.current.chat = false;
    }
  }, [user, activeChats]);

  // Send a chat request to another user
  const sendChatRequest = async (recipientId) => {
    if (!user || !recipientId) return;
    
    try {
      setLoading(true);
      setChatStatus({
        type: 'sending',
        message: 'Sending chat request...'
      });
      
      const response = await api.post('/chat/request', { recipientId });
      
      await fetchActiveChats(true);
      
      localStorage.setItem('pendingChatRequest', response.data.chatRoomId);
      
      setChatStatus({
        type: 'success',
        message: 'Chat request sent successfully! Waiting for acceptance.'
      });
      
      setTimeout(() => setChatStatus(null), 3000);
      
      return response.data;
    } catch (error) {
      console.error('Error sending chat request:', error);
      
      setChatStatus({
        type: 'error',
        message: 'Failed to send chat request: ' + (error.response?.data?.message || error.message)
      });
      
      setTimeout(() => setChatStatus(null), 5000);
      
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Accept a chat request with enhanced error handling
 // Replace the acceptChatRequest function in your ChatContext.js file with this improved version
// Add this helper function to your ChatContext.js
const ensureParticipantsCanChat = async (chatRoomId) => {
  try {
    console.log(`[${new Date().toISOString()}] Ensuring all participants can chat in room ${chatRoomId}`);
    
    // Get the chat from active chats
    const chat = activeChats.find(c => c.id === chatRoomId);
    
    if (!chat) {
      console.error('Chat not found in active chats');
      return false;
    }
    
    // If chat is already active and user has joined, we're good
    if (chat.isActive && chat.hasJoined) {
      console.log('Chat is already active and user has joined');
      return true;
    }
    
    // If we need to refresh the chat status
    const refreshedChats = await fetchActiveChats(true);
    const refreshedChat = refreshedChats.find(c => c.id === chatRoomId);
    
    if (!refreshedChat) {
      console.error('Chat not found after refresh');
      return false;
    }
    
    return refreshedChat.isActive && refreshedChat.hasJoined;
  } catch (error) {
    console.error('Error ensuring participants can chat:', error);
    return false;
  }
};

// Replace the acceptChatRequest function with this improved version
// Improved accept chat request function for ChatContext.js
const acceptChatRequest = async (chatRoomId) => {
  if (!user || !chatRoomId) return { success: false, error: 'Missing data' };
  
  try {
    setLoading(true);
    setChatStatus({
      type: 'accepting',
      message: 'Accepting chat request...'
    });
    
    console.log(`[${new Date().toISOString()}] Accepting chat request ${chatRoomId}`);
    const response = await api.post('/chat/accept', { chatRoomId });
    
    // Get updated notifications
    await fetchNotifications(true);
    
    // Force-refresh active chats list
    const updatedChats = await fetchActiveChats(true);
    const acceptedChat = updatedChats.find(c => c.id === chatRoomId);
    
    if (acceptedChat) {
      // Force fetch messages to verify chat is working
      try {
        const chatMessages = await fetchMessages(chatRoomId, true);
        console.log('Initial messages after acceptance:', chatMessages);
      } catch (err) {
        console.warn('Could not fetch initial messages, will retry');
      }
      
      // Important: Override the chat status locally for immediate UI update
      acceptedChat.isActive = true;
      acceptedChat.hasJoined = true;
      
      // Set as current chat
      setCurrentChat(acceptedChat);
      
      setChatStatus({
        type: 'success',
        message: 'Chat activated successfully!'
      });
      
      setTimeout(() => setChatStatus(null), 3000);
      
      return { success: true, chat: acceptedChat };
    } else {
      console.error('Chat not found after acceptance');
      setChatStatus({
        type: 'error',
        message: 'Chat not found after acceptance'
      });
      
      setTimeout(() => setChatStatus(null), 5000);
      return { success: false, error: 'Chat not found' };
    }
  } catch (error) {
    console.error('Error accepting chat:', error);
    setChatStatus({
      type: 'error',
      message: 'Failed to accept chat: ' + (error.message || 'Unknown error')
    });
    
    setTimeout(() => setChatStatus(null), 5000);
    return { success: false, error: error.message };
  } finally {
    setLoading(false);
  }
};

  // Decline a chat request
  const declineChatRequest = async (chatRoomId) => {
    if (!user || !chatRoomId) return;
    
    try {
      setLoading(true);
      setChatStatus({
        type: 'declining',
        message: 'Declining chat request...'
      });
      
      await api.post('/chat/decline', { chatRoomId });
      
      await fetchNotifications(true);
      
      setChatStatus({
        type: 'success',
        message: 'Chat request declined'
      });
      
      setTimeout(() => setChatStatus(null), 3000);
      
      return { success: true };
    } catch (error) {
      console.error('Error declining chat request:', error);
      
      setChatStatus({
        type: 'error',
        message: 'Failed to decline chat request: ' + (error.message || 'Unknown error')
      });
      
      setTimeout(() => setChatStatus(null), 5000);
      
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Send a message in a chat
  const sendMessage = async (chatRoomId, message) => {
    if (!user || !chatRoomId || !message) return;
    
    try {
      const response = await api.post('/chat/send', { chatRoomId, message });
      
      const newMessage = response.data.chatMessage;
      setMessages(prev => [
        ...prev, 
        {...newMessage, profiles: { username: user.username }}
      ]);
      
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      
      if (error.response?.status === 403 && error.response?.data?.message?.includes('not active')) {
        setChatStatus({
          type: 'waiting',
          message: 'Waiting for recipient to accept your chat request...'
        });
        
        setTimeout(() => setChatStatus(null), 5000);
      } else {
        setError('Failed to send message: ' + error.message);
      }
      
      throw error;
    }
  };

  // Fetch messages for a chat
  const fetchMessages = useCallback(async (chatRoomId, force = false) => {
    if (!user || !chatRoomId) return;
    
    if (currentChat && !force && !(await enforceApiDelay('messages'))) {
      return messages;
    }
    
    try {
      setLoading(true);
      
      const response = await api.get(`/chat/messages/${chatRoomId}`);
      
      if (response.data.messages) {
        setMessages(response.data.messages);
        return response.data.messages;
      } else {
        setMessages([]);
        return [];
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      
      if (error.response?.status === 403 && error.response?.data?.message?.includes('not active')) {
        setChatStatus({
          type: 'waiting',
          message: 'This chat room is not active yet. Waiting for acceptance...'
        });
        
        setTimeout(() => setChatStatus(null), 5000);
        setMessages([]);
      } else {
        setError('Failed to fetch messages: ' + error.message);
        setMessages([]);
      }
      
      return [];
    } finally {
      setLoading(false);
      pendingRequests.current.messages = false;
    }
  }, [user, messages, currentChat, enforceApiDelay]);

  // Open a chat with improved error handling for inactive chats
  const openChat = useCallback(async (chatRoomId) => {
    try {
      setLoading(true);
      
      let chat = activeChats.find(c => c.id === chatRoomId);
      
      if (!chat) {
        const updatedChats = await fetchActiveChats(true);
        chat = updatedChats.find(c => c.id === chatRoomId);
      }
      
      if (chat) {
        // Check if the chat is active
        if (!chat.isActive) {
          // If the chat is not active, check if user has joined
          if (chat.hasJoined) {
            // If the user has joined, they're waiting for the other person
            setChatStatus({
              type: 'waiting',
              message: 'Waiting for the other person to accept your chat request...'
            });
            
            setCurrentChat(chat);
            setMessages([]);
            
            setTimeout(() => setChatStatus(null), 5000);
            
            return { 
              success: true, 
              chat, 
              status: 'waiting' 
            };
          } else {
            // If the user hasn't joined, they need to accept the request first
            setChatStatus({
              type: 'pending',
              message: 'You need to accept this chat request first'
            });
            
            await acceptChatRequest(chatRoomId);
            return { 
              success: true, 
              chat, 
              status: 'accepted' 
            };
          }
        } else {
          // Chat is active, proceed normally
          setCurrentChat(chat);
          await fetchMessages(chatRoomId);
          
          return { 
            success: true, 
            chat, 
            status: 'active' 
          };
        }
      } else {
        setChatStatus({
          type: 'error',
          message: 'Chat room not found'
        });
        
        setTimeout(() => setChatStatus(null), 5000);
        
        return { 
          success: false, 
          error: 'Chat not found' 
        };
      }
    } catch (error) {
      console.error('Error opening chat:', error);
      
      setChatStatus({
        type: 'error',
        message: 'Failed to open chat: ' + error.message
      });
      
      setTimeout(() => setChatStatus(null), 5000);
      
      return { 
        success: false, 
        error: error.message 
      };
    } finally {
      setLoading(false);
    }
  }, [activeChats, fetchActiveChats, fetchMessages, acceptChatRequest]);

  // Close the current chat
  const closeChat = () => {
    setCurrentChat(null);
    setMessages([]);
  };
  
  // Handle notification click
  const handleNotificationClick = useCallback(async (notification) => {
    if (!notification) return;
    
    try {
      // Mark notification as read
      await api.post('/chat/markNotificationRead', { notificationId: notification.id });
      
      // If it's a chat request, open the chat (which will handle acceptance if needed)
      if (notification.type === 'chat_request' || notification.type === 'chat_accepted' || notification.type === 'new_message') {
        await openChat(notification.chat_room_id);
      }
      
      // Refresh notifications to remove the read one
      await fetchNotifications(true);
    } catch (error) {
      console.error('Error handling notification click:', error);
      setChatStatus({
        type: 'error',
        message: 'Failed to process notification: ' + error.message
      });
      
      setTimeout(() => setChatStatus(null), 5000);
    }
  }, [openChat, fetchNotifications]);

  // Check for pending chat requests on mount
  useEffect(() => {
    if (user) {
      // Initial load
      fetchNotifications(true);
      fetchActiveChats(true);
      
      // Check for pending chat requests
      const pendingChatId = localStorage.getItem('pendingChatRequest');
      if (pendingChatId) {
        fetchActiveChats(true).then(chats => {
          const pendingChat = chats.find(c => c.id === pendingChatId);
          if (pendingChat && pendingChat.isActive) {
            openChat(pendingChatId);
            localStorage.removeItem('pendingChatRequest');
          }
        });
      }
      
      // Set up polling interval
      const intervalId = setInterval(() => {
        fetchNotifications();
        
        if (currentChat) {
          fetchMessages(currentChat.id);
        } else {
          fetchActiveChats();
        }
      }, 10000);
      
      return () => clearInterval(intervalId);
    }
  }, [user, currentChat, fetchNotifications, fetchActiveChats, fetchMessages, openChat]);
  
  return (
    <ChatContext.Provider
      value={{
        activeChats,
        notifications,
        currentChat,
        messages,
        loading,
        error,
        chatStatus,
        sendChatRequest,
        acceptChatRequest,
        declineChatRequest,
        sendMessage,
        fetchMessages,
        openChat,
        closeChat,
        fetchActiveChats,
        fetchNotifications,
        handleNotificationClick
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export default ChatProvider;