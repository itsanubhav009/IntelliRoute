const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Try to load Supabase
let databaseClient;
try {
  databaseClient = require('../config/supabase');
  if (!databaseClient || typeof databaseClient.from !== 'function') {
    throw new Error('Supabase client not properly initialized');
  }
  console.log('Using Supabase database client for chat');
} catch (error) {
  console.error('Supabase error in chat routes:', error.message);
  throw error; // Chat requires database, so we don't use fallback
}

// Authenticate all routes
router.use(protect);

// Helper function: Artificial delay to slow down requests as requested
const addDelay = (ms = 1000) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// POST /api/chat/request - Send a chat request to another user
// POST /api/chat/request - Send a chat request to another user
// POST /api/chat/request - Send a chat request to another user
router.post('/request', async (req, res) => {
  try {
    const { recipientId } = req.body;
    const senderId = req.user.id;
    
    console.log(`[${new Date().toISOString()}] User ${req.user.username || 'itsanubhav009'} requested chat with user ${recipientId}`);
    
    if (!recipientId) {
      return res.status(400).json({ message: 'Recipient ID is required' });
    }
    
    if (senderId === recipientId) {
      return res.status(400).json({ message: 'Cannot send chat request to yourself' });
    }
    
    console.log(`Chat request from ${senderId} to ${recipientId}`);
    
    // Check if recipient is online and exists
    const { data: recipient, error: recipientError } = await databaseClient
      .from('profiles')
      .select('id, username, status')
      .eq('id', recipientId)
      .eq('status', 'online')
      .single();
      
    if (recipientError || !recipient) {
      return res.status(404).json({ message: 'Recipient not found or not online' });
    }
    
    // STEP 1: Find existing chat rooms between these users
    console.log(`Checking for existing chat rooms between users ${senderId} and ${recipientId}`);
    
    // Find chat rooms where both users are participants
    const { data: senderParticipations, error: senderError } = await databaseClient
      .from('chat_participants')
      .select('chat_room_id')
      .eq('user_id', senderId);
      
    if (senderError) {
      console.error('Error finding sender participations:', senderError);
      return res.status(500).json({ message: 'Failed to check existing chats' });
    }
    
    // If sender has chat participations, check which ones also have the recipient
    let existingChatRoomIds = [];
    
    if (senderParticipations && senderParticipations.length > 0) {
      const chatRoomIds = senderParticipations.map(p => p.chat_room_id);
      
      const { data: commonChats, error: commonChatsError } = await databaseClient
        .from('chat_participants')
        .select('chat_room_id')
        .eq('user_id', recipientId)
        .in('chat_room_id', chatRoomIds);
      
      if (!commonChatsError && commonChats && commonChats.length > 0) {
        existingChatRoomIds = commonChats.map(c => c.chat_room_id);
        console.log(`Found ${existingChatRoomIds.length} existing chat rooms between users`);
      }
    }
    
    // STEP 2: Delete existing chat rooms between these users
    if (existingChatRoomIds.length > 0) {
      console.log(`Deleting ${existingChatRoomIds.length} existing chat rooms: ${existingChatRoomIds.join(', ')}`);
      
      // Delete notifications related to these chat rooms
      const { error: notificationDeleteError } = await databaseClient
        .from('chat_notifications')
        .delete()
        .in('chat_room_id', existingChatRoomIds);
        
      if (notificationDeleteError) {
        console.error('Error deleting existing notifications:', notificationDeleteError);
        // Continue anyway, this shouldn't block the main functionality
      }
      
      // Delete chat rooms (this should cascade to participants and messages if set up correctly)
      const { error: chatRoomDeleteError } = await databaseClient
        .from('chat_rooms')
        .delete()
        .in('id', existingChatRoomIds);
        
      if (chatRoomDeleteError) {
        console.error('Error deleting existing chat rooms:', chatRoomDeleteError);
        return res.status(500).json({ message: 'Failed to clean up existing chats' });
      }
      
      console.log(`Successfully deleted existing chat rooms between users ${senderId} and ${recipientId}`);
    }
    
    // STEP 3: Create a new chat room (with is_active: false initially)
    const { data: chatRoom, error: chatRoomError } = await databaseClient
      .from('chat_rooms')
      .insert([{ is_active: false }]) // Change: Set is_active to false initially
      .select()
      .single();
      
    if (chatRoomError) {
      console.error('Error creating chat room:', chatRoomError);
      return res.status(500).json({ message: 'Failed to create chat room' });
    }
    
    // Add both users as participants
    const { error: participantsError } = await databaseClient
      .from('chat_participants')
      .insert([
        { chat_room_id: chatRoom.id, user_id: senderId, has_joined: true },
        { chat_room_id: chatRoom.id, user_id: recipientId, has_joined: false }
      ]);
      
    if (participantsError) {
      console.error('Error adding chat participants:', participantsError);
      return res.status(500).json({ message: 'Failed to add participants to chat' });
    }
    
    // Create a notification for the recipient
    const { data: senderProfile } = await databaseClient
      .from('profiles')
      .select('username')
      .eq('id', senderId)
      .single();
    
    const { error: notificationError } = await databaseClient
      .from('chat_notifications')
      .insert([{
        recipient_id: recipientId,
        sender_id: senderId,
        chat_room_id: chatRoom.id,
        type: 'chat_request',
        message: `${senderProfile.username} wants to chat with you`
      }]);
    
    if (notificationError) {
      console.error('Error creating notification:', notificationError);
      // Continue anyway, as the core chat functionality works
    }
    
    return res.status(200).json({
      message: existingChatRoomIds.length > 0 
        ? 'Chat request sent successfully (previous chats cleared)' 
        : 'Chat request sent successfully',
      chatRoomId: chatRoom.id,
      previousChatsRemoved: existingChatRoomIds.length
    });
  } catch (error) {
    console.error('Error sending chat request:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// POST /api/chat/accept - Accept a chat request
// Replace the accept chat request endpoint in your chatRoutes.js

// POST /api/chat/accept - Accept a chat request
// Replace the accept chat request endpoint in your chatRoutes.js file

// POST /api/chat/accept - Accept a chat request
router.post('/accept', async (req, res) => {
  try {
    // Log for debugging
    console.log(`[${new Date().toISOString()}] Chat accept request from user ${req.user.username || req.user.id}`);
    
    const { chatRoomId } = req.body;
    const userId = req.user.id;
    
    if (!chatRoomId) {
      return res.status(400).json({ message: 'Chat room ID is required' });
    }
    
    // Step 1: Verify the chat room exists
    const { data: chatRoom, error: chatRoomError } = await databaseClient
      .from('chat_rooms')
      .select('id, is_active')
      .eq('id', chatRoomId)
      .single();
      
    if (chatRoomError || !chatRoom) {
      console.error('Chat room not found:', chatRoomError);
      return res.status(404).json({ message: 'Chat room not found' });
    }
    
    // Step 2: Check if user is a participant
    const { data: participant, error: participantError } = await databaseClient
      .from('chat_participants')
      .select('id, has_joined')
      .eq('chat_room_id', chatRoomId)
      .eq('user_id', userId)
      .single();
      
    if (participantError || !participant) {
      console.error('User not a participant in chat:', participantError);
      return res.status(403).json({ message: 'You are not a participant in this chat' });
    }
    
    // Step 3: Get all participants for this chat room to update their status
    const { data: allParticipants, error: allParticipantsError } = await databaseClient
      .from('chat_participants')
      .select('id, user_id, has_joined')
      .eq('chat_room_id', chatRoomId);
      
    if (allParticipantsError) {
      console.error('Error getting all participants:', allParticipantsError);
      return res.status(500).json({ message: 'Failed to get chat participants' });
    }
    
    // Step 4: Update ALL participants to has_joined = true
    // This is critical - both the original requester and the acceptor need to be marked as joined
    console.log(`Setting has_joined=true for all ${allParticipants.length} participants in chat ${chatRoomId}`);
    
    for (const participant of allParticipants) {
      const { error: updateError } = await databaseClient
        .from('chat_participants')
        .update({ has_joined: true })
        .eq('id', participant.id);
        
      if (updateError) {
        console.error(`Error updating participant ${participant.id}:`, updateError);
        // Continue anyway - try to update all participants
      }
    }
    
    // Step 5: Activate the chat room
    console.log(`Activating chat room ${chatRoomId}`);
    
    const { error: activateError } = await databaseClient
      .from('chat_rooms')
      .update({ is_active: true })
      .eq('id', chatRoomId);
      
    if (activateError) {
      console.error('Error activating chat room:', activateError);
      return res.status(500).json({ message: 'Failed to activate chat room' });
    }
    
    // Step 6: Mark notification as read
    await databaseClient
      .from('chat_notifications')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('chat_room_id', chatRoomId)
      .eq('type', 'chat_request');
    
    // Step 7: Get the other participant to notify them
    const otherParticipants = allParticipants.filter(p => p.user_id !== userId);
    
    if (otherParticipants.length > 0) {
      // Notify the other user that the chat was accepted
      const otherUserId = otherParticipants[0].user_id;
      
      // Get current user's username
      const { data: currentUser } = await databaseClient
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single();
      
      await databaseClient
        .from('chat_notifications')
        .insert([{
          recipient_id: otherUserId,
          sender_id: userId,
          chat_room_id: chatRoomId,
          type: 'chat_accepted',
          message: `${currentUser.username} accepted your chat request`
        }]);
    }
    
    console.log(`[${new Date().toISOString()}] Chat request ${chatRoomId} accepted successfully by user ${req.user.username || userId}`);
    
    return res.status(200).json({
      message: 'Chat request accepted',
      chatRoomId,
      is_active: true,
      all_participants_joined: true  // Add this flag so frontend knows all users can now chat
    });
  } catch (error) {
    console.error('Error accepting chat request:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Modify the GET /api/chat/active endpoint to include is_active status
router.get('/active', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get active chats where user is a participant
    const { data: chats, error: chatsError } = await databaseClient
      .from('chat_participants')
      .select(`
        id,
        has_joined,
        last_read,
        chat_rooms:chat_room_id (
          id,
          created_at,
          is_active
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { foreignTable: 'chat_rooms', ascending: false });
      
    if (chatsError) {
      console.error('Error getting active chats:', chatsError);
      return res.status(500).json({ message: 'Failed to get active chats' });
    }
    
    // Get the latest message and other participant for each chat
    const chatDetails = await Promise.all(chats.map(async (chat) => {
      // Get other participants for this chat
      const { data: otherParticipants } = await databaseClient
        .from('chat_participants')
        .select(`
          profiles:user_id (
            id,
            username,
            status
          )
        `)
        .eq('chat_room_id', chat.chat_rooms.id)
        .neq('user_id', userId);
      
      // Get latest message
      const { data: latestMessage } = await databaseClient
        .from('chat_messages')
        .select('id, message, created_at, user_id')
        .eq('chat_room_id', chat.chat_rooms.id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      // Get unread message count
      const { data: unreadCount, error: unreadError } = await databaseClient
        .from('chat_messages')
        .select('id', { count: 'exact' })
        .eq('chat_room_id', chat.chat_rooms.id)
        .neq('user_id', userId)
        .gt('created_at', chat.last_read);
      
      // Fix for optional chaining
      let formattedOtherParticipants = [];
      if (otherParticipants && otherParticipants.length > 0) {
        formattedOtherParticipants = otherParticipants.map(p => p.profiles);
      }
      
      let formattedLatestMessage = null;
      if (latestMessage && latestMessage.length > 0) {
        formattedLatestMessage = latestMessage[0];
      }
      
      return {
        id: chat.chat_rooms.id,
        hasJoined: chat.has_joined,
        isActive: chat.chat_rooms.is_active,
        otherParticipants: formattedOtherParticipants,
        latestMessage: formattedLatestMessage,
        unreadCount: unreadError ? 0 : unreadCount.length,
        created_at: chat.chat_rooms.created_at
      };
    }));
    
    return res.status(200).json({
      chats: chatDetails
    });
  } catch (error) {
    console.error('Error getting active chats:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Modify the POST /api/chat/send endpoint to check if the chat room is active
// POST /api/chat/send - Send a message in a chat
// POST /api/chat/send - Send a message in a chat
router.post('/send', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Message send attempt from user ${req.user.username || req.user.id}`);
    
    const { chatRoomId, message } = req.body;
    const userId = req.user.id;
    
    if (!chatRoomId || !message) {
      return res.status(400).json({ message: 'Chat room ID and message are required' });
    }
    
    // Step 1: Check if chat room exists and is active
    const { data: chatRoom, error: chatRoomError } = await databaseClient
      .from('chat_rooms')
      .select('id, is_active')
      .eq('id', chatRoomId)
      .single();
      
    if (chatRoomError || !chatRoom) {
      console.error(`Chat room ${chatRoomId} not found:`, chatRoomError);
      return res.status(404).json({ message: 'Chat room not found' });
    }
    
    if (!chatRoom.is_active) {
      console.error(`Chat room ${chatRoomId} is not active. Messages cannot be sent.`);
      return res.status(403).json({ 
        message: 'Chat room is not active. Both users must join the chat first.',
        error_code: 'CHAT_INACTIVE'
      });
    }
    
    // Step 2: Check if user has joined this chat
    const { data: participant, error: participantError } = await databaseClient
      .from('chat_participants')
      .select('id, has_joined')
      .eq('chat_room_id', chatRoomId)
      .eq('user_id', userId)
      .single();
      
    console.log('Participant check result:', participant);
    
    if (participantError) {
      console.error(`Error checking if user ${userId} is participant in chat ${chatRoomId}:`, participantError);
      return res.status(500).json({ message: 'Error verifying chat participation' });
    }
    
    if (!participant) {
      console.error(`User ${userId} is not a participant in chat ${chatRoomId}`);
      return res.status(403).json({ 
        message: 'You are not a participant in this chat',
        error_code: 'NOT_PARTICIPANT'
      });
    }
    
    if (!participant.has_joined) {
      console.error(`User ${userId} has not joined chat ${chatRoomId}`);
      return res.status(403).json({ 
        message: 'You must join this chat before sending messages',
        error_code: 'NOT_JOINED'
      });
    }
    
    // Step 3: Save the message
    console.log(`User ${userId} sending message to chat ${chatRoomId}`);
    const { data: chatMessage, error: messageError } = await databaseClient
      .from('chat_messages')
      .insert([{
        chat_room_id: chatRoomId,
        user_id: userId,
        message
      }])
      .select()
      .single();
      
    if (messageError) {
      console.error('Error saving message:', messageError);
      return res.status(500).json({ message: 'Failed to send message' });
    }
    
    // Step 4: Get the other participants to notify them
    const { data: otherParticipants } = await databaseClient
      .from('chat_participants')
      .select('user_id')
      .eq('chat_room_id', chatRoomId)
      .neq('user_id', userId);
    
    // Step 5: Get current user's username
    const { data: currentUser } = await databaseClient
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    
    // Step 6: Create notifications for all other participants
    if (otherParticipants && otherParticipants.length > 0) {
      const notifications = otherParticipants.map(p => ({
        recipient_id: p.user_id,
        sender_id: userId,
        chat_room_id: chatRoomId,
        type: 'new_message',
        message: `${currentUser.username}: ${message.substring(0, 30)}${message.length > 30 ? '...' : ''}`
      }));
      
      await databaseClient
        .from('chat_notifications')
        .insert(notifications);
    }
    
    console.log(`Message successfully sent by user ${userId} in chat ${chatRoomId}`);
    
    return res.status(200).json({
      message: 'Message sent successfully',
      chatMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Also modify the GET /api/chat/messages endpoint to check if the chat room is active
router.get('/messages/:chatRoomId', async (req, res) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.user.id;
    
    // Verify the chat room is active
    const { data: chatRoom, error: chatRoomError } = await databaseClient
      .from('chat_rooms')
      .select('is_active')
      .eq('id', chatRoomId)
      .single();
    
    if (chatRoomError || !chatRoom) {
      return res.status(404).json({ message: 'Chat room not found' });
    }
    
    if (!chatRoom.is_active) {
      return res.status(403).json({ 
        message: 'Chat room is not active. The recipient must accept the chat request first.',
        messages: []
      });
    }
    
    // Verify the user is a participant in this chat
    const { data: participant, error: participantError } = await databaseClient
      .from('chat_participants')
      .select('id')
      .eq('chat_room_id', chatRoomId)
      .eq('user_id', userId)
      .single();
      
    if (participantError || !participant) {
      return res.status(403).json({ message: 'You are not a participant in this chat' });
    }
    
    // Get messages
    const { data: messages, error: messagesError } = await databaseClient
      .from('chat_messages')
      .select(`
        id, 
        message, 
        created_at,
        user_id,
        profiles:user_id (username)
      `)
      .eq('chat_room_id', chatRoomId)
      .order('created_at', { ascending: true });
      
    if (messagesError) {
      console.error('Error getting messages:', messagesError);
      return res.status(500).json({ message: 'Failed to get messages' });
    }
    
    // Update last_read time for this user
    await databaseClient
      .from('chat_participants')
      .update({ last_read: new Date().toISOString() })
      .eq('chat_room_id', chatRoomId)
      .eq('user_id', userId);
    
    return res.status(200).json({
      messages: messages || []
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});
router.post('/markNotificationRead', async (req, res) => {
  try {
    const { notificationId } = req.body;
    const userId = req.user.id;
    
    if (!notificationId) {
      return res.status(400).json({ message: 'Notification ID is required' });
    }
    
    // Mark notification as read
    const { error } = await databaseClient
      .from('chat_notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('recipient_id', userId);
      
    if (error) {
      console.error('Error marking notification as read:', error);
      return res.status(500).json({ message: 'Failed to mark notification as read' });
    }
    
    return res.status(200).json({
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});
// POST /api/chat/decline - Decline a chat request
router.post('/decline', async (req, res) => {
  try {
    
    
    const { chatRoomId } = req.body;
    const userId = req.user.id;
    
    if (!chatRoomId) {
      return res.status(400).json({ message: 'Chat room ID is required' });
    }
    
    // Mark notification as read
    await databaseClient
      .from('chat_notifications')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('chat_room_id', chatRoomId)
      .eq('type', 'chat_request');
    
    // Delete the chat room (cascade will remove participants and messages)
    const { error: deleteError } = await databaseClient
      .from('chat_rooms')
      .delete()
      .eq('id', chatRoomId);
      
    if (deleteError) {
      console.error('Error declining chat request:', deleteError);
      return res.status(500).json({ message: 'Failed to decline chat request' });
    }
    
    return res.status(200).json({
      message: 'Chat request declined'
    });
  } catch (error) {
    console.error('Error declining chat request:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// POST /api/chat/send - Send a message in a chat


// GET /api/chat/messages/:chatRoomId - Get messages for a chat room


// GET /api/chat/active - Get active chats for the current user
router.get('/active', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get active chats where user is a participant
    const { data: chats, error: chatsError } = await databaseClient
      .from('chat_participants')
      .select(`
        id,
        has_joined,
        last_read,
        chat_rooms:chat_room_id (
          id,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { foreignTable: 'chat_rooms', ascending: false });
      
    if (chatsError) {
      console.error('Error getting active chats:', chatsError);
      return res.status(500).json({ message: 'Failed to get active chats' });
    }
    
    // Get the latest message and other participant for each chat
    const chatDetails = await Promise.all(chats.map(async (chat) => {
      // Get other participants for this chat
      const { data: otherParticipants } = await databaseClient
        .from('chat_participants')
        .select(`
          profiles:user_id (
            id,
            username,
            status
          )
        `)
        .eq('chat_room_id', chat.chat_rooms.id)
        .neq('user_id', userId);
      
      // Get latest message
      const { data: latestMessage } = await databaseClient
        .from('chat_messages')
        .select('id, message, created_at, user_id')
        .eq('chat_room_id', chat.chat_rooms.id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      // Get unread message count
      const { data: unreadCount, error: unreadError } = await databaseClient
        .from('chat_messages')
        .select('id', { count: 'exact' })
        .eq('chat_room_id', chat.chat_rooms.id)
        .neq('user_id', userId)
        .gt('created_at', chat.last_read);
      
      // Fix for optional chaining
      let formattedOtherParticipants = [];
      if (otherParticipants && otherParticipants.length > 0) {
        formattedOtherParticipants = otherParticipants.map(p => p.profiles);
      }
      
      let formattedLatestMessage = null;
      if (latestMessage && latestMessage.length > 0) {
        formattedLatestMessage = latestMessage[0];
      }
      
      return {
        id: chat.chat_rooms.id,
        hasJoined: chat.has_joined,
        otherParticipants: formattedOtherParticipants,
        latestMessage: formattedLatestMessage,
        unreadCount: unreadError ? 0 : unreadCount.length,
        created_at: chat.chat_rooms.created_at
      };
    }));
    
    return res.status(200).json({
      chats: chatDetails
    });
  } catch (error) {
    console.error('Error getting active chats:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/chat/notifications - Get notifications for the current user
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get unread notifications
    const { data: notifications, error: notificationsError } = await databaseClient
      .from('chat_notifications')
      .select(`
        id,
        type,
        message,
        is_read,
        created_at,
        sender:sender_id (
          id,
          username
        ),
        chat_room_id
      `)
      .eq('recipient_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });
      
    if (notificationsError) {
      console.error('Error getting notifications:', notificationsError);
      return res.status(500).json({ message: 'Failed to get notifications' });
    }
    
    return res.status(200).json({
      notifications: notifications || []
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

module.exports = router;