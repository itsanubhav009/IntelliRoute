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
  
  // Add these to track last request times
  const lastRequest = useRef({
    chat: 0,
    notifications: 0
  });
  
  // Add this to prevent concurrent requests
  const pendingRequests = useRef({
    chat: false,
    notifications: false
  });

  // Throttled fetch notifications
  const fetchNotifications = useCallback(async (force = false) => {
    if (!user) return [];
    
    // Don't allow concurrent requests
    if (pendingRequests.current.notifications) {
      console.log('Notification request already in progress, skipping');
      return notifications;
    }
    
    const now = Date.now();
    // Only fetch if it's been more than 10 seconds since last check or forced
    if (!force && now - lastRequest.current.notifications < 10000) {
      return notifications; // Return cached notifications
    }
    
    try {
      pendingRequests.current.notifications = true;
      console.log('Fetching notifications...');
      const response = await api.get('/chat/notifications');
      lastRequest.current.notifications = now;
      
      // Only update state if the notifications have changed
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
    
    // Don't allow concurrent requests
    if (pendingRequests.current.chat) {
      console.log('Chat request already in progress, skipping');
      return activeChats;
    }
    
    const now = Date.now();
    // Only fetch if it's been more than 10 seconds since last check or forced
    if (!force && now - lastRequest.current.chat < 10000) {
      return activeChats; // Return cached chats
    }
    
    try {
      pendingRequests.current.chat = true;
      setLoading(true);
      console.log('Fetching active chats...');
      const response = await api.get('/chat/active');
      lastRequest.current.chat = now;
      
      const newChats = response.data.chats || [];
      
      // Only update state if the chats have changed
      if (JSON.stringify(newChats) !== JSON.stringify(activeChats)) {
        console.log('Updating active chats, found changes');
        setActiveChats(newChats);
      } else {
        console.log('No changes in active chats');
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
      console.log('Sending chat request to:', recipientId);
      const response = await api.post('/chat/request', { recipientId });
      
      // Force refresh active chats
      await fetchActiveChats(true);
      
      // Store the chat request ID for monitoring
      localStorage.setItem('pendingChatRequest', response.data.chatRoomId);
      
      return response.data;
    } catch (error) {
      console.error('Error sending chat request:', error);
      setError('Failed to send chat request: ' + (error.response?.data?.message || error.message));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Accept a chat request
  const acceptChatRequest = async (chatRoomId) => {
    if (!user || !chatRoomId) return;
    
    try {
      setLoading(true);
      console.log('Accepting chat request:', chatRoomId);
      
      const response = await api.post('/chat/accept', { chatRoomId });
      console.log('Accept response:', response.data);
      
      // Force refresh notifications and active chats
      await fetchNotifications(true);
      const updatedChats = await fetchActiveChats(true);
      
      console.log('Looking for chat room in active chats');
      const acceptedChat = updatedChats.find(c => c.id === chatRoomId);
      
      if (acceptedChat) {
        console.log('Found accepted chat, opening it:', acceptedChat);
        setCurrentChat(acceptedChat);
        
        // Fetch messages for this chat
        await fetchMessages(chatRoomId);
      } else {
        console.error('Accepted chat not found in active chats. Will retry...');
        // Retry once after a delay
        setTimeout(async () => {
          const retryChats = await fetchActiveChats(true);
          const retryChat = retryChats.find(c => c.id === chatRoomId);
          if (retryChat) {
            console.log('Found chat on retry');
            setCurrentChat(retryChat);
            await fetchMessages(chatRoomId);
          }
        }, 2000);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error accepting chat request:', error);
      setError('Failed to accept chat request: ' + (error.message || 'Unknown error'));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Decline a chat request
  const declineChatRequest = async (chatRoomId) => {
    if (!user || !chatRoomId) return;
    
    try {
      setLoading(true);
      const response = await api.post('/chat/decline', { chatRoomId });
      
      // Force refresh notifications
      await fetchNotifications(true);
      
      return response.data;
    } catch (error) {
      console.error('Error declining chat request:', error);
      setError('Failed to decline chat request');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Send a message in a chat
  const sendMessage = async (chatRoomId, message) => {
    if (!user || !chatRoomId || !message) return;
    
    try {
      console.log('Sending message to room:', chatRoomId);
      const response = await api.post('/chat/send', { chatRoomId, message });
      
      // Add the new message to the state
      const newMessage = response.data.chatMessage;
      setMessages(prev => [
        ...prev, 
        {...newMessage, profiles: { username: user.username }}
      ]);
      
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message: ' + error.message);
      throw error;
    }
  };

  // Fetch messages for a chat
  const fetchMessages = async (chatRoomId) => {
    if (!user || !chatRoomId) return;
    
    try {
      setLoading(true);
      console.log('Fetching messages for room:', chatRoomId);
      const response = await api.get(`/chat/messages/${chatRoomId}`);
      
      setMessages(response.data.messages || []);
      return response.data.messages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to fetch messages: ' + error.message);
      setMessages([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Open a chat
  const openChat = async (chatRoomId) => {
    try {
      console.log('Opening chat:', chatRoomId);
      
      // First check if this chat is in our current active chats
      let chat = activeChats.find(c => c.id === chatRoomId);
      
      // If not found, try fetching fresh data
      if (!chat) {
        console.log('Chat not found in current state, fetching fresh data');
        const updatedChats = await fetchActiveChats(true);
        chat = updatedChats.find(c => c.id === chatRoomId);
      }
      
      if (chat) {
        console.log('Setting current chat:', chat);
        setCurrentChat(chat);
        await fetchMessages(chatRoomId);
      } else {
        console.error('Chat not found in active chats');
        setError('Chat not found');
      }
    } catch (error) {
      console.error('Error opening chat:', error);
      setError('Failed to open chat: ' + error.message);
    }
  };

  // Close the current chat
  const closeChat = () => {
    setCurrentChat(null);
    setMessages([]);
  };
  
  // Set up polling at a reasonable rate (once per 10 seconds)
  useEffect(() => {
    if (user) {
      // Initial load
      fetchNotifications(true);
      fetchActiveChats(true);
      
      // Check for any pending chat requests
      const pendingChatId = localStorage.getItem('pendingChatRequest');
      if (pendingChatId) {
        console.log('Found pending chat request, checking status:', pendingChatId);
        fetchActiveChats(true).then(chats => {
          const pendingChat = chats.find(c => c.id === pendingChatId);
          if (pendingChat && pendingChat.hasJoined) {
            console.log('Pending chat has been accepted, opening');
            openChat(pendingChatId);
            localStorage.removeItem('pendingChatRequest');
          }
        });
      }
      
      // Set up polling interval - MUCH less frequent to prevent flooding
      const intervalId = setInterval(() => {
        // Poll for notifications and active chats
        fetchNotifications();
        
        // If we have a current chat open, fetch its messages too
        if (currentChat) {
          fetchMessages(currentChat.id);
        } else {
          // Only poll for active chats if we don't have an open chat
          fetchActiveChats();
        }
      }, 10000); // Poll every 10 seconds instead of flooding
      
      return () => clearInterval(intervalId);
    }
  }, [user, currentChat, fetchNotifications, fetchActiveChats]);
  
  return (
    <ChatContext.Provider
      value={{
        activeChats,
        notifications,
        currentChat,
        messages,
        loading,
        error,
        sendChatRequest,
        acceptChatRequest,
        declineChatRequest,
        sendMessage,
        fetchMessages,
        openChat,
        closeChat,
        fetchActiveChats,
        fetchNotifications
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};