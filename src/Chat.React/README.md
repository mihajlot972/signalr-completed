# React SignalR Chat Integration

This folder contains reusable React components for integrating with the SignalR Chat application.

## Prerequisites

To use these components, you need to have the following dependencies installed in your React project:

```bash
npm install @microsoft/signalr react
```

For TypeScript projects, you might also need:

```bash
npm install @types/react
```

## Files Overview

1. `useSignalRChat.tsx` - A React hook that provides SignalR Chat functionality
2. `ChatComponent.tsx` - A complete React component that uses the hook to display a chat interface
3. `ChatComponent.css` - Styles for the chat component

## How to Use

### Option 1: Using the Hook in Your Own Components

The `useSignalRChat` hook can be imported and used in your own components:

```jsx
import React, { useEffect, useState } from "react";
import useSignalRChat from "./useSignalRChat";

const MyChatApp = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const { isConnected, methods, events } = useSignalRChat(
    "http://localhost:8080/chatHub"
  ); // Adjust URL based on your setup

  useEffect(() => {
    // Connect to the hub
    methods.connect();

    // Set up event handlers
    events.onNewMessage((message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Clean up on unmount
    return () => {
      methods.disconnect();
    };
  }, [methods, events]);

  const sendMessage = () => {
    if (!message.trim()) return;
    methods.sendRoomMessage("General", message);
    setMessage("");
  };

  return (
    <div>
      <div className="messages">
        {messages.map((msg, index) => (
          <div key={index} className="message">
            <strong>{msg.fromFullName}:</strong> {msg.content}
          </div>
        ))}
      </div>

      <div className="input-area">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={!isConnected}
        />
        <button onClick={sendMessage} disabled={!isConnected}>
          Send
        </button>
      </div>
    </div>
  );
};
```

### Option 2: Using the Pre-built Component

You can also use the pre-built `ChatComponent` directly:

```jsx
import React from "react";
import ChatComponent from "./ChatComponent";
import "./ChatComponent.css";

const App = () => {
  return (
    <div className="app">
      <h1>My Chat Application</h1>
      <ChatComponent />
    </div>
  );
};

export default App;
```

## Configuration

When using the hook, you need to provide the URL of your SignalR hub. This URL depends on your setup:

- For local development with Docker: `http://localhost:8080/chatHub`
- For production: `/chatHub` (relative to your app's domain)

## Authentication

The SignalR hub requires authentication. Make sure your React application is properly authenticated before using these components. The hook doesn't handle authentication directly, it expects to use the existing authentication cookies/tokens.

## API Reference

### useSignalRChat Hook

```typescript
const {
  isConnected, // boolean - connection status
  isLoading, // boolean - loading status
  error, // string | null - error message
  currentUser, // User | null - current user profile
  methods, // Object - methods to interact with the chat
  events, // Object - event handlers
} = useSignalRChat(hubUrl);
```

#### Methods

- `connect()` - Connect to the SignalR hub
- `disconnect()` - Disconnect from the hub
- `joinRoom(roomName)` - Join a chat room
- `leaveRoom(roomName)` - Leave a chat room
- `getUsersInRoom(roomName)` - Get users in a room
- `sendPrivateMessage(receiverName, message)` - Send a private message
- `sendRoomMessage(roomName, message)` - Send a message to a room
- `getRooms()` - Get all available rooms
- `createRoom(roomName)` - Create a new room
- `updateRoom(roomId, roomName)` - Update a room
- `deleteRoom(roomId)` - Delete a room
- `getMessageHistory(roomName)` - Get message history for a room
- `deleteMessage(messageId)` - Delete a message

#### Events

- `onNewMessage(handler)` - New message received
- `onAddUser(handler)` - User joined a room
- `onRemoveUser(handler)` - User left a room
- `onProfileInfo(handler)` - User profile info received
- `onAddChatRoom(handler)` - Room added
- `onUpdateChatRoom(handler)` - Room updated
- `onRemoveChatRoom(handler)` - Room removed
- `onRemoveChatMessage(handler)` - Message removed
- `onError(handler)` - Error occurred
- `onRoomDeleted(handler)` - Current room deleted
