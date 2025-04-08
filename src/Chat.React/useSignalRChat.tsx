import { useState, useEffect, useRef, useCallback } from "react";
import * as signalR from "@microsoft/signalr";

// Types based on the C# models
export interface Message {
  id: number;
  content: string;
  timestamp: string;
  fromUserName: string;
  fromFullName: string;
  room: string;
  avatar: string;
}

export interface User {
  userName: string;
  fullName: string;
  avatar: string;
  currentRoom: string;
  device: string;
}

export interface Room {
  id: number;
  name: string;
  admin: string;
}

export interface ChatHubMethods {
  // Connection methods
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;

  // Room methods
  joinRoom: (roomName: string) => Promise<void>;
  leaveRoom: (roomName: string) => Promise<void>;
  getUsersInRoom: (roomName: string) => Promise<User[]>;

  // Message methods
  sendPrivateMessage: (receiverName: string, message: string) => Promise<void>;
  sendRoomMessage: (roomName: string, message: string) => Promise<void>;

  // Room API methods
  getRooms: () => Promise<Room[]>;
  createRoom: (roomName: string) => Promise<void>;
  updateRoom: (roomId: number, roomName: string) => Promise<void>;
  deleteRoom: (roomId: number) => Promise<void>;

  // Message API methods
  getMessageHistory: (roomName: string) => Promise<Message[]>;
  deleteMessage: (messageId: number) => Promise<void>;
}

export interface ChatHubEvents {
  onNewMessage: (handler: (message: Message) => void) => void;
  onAddUser: (handler: (user: User) => void) => void;
  onRemoveUser: (handler: (user: User) => void) => void;
  onProfileInfo: (handler: (user: User) => void) => void;
  onAddChatRoom: (handler: (room: Room) => void) => void;
  onUpdateChatRoom: (handler: (room: Room) => void) => void;
  onRemoveChatRoom: (handler: (roomId: number) => void) => void;
  onRemoveChatMessage: (handler: (messageId: number) => void) => void;
  onError: (handler: (errorMessage: string) => void) => void;
  onRoomDeleted: (handler: () => void) => void;
}

interface UseSignalRChatReturn {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  currentUser: User | null;
  methods: ChatHubMethods;
  events: ChatHubEvents;
}

const useSignalRChat = (hubUrl: string = "/chatHub"): UseSignalRChatReturn => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Use a ref to store the connection so it persists across renders
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  // Initialize the connection
  useEffect(() => {
    // Create the connection
    connectionRef.current = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect()
      .build();

    // Set up event handlers
    setupEventHandlers();

    // Don't connect automatically - let the user call connect()

    return () => {
      // Clean up the connection when the component unmounts
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
    };
  }, [hubUrl]);

  // Set up event handlers for the hub
  const setupEventHandlers = useCallback(() => {
    if (!connectionRef.current) return;

    // Handle new messages
    connectionRef.current.on("newMessage", (message: Message) => {
      // This will be handled by the onNewMessage event handler
    });

    // Handle user profile info
    connectionRef.current.on("getProfileInfo", (user: User) => {
      setCurrentUser(user);
      setIsLoading(false);
    });

    // Handle errors
    connectionRef.current.on("onError", (errorMessage: string) => {
      setError(errorMessage);
    });
  }, []);

  // Connection methods
  const connect = useCallback(async () => {
    if (!connectionRef.current) return;

    try {
      await connectionRef.current.start();
      setIsConnected(true);
      setError(null);
      console.log("SignalR Connected");
    } catch (err) {
      setIsConnected(false);
      setError(`Connection failed: ${err}`);
      console.error(`SignalR Connection Error: ${err}`);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!connectionRef.current) return;

    try {
      await connectionRef.current.stop();
      setIsConnected(false);
    } catch (err) {
      setError(`Disconnect failed: ${err}`);
      console.error(`SignalR Disconnect Error: ${err}`);
    }
  }, []);

  // Room methods
  const joinRoom = useCallback(
    async (roomName: string) => {
      if (!connectionRef.current || !isConnected) return;

      try {
        await connectionRef.current.invoke("Join", roomName);
      } catch (err) {
        setError(`Failed to join room: ${err}`);
        console.error(`SignalR Join Room Error: ${err}`);
      }
    },
    [isConnected]
  );

  const leaveRoom = useCallback(
    async (roomName: string) => {
      if (!connectionRef.current || !isConnected) return;

      try {
        await connectionRef.current.invoke("Leave", roomName);
      } catch (err) {
        setError(`Failed to leave room: ${err}`);
        console.error(`SignalR Leave Room Error: ${err}`);
      }
    },
    [isConnected]
  );

  const getUsersInRoom = useCallback(
    async (roomName: string): Promise<User[]> => {
      if (!connectionRef.current || !isConnected) return [];

      try {
        return await connectionRef.current.invoke("GetUsers", roomName);
      } catch (err) {
        setError(`Failed to get users: ${err}`);
        console.error(`SignalR Get Users Error: ${err}`);
        return [];
      }
    },
    [isConnected]
  );

  // Message methods
  const sendPrivateMessage = useCallback(
    async (receiverName: string, message: string) => {
      if (!connectionRef.current || !isConnected) return;

      try {
        await connectionRef.current.invoke(
          "SendPrivate",
          receiverName.trim(),
          message.trim()
        );
      } catch (err) {
        setError(`Failed to send private message: ${err}`);
        console.error(`SignalR Send Private Message Error: ${err}`);
      }
    },
    [isConnected]
  );

  // API methods for rooms and messages
  const sendRoomMessage = useCallback(
    async (roomName: string, content: string) => {
      if (!connectionRef.current || !isConnected) return;

      try {
        await connectionRef.current.invoke("SendMessage", roomName, content);
      } catch (err) {
        setError(`Failed to send room message: ${err}`);
        console.error(`SignalR Send Room Message Error: ${err}`);
      }
    },
    [isConnected]
  );

  const getRooms = useCallback(async (): Promise<Room[]> => {
    try {
      const response = await fetch("/api/Rooms");
      return await response.json();
    } catch (err) {
      setError(`Failed to get rooms: ${err}`);
      console.error(`Get Rooms Error: ${err}`);
      return [];
    }
  }, []);

  const createRoom = useCallback(async (roomName: string) => {
    try {
      await fetch("/api/Rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName }),
      });
    } catch (err) {
      setError(`Failed to create room: ${err}`);
      console.error(`Create Room Error: ${err}`);
    }
  }, []);

  const updateRoom = useCallback(async (roomId: number, roomName: string) => {
    try {
      await fetch(`/api/Rooms/${roomId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: roomId, name: roomName }),
      });
    } catch (err) {
      setError(`Failed to update room: ${err}`);
      console.error(`Update Room Error: ${err}`);
    }
  }, []);

  const deleteRoom = useCallback(async (roomId: number) => {
    try {
      await fetch(`/api/Rooms/${roomId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: roomId }),
      });
    } catch (err) {
      setError(`Failed to delete room: ${err}`);
      console.error(`Delete Room Error: ${err}`);
    }
  }, []);

  const getMessageHistory = useCallback(
    async (roomName: string): Promise<Message[]> => {
      try {
        const response = await fetch(`/api/Messages/Room/${roomName}`);
        return await response.json();
      } catch (err) {
        setError(`Failed to get message history: ${err}`);
        console.error(`Get Message History Error: ${err}`);
        return [];
      }
    },
    []
  );

  const deleteMessage = useCallback(async (messageId: number) => {
    try {
      await fetch(`/api/Messages/${messageId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: messageId }),
      });
    } catch (err) {
      setError(`Failed to delete message: ${err}`);
      console.error(`Delete Message Error: ${err}`);
    }
  }, []);

  // Event registration methods
  const events: ChatHubEvents = {
    onNewMessage: (handler) => {
      if (connectionRef.current) {
        connectionRef.current.on("newMessage", handler);
      }
    },

    onAddUser: (handler) => {
      if (connectionRef.current) {
        connectionRef.current.on("addUser", handler);
      }
    },

    onRemoveUser: (handler) => {
      if (connectionRef.current) {
        connectionRef.current.on("removeUser", handler);
      }
    },

    onProfileInfo: (handler) => {
      if (connectionRef.current) {
        connectionRef.current.on("getProfileInfo", handler);
      }
    },

    onAddChatRoom: (handler) => {
      if (connectionRef.current) {
        connectionRef.current.on("addChatRoom", handler);
      }
    },

    onUpdateChatRoom: (handler) => {
      if (connectionRef.current) {
        connectionRef.current.on("updateChatRoom", handler);
      }
    },

    onRemoveChatRoom: (handler) => {
      if (connectionRef.current) {
        connectionRef.current.on("removeChatRoom", handler);
      }
    },

    onRemoveChatMessage: (handler) => {
      if (connectionRef.current) {
        connectionRef.current.on("removeChatMessage", handler);
      }
    },

    onError: (handler) => {
      if (connectionRef.current) {
        connectionRef.current.on("onError", handler);
      }
    },

    onRoomDeleted: (handler) => {
      if (connectionRef.current) {
        connectionRef.current.on("onRoomDeleted", handler);
      }
    },
  };

  // Return the methods and state
  return {
    isConnected,
    isLoading,
    error,
    currentUser,
    methods: {
      connect,
      disconnect,
      joinRoom,
      leaveRoom,
      getUsersInRoom,
      sendPrivateMessage,
      sendRoomMessage,
      getRooms,
      createRoom,
      updateRoom,
      deleteRoom,
      getMessageHistory,
      deleteMessage,
    },
    events,
  };
};

export default useSignalRChat;
