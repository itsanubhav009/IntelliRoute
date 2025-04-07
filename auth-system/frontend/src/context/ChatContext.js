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
  
<<<<<<< HEAD
  // Track last API call times and pending status
  const lastApiCall = useRef({
    notifications: 0,
    chats: 0,
    messages: 0
  });
  
  // Track if requests are in progress to prevent duplicates
  const pendingRequests = useRef({
    notifications: false,
    chats: false,
    messages: false
  });

  // Helper to enforce minimum delay between API calls
  const enforceApiDelay = async (key, minDelay = 5000) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCall.current[key];
    
    // If a request is already pending, don't make another one
    if (pendingRequests.current[key]) {
      console.log(`API call to ${key} already in progress, skipping`);
      return false;
    }
    
    // If we've made a call too recently, wait until we can make another
    if (timeSinceLastCall < minDelay) {
      const waitTime = minDelay - timeSinceLastCall;
      console.log(`Throttling ${key} API call - waiting ${waitTime}ms`);
      
      return new Promise(resolve => {
        setTimeout(() => {
          lastApiCall.current[key] = Date.now();
          pendingRequests.current[key] = true;
          resolve(true);
        }, waitTime);
      });
    }
    
    // Otherwise, proceed with the API call
    lastApiCall.current[key] = now;
    pendingRequests.current[key] = true;
    return true;
  };

  // Delayed fetch notifications
  const fetchNotifications = useCallback(async (force = false) => {
    if (!user) return [];
    
    // If forced, bypass delay check
    if (!force && !(await enforceApiDelay('notifications'))) {
      return notifications; // Return cached data
    }
    
    try {
      console.log(`[${new Date().toISOString()}] Fetching notifications for ${user.username || 'user'}...`);
      const response = await api.get('/chat/notifications');
      
      // Only update state if the notifications have changed
      if (JSON.stringify(response.data.notifications) !== JSON.stringify(notifications)) {
        setNotifications(response.data.notifications || []);
      }
      
      return response.data.notifications || [];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    } finally {
      // Mark request as completed
      pendingRequests.current.notifications = false;
    }
  }, [user, notifications]);

  // Delayed fetch active chats
  const fetchActiveChats = useCallback(async (force = false) => {
    if (!user) return [];
    
    // If forced, bypass delay check
    if (!force && !(await enforceApiDelay('chats'))) {
      return activeChats; // Return cached data
=======
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
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
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
<<<<<<< HEAD
      console.log(`[${new Date().toISOString()}] Fetching active chats for ${user.username || 'user'}...`);
      const response = await api.get('/chat/active');
      
      // Only update state if the chats have changed
      if (JSON.stringify(response.data.chats) !== JSON.stringify(activeChats)) {
        setActiveChats(response.data.chats || []);
      }
      
      return response.data.chats || [];
=======
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
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
    } catch (error) {
      console.error('Error fetching active chats:', error);
      setError('Failed to fetch active chats');
      return [];
    } finally {
      setLoading(false);
<<<<<<< HEAD
      pendingRequests.current.chats = false;
=======
      pendingRequests.current.chat = false;
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
    }
  }, [user, activeChats]);

  // Send a chat request to another user
  const sendChatRequest = async (recipientId) => {
    if (!user || !recipientId) return;
    
    try {
      setLoading(true);
<<<<<<< HEAD
      console.log(`[${new Date().toISOString()}] Sending chat request to: ${recipientId}...`);
      
      // Add artificial delay of 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await api.post('/chat/request', { recipientId });
      
      // Force refresh active chats (bypass throttling)
=======
      console.log('Sending chat request to:', recipientId);
      const response = await api.post('/chat/request', { recipientId });
      
      // Force refresh active chats
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
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

<<<<<<< HEAD
  // Accept a chat request with improved error handling
=======
  // Accept a chat request
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
  const acceptChatRequest = async (chatRoomId) => {
    if (!user || !chatRoomId) return;
    
    try {
      setLoading(true);
<<<<<<< HEAD
      console.log(`[${new Date().toISOString()}] Accepting chat request: ${chatRoomId}...`);
      
      // Add artificial delay of 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
=======
      console.log('Accepting chat request:', chatRoomId);
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
      
      const response = await api.post('/chat/accept', { chatRoomId });
      console.log('Accept response:', response.data);
      
<<<<<<< HEAD
      // Force refresh notifications and active chats (bypass throttling)
=======
      // Force refresh notifications and active chats
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
      await fetchNotifications(true);
      const updatedChats = await fetchActiveChats(true);
      
      console.log('Looking for chat room in active chats');
      const acceptedChat = updatedChats.find(c => c.id === chatRoomId);
      
      if (acceptedChat) {
<<<<<<< HEAD
        console.log('Found accepted chat:', acceptedChat);
        setCurrentChat(acceptedChat);
        
        // Fetch messages for this chat (bypass throttling)
        await fetchMessages(chatRoomId, true);
      } else {
        console.error('Accepted chat not found in active chats. Will retry...');
        // Retry after a delay
=======
        console.log('Found accepted chat, opening it:', acceptedChat);
        setCurrentChat(acceptedChat);
        
        // Fetch messages for this chat
        await fetchMessages(chatRoomId);
      } else {
        console.error('Accepted chat not found in active chats. Will retry...');
        // Retry once after a delay
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
        setTimeout(async () => {
          const retryChats = await fetchActiveChats(true);
          const retryChat = retryChats.find(c => c.id === chatRoomId);
          if (retryChat) {
            console.log('Found chat on retry');
            setCurrentChat(retryChat);
<<<<<<< HEAD
            await fetchMessages(chatRoomId, true);
=======
            await fetchMessages(chatRoomId);
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
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

<<<<<<< HEAD
  // Decline a chat request 
=======
  // Decline a chat request
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
  const declineChatRequest = async (chatRoomId) => {
    if (!user || !chatRoomId) return;
    
    try {
      setLoading(true);
      console.log(`[${new Date().toISOString()}] Declining chat request: ${chatRoomId}...`);
      
      // Add artificial delay of 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await api.post('/chat/decline', { chatRoomId });
      
<<<<<<< HEAD
      // Force refresh notifications (bypass throttling)
=======
      // Force refresh notifications
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
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

  // Send a message in a chat with enhanced error handling
  const sendMessage = async (chatRoomId, message) => {
    if (!user || !chatRoomId || !message) return;
    
    try {
<<<<<<< HEAD
      console.log(`[${new Date().toISOString()}] Sending message to room: ${chatRoomId}...`);
      
      // No delay for sending messages to maintain responsiveness
      
=======
      console.log('Sending message to room:', chatRoomId);
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
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

  // Fetch messages for a chat with better error handling and throttling
  const fetchMessages = async (chatRoomId, force = false) => {
    if (!user || !chatRoomId) return;
    
    // If we already have an active chat and it's not forced, enforce delay
    if (currentChat && !force && !(await enforceApiDelay('messages'))) {
      return messages; // Return cached messages
    }
    
    try {
      setLoading(true);
<<<<<<< HEAD
      console.log(`[${new Date().toISOString()}] Fetching messages for room: ${chatRoomId}...`);
      const response = await api.get(`/chat/messages/${chatRoomId}`);
      
      if (response.data && Array.isArray(response.data.messages)) {
        console.log(`Fetched ${response.data.messages.length} messages`);
        setMessages(response.data.messages || []);
        return response.data.messages;
      } else {
        console.error('Invalid messages response:', response.data);
        setMessages([]);
        return [];
      }
=======
      console.log('Fetching messages for room:', chatRoomId);
      const response = await api.get(`/chat/messages/${chatRoomId}`);
      
      setMessages(response.data.messages || []);
      return response.data.messages;
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to fetch messages: ' + error.message);
      setMessages([]);
      return [];
    } finally {
      setLoading(false);
      pendingRequests.current.messages = false;
    }
  };

<<<<<<< HEAD
  // Open a chat with improved robustness
  const openChat = async (chatRoomId) => {
    try {
      console.log(`[${new Date().toISOString()}] Opening chat: ${chatRoomId}...`);
=======
  // Open a chat
  const openChat = async (chatRoomId) => {
    try {
      console.log('Opening chat:', chatRoomId);
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
      
      // First check if this chat is in our current active chats
      let chat = activeChats.find(c => c.id === chatRoomId);
      
<<<<<<< HEAD
      // If not found, try fetching fresh data (bypass throttling)
=======
      // If not found, try fetching fresh data
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
      if (!chat) {
        console.log('Chat not found in current state, fetching fresh data');
        const updatedChats = await fetchActiveChats(true);
        chat = updatedChats.find(c => c.id === chatRoomId);
      }
      
      if (chat) {
        console.log('Setting current chat:', chat);
        setCurrentChat(chat);
<<<<<<< HEAD
        await fetchMessages(chatRoomId, true); // Bypass throttling for initial open
      } else {
        console.error('Chat not found in active chats');
        setError('Chat not found - it may have been deleted or you no longer have access');
=======
        await fetchMessages(chatRoomId);
      } else {
        console.error('Chat not found in active chats');
        setError('Chat not found');
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
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
  
<<<<<<< HEAD
  // Setup efficient polling with longer intervals
  useEffect(() => {
    if (user) {
      console.log(`[${new Date().toISOString()}] Setting up chat polling for ${user.username || 'itsanubhav009'}...`);
      
      // Initial load - force fetch
      fetchNotifications(true);
      fetchActiveChats(true);
      
      // Check for any pending chat requests we sent
=======
  // Set up polling at a reasonable rate (once per 10 seconds)
  useEffect(() => {
    if (user) {
      // Initial load
      fetchNotifications(true);
      fetchActiveChats(true);
      
      // Check for any pending chat requests
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
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
      
<<<<<<< HEAD
      // Set up polling with increased intervals (15 seconds for regular polling)
      const notificationInterval = 15000; // Check notifications every 15 seconds
      const chatInterval = 20000;         // Check chats every 20 seconds
      const messageInterval = currentChat ? 10000 : 30000; // Check messages more frequently if chat is open
      
      // Separate timers for each type of poll to allow independent timing
      const notificationTimer = setInterval(() => {
        fetchNotifications();
      }, notificationInterval);
      
      const chatTimer = setInterval(() => {
        fetchActiveChats();
      }, chatInterval);
      
      const messageTimer = setInterval(() => {
        if (currentChat) {
          fetchMessages(currentChat.id);
        }
      }, messageInterval);
      
      return () => {
        clearInterval(notificationTimer);
        clearInterval(chatTimer);
        clearInterval(messageTimer);
      };
    }
  }, [user, currentChat]);

=======
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
  
>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
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

export default ChatProvider;