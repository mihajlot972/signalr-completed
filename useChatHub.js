import { useEffect, useState, useCallback, useRef } from 'react';
import * as signalR from '@microsoft/signalr';

const useChatHub = (userName, chatRoom) => {
  const [connection, setConnection] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [roomCreated, setRoomCreated] = useState(false);
  const [error, setError] = useState(null);
  const connectionRef = useRef(null);
  
  const API_BASE_URL = 'https://asqsam-chat.qryde.net';

  // Create room before connecting
  const createRoomFirst = useCallback(async (roomName) => {
    try {
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/api/Rooms`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "include", // Include cookies if needed
        body: JSON.stringify({ name: roomName }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Room creation response not OK (${response.status}):`, errorText);
        
        // If room already exists, we can consider it created
        if (response.status === 400 && errorText.includes('already exists')) {
          console.log(`Room "${roomName}" already exists, proceeding anyway`);
          setRoomCreated(true);
          return true;
        }
        
        throw new Error(`Room creation failed: ${response.status} ${errorText}`);
      }
      
      console.log(`Room "${roomName}" created successfully`);
      setRoomCreated(true);
      return true;
    } catch (error) {
      console.error('Error creating room:', error);
      setError(`Room creation error: ${error.message}`);
      // We'll still try to continue with the connection
      return false;
    }
  }, [API_BASE_URL]);

  // Initialize connection
  useEffect(() => {
    if (!userName || !chatRoom) return;
    
    let mounted = true;
    console.log(`Initializing chat hub for user "${userName}" in room "${chatRoom}"`);
    
    const initializeConnection = async () => {
      try {
        // Create room first
        await createRoomFirst(chatRoom);
        
        if (!mounted) return;
        
        // Create SignalR connection with proper configuration
        const newConnection = new signalR.HubConnectionBuilder()
          .withUrl(`${API_BASE_URL}/chatHub`, {
            // Using withCredentials to allow cookies to be sent
            withCredentials: true,
            // Only use WebSockets if we're skipping negotiation
            skipNegotiation: true,
            transport: signalR.HttpTransportType.WebSockets
          })
          .withAutomaticReconnect([0, 2000, 5000, 10000, 15000, 30000]) // Progressive retry policy
          .configureLogging(signalR.LogLevel.Information)
          .build();

        // Store in ref for use in callbacks
        connectionRef.current = newConnection;
        
        // Set up event handlers
        setupEventHandlers(newConnection);
        
        console.log('Starting SignalR connection...');
        await startConnection(newConnection);
        
      } catch (error) {
        if (mounted) {
          console.error('Connection initialization error:', error);
          setError(`Connection error: ${error.message}`);
          setConnectionState('failed');
        }
      }
    };

    const setupEventHandlers = (connection) => {
      // Clear any previous handlers by replacing the connection
      
      // Message handlers
      connection.on('newMessage', (messageData) => {
        console.log('Received message:', messageData);
        setMessages(prev => [...prev, {
          id: messageData.id,
          user: messageData.fromUserName,
          message: messageData.content,
          timestamp: messageData.timestamp,
          type: 'user'
        }]);
      });

      // System message handler
      connection.on('ReceiveMessage', (user, message) => {
        console.log(`Received system message from ${user}: ${message}`);
        setMessages(prev => [...prev, { user, message, type: 'system' }]);
      });

      // Online users handler
      connection.on('OnlineUsers', (users) => {
        console.log('Online users updated:', users);
        setOnlineUsers(users);
      });
      
      // Error handler
      connection.on('onError', (errorMessage) => {
        console.error('SignalR error:', errorMessage);
        setError(`SignalR error: ${errorMessage}`);
      });
      
      // User handlers
      connection.on('addUser', (user) => {
        console.log('User joined:', user);
        setOnlineUsers(prev => [...prev, user]);
      });
      
      connection.on('removeUser', (user) => {
        console.log('User left:', user);
        setOnlineUsers(prev => prev.filter(u => u.userName !== user.userName));
      });
    };

    const startConnection = async (connection) => {
      try {
        await connection.start();
        console.log('SignalR connection started successfully.');
        
        if (mounted) {
          setConnectionState('connected');
          setConnection(connection);
          setError(null);
        }

        // Join the chat room once connected
        try {
          await connection.invoke('Join', chatRoom);
          console.log(`Joined chat room: ${chatRoom} as ${userName}`);
          
          // Get online users
          refreshOnlineUsers(connection);
        } catch (err) {
          console.error('Error joining chat room:', err);
          setError(`Error joining room: ${err.message}`);
        }
      } catch (err) {
        console.error('Connection failed:', err);
        if (mounted) {
          setConnectionState('failed');
          setError(`Connection failed: ${err.message}`);
        }
        
        // No need to re-throw, we handle it here
        return false;
      }
      
      return true;
    };

    // Start the initialization
    initializeConnection();

    // Cleanup function
    return () => {
      mounted = false;
      if (connectionRef.current) {
        console.log('Disconnecting from chat...');
        try {
          // Try to leave gracefully
          connectionRef.current.invoke('Leave', chatRoom)
            .then(() => {
              console.log('Left chat room successfully.');
              return connectionRef.current.stop();
            })
            .catch(err => {
              console.warn('Error leaving chat, stopping anyway:', err);
              return connectionRef.current.stop();
            })
            .finally(() => {
              if (mounted) {
                setConnectionState('disconnected');
              }
            });
        } catch (err) {
          console.error('Error during cleanup:', err);
        }
      }
    };
  }, [userName, chatRoom, createRoomFirst, API_BASE_URL]);

  // Send message function
  const sendMessage = useCallback((message) => {
    if (!connectionRef.current || connectionState !== 'connected') {
      console.warn('Cannot send message: connection not active');
      return false;
    }
    
    if (!message || message.trim() === '') {
      console.warn('Cannot send empty message');
      return false;
    }
    
    try {
      console.log('Sending message:', message);
      connectionRef.current.invoke('SendMessage', chatRoom, message)
        .catch(err => {
          console.error('Error sending message:', err);
          setError(`Error sending message: ${err.message}`);
        });
      return true;
    } catch (err) {
      console.error('Exception sending message:', err);
      setError(`Exception sending message: ${err.message}`);
      return false;
    }
  }, [connectionState, chatRoom]);

  // Get online users function
  const refreshOnlineUsers = useCallback((conn = null) => {
    const activeConn = conn || connectionRef.current;
    if (activeConn && (conn || connectionState === 'connected')) {
      console.log('Refreshing online users list...');
      activeConn.invoke('GetUsers', chatRoom)
        .then(users => {
          console.log('Received online users:', users);
          setOnlineUsers(users || []);
        })
        .catch(err => {
          console.error('Error getting online users:', err);
          setError(`Error refreshing users: ${err.message}`);
        });
    } else {
      console.warn('Cannot refresh users: connection not active');
    }
  }, [connectionState, chatRoom]);

  return {
    connection,
    connectionState,
    messages,
    onlineUsers,
    sendMessage,
    refreshOnlineUsers,
    createRoomFirst,
    roomCreated,
    error,
  };
};

export default useChatHub;