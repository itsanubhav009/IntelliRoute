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
router.post('/request', async (req, res) => {
  try {
    // Shorter delay for better UX
    
    const { recipientId } = req.body;
    const senderId = req.user.id;
    
    console.log(`[2025-04-06 09:14:36] User ${req.user.username || 'itsanubhav009'} requested chat with user ${recipientId}`);
    
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
    
    // STEP 3: Create a new chat room (original code continues here)
    const { data: chatRoom, error: chatRoomError } = await databaseClient
      .from('chat_rooms')
      .insert([{ is_active: true }])
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
router.post('/accept', async (req, res) => {
  try {
   
    
    const { chatRoomId } = req.body;
    const userId = req.user.id;
    
    if (!chatRoomId) {
      return res.status(400).json({ message: 'Chat room ID is required' });
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
    
    // Update participant to 'joined'
    const { error: updateError } = await databaseClient
      .from('chat_participants')
      .update({ has_joined: true })
      .eq('chat_room_id', chatRoomId)
      .eq('user_id', userId);
      
    if (updateError) {
      console.error('Error accepting chat request:', updateError);
      return res.status(500).json({ message: 'Failed to accept chat request' });
    }
    
    // Mark notification as read
    await databaseClient
      .from('chat_notifications')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('chat_room_id', chatRoomId)
      .eq('type', 'chat_request');
    
    // Get the other participant
    const { data: participants } = await databaseClient
      .from('chat_participants')
      .select('user_id')
      .eq('chat_room_id', chatRoomId)
      .neq('user_id', userId);
    
    if (participants && participants.length > 0) {
      // Notify the other user that the chat was accepted
      const otherUserId = participants[0].user_id;
      
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
    
    return res.status(200).json({
      message: 'Chat request accepted',
      chatRoomId
    });
  } catch (error) {
    console.error('Error accepting chat request:', error);
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
router.post('/send', async (req, res) => {
  try {
    const { chatRoomId, message } = req.body;
    const userId = req.user.id;
    
    if (!chatRoomId || !message) {
      return res.status(400).json({ message: 'Chat room ID and message are required' });
    }
    
    // Verify the user is a participant and has joined this chat
    const { data: participant, error: participantError } = await databaseClient
      .from('chat_participants')
      .select('id')
      .eq('chat_room_id', chatRoomId)
      .eq('user_id', userId)
      .eq('has_joined', true)
      .single();
      
    if (participantError || !participant) {
      return res.status(403).json({ message: 'You cannot send messages in this chat' });
    }
    
    // Save the message
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
      console.error('Error sending message:', messageError);
      return res.status(500).json({ message: 'Failed to send message' });
    }
    
    // Get the other participants to notify them
    const { data: participants } = await databaseClient
      .from('chat_participants')
      .select('user_id')
      .eq('chat_room_id', chatRoomId)
      .neq('user_id', userId);
    
    // Get current user's username
    const { data: currentUser } = await databaseClient
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    
    // Create notifications for all other participants
    if (participants && participants.length > 0) {
      const notifications = participants.map(p => ({
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
    
    return res.status(200).json({
      message: 'Message sent successfully',
      chatMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/chat/messages/:chatRoomId - Get messages for a chat room
router.get('/messages/:chatRoomId', async (req, res) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.user.id;
    
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