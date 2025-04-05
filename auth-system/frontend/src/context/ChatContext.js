import React, { createContext, useState, useEffect, useContext } from 'react';
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
  const [pollingInterval, setPollingInterval] = useState(null);

  // Start polling when user is authenticated
  useEffect(() => {
    if (user && !pollingInterval) {
      // Initial load
      fetchNotifications();
      fetchActiveChats();
      
      // Set up polling every 10 seconds
      const interval = setInterval(() => {
        fetchNotifications();
        if (currentChat) {
          fetchMessages(currentChat.id);
        }
      }, 10000);
      
      setPollingInterval(interval);
      
      return () => {
        clearInterval(interval);
        setPollingInterval(null);
      };
    }
  }, [user, currentChat]);


  // Add this to your useEffect in ChatContext.js where you set up polling

useEffect(() => {
  if (user && !pollingInterval) {
    // Initial load
    fetchNotifications();
    fetchActiveChats();
    
    // Set up polling every 10 seconds
    const interval = setInterval(() => {
      // Fetch notifications and check for chat_accepted types
      fetchNotifications().then(notifications => {
        if (notifications && notifications.length > 0) {
          // Look for any chat_accepted notifications to auto-open chat
          const acceptedChat = notifications.find(n => n.type === 'chat_accepted');
          if (acceptedChat) {
            console.log('Found chat_accepted notification, opening chat:', acceptedChat.chat_room_id);
            openChat(acceptedChat.chat_room_id);
            
            // Mark this notification as read since we've acted on it
            markNotificationRead(acceptedChat.id);
          }
        }
      });
      
      if (currentChat) {
        fetchMessages(currentChat.id);
      }
    }, 5000); // Reduced to 5 seconds for better responsiveness
    
    setPollingInterval(interval);
    
    return () => {
      clearInterval(interval);
      setPollingInterval(null);
    };
  }
}, [user, currentChat]);

// Add this new function to mark notifications as read
const markNotificationRead = async (notificationId) => {
  if (!user || !notificationId) return;
  
  try {
    await api.post('/chat/markNotificationRead', { notificationId });
    // Refresh notifications after marking one as read
    fetchNotifications();
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

  // Fetch active chats for the current user
  const fetchActiveChats = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const response = await api.get('/chat/active');
      setActiveChats(response.data.chats || []);
      return response.data.chats;
    } catch (error) {
      console.error('Error fetching active chats:', error);
      setError('Failed to fetch active chats');
    } finally {
      setLoading(false);
    }
  };

  // Fetch chat notifications
  const fetchNotifications = async () => {
    if (!user) return;
    
    try {
      const response = await api.get('/chat/notifications');
      setNotifications(response.data.notifications || []);
      return response.data.notifications;
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Send a chat request to another user
  // Replace your existing sendChatRequest function

const sendChatRequest = async (recipientId) => {
  if (!user || !recipientId) return;
  
  try {
    setLoading(true);
    console.log('Sending chat request to:', recipientId);
    const response = await api.post('/chat/request', { recipientId });
    
    // Get the chat room ID from the response
    const { chatRoomId } = response.data;
    
    // Add this chat to our active chats list
    await fetchActiveChats();
    
    // Set up chat monitoring for this room
    monitorChatRoom(chatRoomId);
    
    console.log('Chat request sent, chat room created:', chatRoomId);
    return response.data;
  } catch (error) {
    console.error('Error sending chat request:', error);
    setError('Failed to send chat request: ' + (error.response?.data?.message || error.message));
    throw error;
  } finally {
    setLoading(false);
  }
};

// Add this new function to monitor a chat room for activity
const monitorChatRoom = (chatRoomId) => {
  console.log('Starting to monitor chat room:', chatRoomId);
  
  // Store the chat room ID in session storage to remember it across refreshes
  try {
    const pendingChats = JSON.parse(sessionStorage.getItem('pendingChats') || '[]');
    if (!pendingChats.includes(chatRoomId)) {
      pendingChats.push(chatRoomId);
      sessionStorage.setItem('pendingChats', JSON.stringify(pendingChats));
    }
  } catch (error) {
    console.error('Error storing pending chat in session storage:', error);
  }
};

// Add this effect to check for pending chats on component mount
useEffect(() => {
  if (user) {
    try {
      // Check for any pending chats that we might need to check on
      const pendingChats = JSON.parse(sessionStorage.getItem('pendingChats') || '[]');
      
      if (pendingChats.length > 0) {
        console.log('Found pending chats to check:', pendingChats);
        
        // For each pending chat, check if it's now active
        fetchActiveChats().then(chats => {
          const activeChatIds = chats.map(chat => chat.id);
          
          // Find chats that were pending but are now active (meaning they were accepted)
          const acceptedChats = pendingChats.filter(id => activeChatIds.includes(id));
          
          if (acceptedChats.length > 0) {
            console.log('Found accepted chats:', acceptedChats);
            
            // Open the first accepted chat
            openChat(acceptedChats[0]);
            
            // Remove these from pending
            const updatedPendingChats = pendingChats.filter(id => !acceptedChats.includes(id));
            sessionStorage.setItem('pendingChats', JSON.stringify(updatedPendingChats));
          }
        });
      }
    } catch (error) {
      console.error('Error checking pending chats:', error);
    }
  }
}, [user]);

  // Accept a chat request
 // Replace the existing acceptChatRequest function in ChatContext.js

const acceptChatRequest = async (chatRoomId) => {
  if (!user || !chatRoomId) return;
  
  try {
    console.log('Starting accept request process for chat room:', chatRoomId);
    setLoading(true);
    
    const response = await api.post('/chat/accept', { chatRoomId });
    console.log('Chat acceptance API response:', response.data);
    
    // Update the notification list
    await fetchNotifications();
    
    // Update active chats
    const updatedChats = await fetchActiveChats();
    
    // Find the accepted chat in the updated active chats
    const acceptedChat = updatedChats.find(chat => chat.id === chatRoomId);
    
    if (acceptedChat) {
      console.log('Found accepted chat in active chats:', acceptedChat);
      // Set this as the current chat
      setCurrentChat(acceptedChat);
      
      // Fetch messages for this chat
      await fetchMessages(chatRoomId);
    } else {
      console.warn('Accepted chat not found in active chats list');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error accepting chat request:', error);
    setError('Failed to accept chat request');
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
      
      // Update the notification list
      await fetchNotifications();
      
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
      const response = await api.post('/chat/send', { chatRoomId, message });
      
      // Add the new message to the state
      const newMessage = response.data.chatMessage;
      setMessages(prev => [...prev, {...newMessage, profiles: { username: user.username }}]);
      
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
      throw error;
    }
  };

  // Fetch messages for a chat
  const fetchMessages = async (chatRoomId) => {
    if (!user || !chatRoomId) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/chat/messages/${chatRoomId}`);
      setMessages(response.data.messages || []);
      return response.data.messages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to fetch messages');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Open a chat
  // Replace the existing openChat function

const openChat = async (chatRoomId) => {
  try {
    console.log('Opening chat room:', chatRoomId);
    
    // Check if it's already in active chats
    let chat = activeChats.find(c => c.id === chatRoomId);
    
    if (!chat) {
      // If not found in current state, try to fetch fresh data
      console.log('Chat not found in current state, fetching fresh data');
      const updatedChats = await fetchActiveChats();
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
    setError('Failed to open chat');
  }
};

  // Close the current chat
  const closeChat = () => {
    setCurrentChat(null);
    setMessages([]);
  };

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