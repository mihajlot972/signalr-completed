import React, { useState, useEffect } from "react";
import useSignalRChat, { Message, User, Room } from "./useSignalRChat";

const ChatComponent: React.FC = () => {
  // State for the chat component
  const [messages, setMessages] = useState<Message[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [messageText, setMessageText] = useState<string>("");
  const [newRoomName, setNewRoomName] = useState<string>("");

  // Initialize the SignalR hook with the URL of your chat hub
  // For local development, this would be something like 'http://localhost:8080/chatHub'
  // When deployed with Docker, it would be '/chatHub' (relative to the current origin)
  const { isConnected, isLoading, error, currentUser, methods, events } =
    useSignalRChat("/chatHub");

  // Connect to the hub when the component mounts
  useEffect(() => {
    const connectToHub = async () => {
      try {
        await methods.connect();
      } catch (err) {
        console.error("Error connecting to SignalR hub:", err);
      }
    };

    connectToHub();

    // Clean up the connection when the component unmounts
    return () => {
      methods.disconnect();
    };
  }, [methods]);

  // Set up event handlers
  useEffect(() => {
    if (!isConnected) return;

    // Handle new messages
    events.onNewMessage((message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Handle user joined
    events.onAddUser((user) => {
      setUsers((prev) => [...prev, user]);
    });

    // Handle user left
    events.onRemoveUser((user) => {
      setUsers((prev) => prev.filter((u) => u.userName !== user.userName));
    });

    // Handle room added
    events.onAddChatRoom((room) => {
      setRooms((prev) => [...prev, room]);
    });

    // Handle room updated
    events.onUpdateChatRoom((room) => {
      setRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
      if (currentRoom?.id === room.id) {
        setCurrentRoom(room);
      }
    });

    // Handle room deleted
    events.onRemoveChatRoom((roomId) => {
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      if (currentRoom?.id === roomId) {
        setCurrentRoom(null);
      }
    });

    // Handle message deleted
    events.onRemoveChatMessage((messageId) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    });

    // Handle errors
    events.onError((errorMessage) => {
      console.error("SignalR Error:", errorMessage);
    });

    // Load rooms when connected
    const loadRooms = async () => {
      try {
        const roomList = await methods.getRooms();
        setRooms(roomList);

        // Join the first room if there is one
        if (roomList.length > 0 && !currentRoom) {
          await joinRoom(roomList[0]);
        }
      } catch (err) {
        console.error("Error loading rooms:", err);
      }
    };

    loadRooms();
  }, [isConnected, events, methods, currentRoom]);

  // Join a room
  const joinRoom = async (room: Room) => {
    try {
      await methods.joinRoom(room.name);
      setCurrentRoom(room);

      // Get users in the room
      const userList = await methods.getUsersInRoom(room.name);
      setUsers(userList);

      // Get message history
      const messageHistory = await methods.getMessageHistory(room.name);
      setMessages(messageHistory);
    } catch (err) {
      console.error("Error joining room:", err);
    }
  };

  // Send a message
  const sendMessage = async () => {
    if (!messageText.trim() || !currentRoom) return;

    try {
      // Check if it's a private message (starting with /)
      if (messageText.startsWith("/")) {
        const receiverEndIndex = messageText.indexOf(" ");
        if (receiverEndIndex > 0) {
          const receiver = messageText.substring(1, receiverEndIndex);
          const privateMessage = messageText.substring(receiverEndIndex + 1);
          await methods.sendPrivateMessage(receiver, privateMessage);
        }
      } else {
        // Regular room message
        await methods.sendRoomMessage(currentRoom.name, messageText);
      }

      // Clear the message input
      setMessageText("");
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  // Create a new room
  const createRoom = async () => {
    if (!newRoomName.trim()) return;

    try {
      await methods.createRoom(newRoomName);
      setNewRoomName("");
    } catch (err) {
      console.error("Error creating room:", err);
    }
  };

  // Show loading state
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Show error state
  if (error) {
    return <div>Error: {error}</div>;
  }

  // Show disconnected state
  if (!isConnected) {
    return (
      <div>
        <p>Disconnected from chat server.</p>
        <button onClick={() => methods.connect()}>Connect</button>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="sidebar">
        <div className="profile-section">
          {currentUser && (
            <div className="user-profile">
              <img
                src={currentUser.avatar || "/default-avatar.png"}
                alt="Avatar"
              />
              <div>
                <h3>{currentUser.fullName}</h3>
                <p>@{currentUser.userName}</p>
              </div>
            </div>
          )}
        </div>

        <div className="rooms-section">
          <h3>Rooms</h3>
          <ul>
            {rooms.map((room) => (
              <li
                key={room.id}
                className={currentRoom?.id === room.id ? "active" : ""}
                onClick={() => joinRoom(room)}
              >
                {room.name}
              </li>
            ))}
          </ul>

          <div className="add-room">
            <input
              type="text"
              placeholder="New room name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
            />
            <button onClick={createRoom}>Create</button>
          </div>
        </div>

        <div className="users-section">
          <h3>Users in Room</h3>
          <ul>
            {users.map((user) => (
              <li key={user.userName}>
                <img
                  src={user.avatar || "/default-avatar.png"}
                  alt="Avatar"
                  className="user-avatar"
                />
                <span>{user.fullName}</span>
                <span className="username">@{user.userName}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="chat-content">
        <div className="messages-container">
          {messages.map((message, index) => (
            <div
              key={message.id || index}
              className={`message ${
                message.fromUserName === currentUser?.userName
                  ? "my-message"
                  : ""
              }`}
            >
              <div className="message-avatar">
                <img
                  src={message.avatar || "/default-avatar.png"}
                  alt="Avatar"
                />
              </div>
              <div className="message-content">
                <div className="message-header">
                  <span className="sender">{message.fromFullName}</span>
                  <span className="time">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="message-text">{message.content}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="message-input">
          <input
            type="text"
            placeholder="Type a message..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            disabled={!currentRoom}
          />
          <button onClick={sendMessage} disabled={!currentRoom}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatComponent;
