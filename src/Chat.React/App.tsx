import React, { useState } from "react";
import ChatComponent from "./ChatComponent";
import "./ChatComponent.css";

// Simple authentication form component
const AuthForm: React.FC<{
  onLogin: (username: string, password: string) => void;
}> = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h2>Sign In</h2>
      <div className="form-group">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <button type="submit">Login</button>
    </form>
  );
};

// Main App component
const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In a real app, this would call your authentication API
  const handleLogin = async (username: string, password: string) => {
    try {
      // This is a placeholder for your actual authentication logic
      // You would typically make an API call to your backend here
      const response = await fetch("/api/Account/Login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error("Authentication failed");
      }

      // Successfully authenticated
      setIsAuthenticated(true);
      setError(null);
    } catch (err) {
      setError("Login failed. Please check your credentials.");
      console.error("Login error:", err);
    }
  };

  return (
    <div className="app-container">
      {!isAuthenticated ? (
        <div className="auth-container">
          {error && <div className="error-message">{error}</div>}
          <AuthForm onLogin={handleLogin} />
          <p className="info-text">
            Note: This chat application requires authentication. Please sign in
            to access the chat features.
          </p>
        </div>
      ) : (
        <ChatComponent />
      )}
    </div>
  );
};

export default App;

// CSS for the auth form and container
// You can add this to a separate CSS file or include it in your main CSS file
/*
.app-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

.auth-container {
  width: 400px;
  padding: 30px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.auth-form h2 {
  margin-top: 0;
  margin-bottom: 24px;
  text-align: center;
  color: #333;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
}

.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.form-group input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.auth-form button {
  width: 100%;
  padding: 12px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 10px;
}

.auth-form button:hover {
  background-color: #0069d9;
}

.error-message {
  padding: 10px;
  margin-bottom: 20px;
  background-color: #f8d7da;
  color: #721c24;
  border-radius: 4px;
  text-align: center;
}

.info-text {
  margin-top: 20px;
  text-align: center;
  color: #666;
  font-size: 14px;
}
*/
