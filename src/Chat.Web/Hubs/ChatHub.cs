using AutoMapper;
using Chat.Web.Data;
using Chat.Web.Models;
using Chat.Web.Services;
using Chat.Web.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace Chat.Web.Hubs
{
    // Temporarily removed the [Authorize] attribute to allow access without authentication
    public class ChatHub : Hub
    {
        private readonly ApplicationDbContext _context;
        private readonly IMapper _mapper;
        private readonly RedisConnectionService _redisService;

        public ChatHub(ApplicationDbContext context, IMapper mapper, RedisConnectionService redisService)
        {
            _context = context;
            _mapper = mapper;
            _redisService = redisService;
        }

        public async Task SendPrivate(string receiverName, string message)
        {
            var userId = await _redisService.GetConnectionIdByName(receiverName);
            if (!string.IsNullOrEmpty(userId))
            {
                // Who is the sender
                var sender = await _redisService.GetUserByName(IdentityName);

                if (sender != null && !string.IsNullOrEmpty(message.Trim()))
                {
                    // Build the message
                    var messageViewModel = new MessageViewModel()
                    {
                        Content = Regex.Replace(message, @"<.*?>", string.Empty),
                        FromUserName = sender.UserName,
                        FromFullName = sender.FullName,
                        Avatar = sender.Avatar,
                        Room = "",
                        Timestamp = DateTime.Now
                    };

                    // Send the message
                    await Clients.Client(userId).SendAsync("newMessage", messageViewModel);
                    await Clients.Caller.SendAsync("newMessage", messageViewModel);
                }
            }
        }

        public async Task SendMessage(string roomName, string message)
        {
            try
            {
                if (string.IsNullOrEmpty(message.Trim()))
                    return;

                var userName = IdentityName;
                var room = _context.Rooms.FirstOrDefault(r => r.Name == roomName);
                
                if (room == null)
                {
                    await Clients.Caller.SendAsync("onError", "Room not found");
                    return;
                }

                // Check if it's a guest user or authenticated user
                MessageViewModel messageViewModel;
                if (userName.StartsWith("guest-"))
                {
                    // For guest users, we'll just create a message view model without saving to the database
                    messageViewModel = new MessageViewModel
                    {
                        Id = 0, // Temporary ID
                        Content = Regex.Replace(message, @"<.*?>", string.Empty),
                        FromUserName = userName,
                        FromFullName = "Guest User",
                        Room = roomName,
                        Avatar = "/images/default-avatar.png",
                        Timestamp = DateTime.Now
                    };
                }
                else
                {
                    // For authenticated users, get the user from the database
                    var user = _context.Users.FirstOrDefault(u => u.UserName == userName);
                    
                    // Create and save the message to database
                    var msg = new Message
                    {
                        Content = Regex.Replace(message, @"<.*?>", string.Empty),
                        FromUser = user,
                        ToRoom = room,
                        Timestamp = DateTime.Now
                    };

                    _context.Messages.Add(msg);
                    await _context.SaveChangesAsync();

                    // Create the view model for the response
                    messageViewModel = new MessageViewModel
                    {
                        Id = msg.Id,
                        Content = msg.Content,
                        FromUserName = user.UserName,
                        FromFullName = user.FullName,
                        Room = roomName,
                        Avatar = user.Avatar,
                        Timestamp = msg.Timestamp
                    };
                }

                // Broadcast the message to all clients in the room
                await Clients.Group(roomName).SendAsync("newMessage", messageViewModel);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("onError", "Error sending message: " + ex.Message);
            }
        }

        public async Task Join(string roomName)
        {
            try
            {
                // Log the room name we're trying to join
                Console.WriteLine($"Attempting to join room: {roomName}");
                
                // Get the user from Redis with the identity name
                var identityName = IdentityName;
                Console.WriteLine($"Identity name: {identityName}");
                
                var user = await _redisService.GetUserByName(identityName);
                if (user == null)
                {
                    Console.WriteLine("User not found in Redis, likely not connected properly");
                    await Clients.Caller.SendAsync("onError", "Failed to join chat room: User not found. Please refresh and try again.");
                    return;
                }
                
                Console.WriteLine($"User found: {user.UserName}, Current room: {user.CurrentRoom}");
                
                if (user.CurrentRoom != roomName)
                {
                    // Remove user from others list in current room
                    if (!string.IsNullOrEmpty(user.CurrentRoom))
                    {
                        Console.WriteLine($"Removing user from room: {user.CurrentRoom}");
                        await Clients.OthersInGroup(user.CurrentRoom).SendAsync("removeUser", user);
                    }

                    // Join to new chat room
                    Console.WriteLine($"Leaving current room: {user.CurrentRoom}");
                    await Leave(user.CurrentRoom);
                    
                    Console.WriteLine($"Adding to group: {roomName}");
                    await Groups.AddToGroupAsync(Context.ConnectionId, roomName);
                    
                    // Update user's current room in Redis
                    Console.WriteLine($"Updating user room in Redis: {roomName}");
                    await _redisService.UpdateUserRoom(user.UserName, roomName);
                    user.CurrentRoom = roomName;

                    // Tell others to update their list of users
                    Console.WriteLine($"Notifying others in room {roomName} about new user");
                    await Clients.OthersInGroup(roomName).SendAsync("addUser", user);
                }
                else
                {
                    Console.WriteLine($"User already in room: {roomName}");
                }
            }
            catch (Exception ex)
            {
                var errorMsg = $"Failed to join chat room: {ex.Message}";
                if (ex.InnerException != null)
                {
                    errorMsg += $" Inner exception: {ex.InnerException.Message}";
                }
                Console.WriteLine($"Error in Join method: {errorMsg}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                await Clients.Caller.SendAsync("onError", errorMsg);
            }
        }

        public async Task Leave(string roomName)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomName);
        }

        public async Task<IEnumerable<UserViewModel>> GetUsers(string roomName)
        {
            return await _redisService.GetAllUsersInRoom(roomName);
        }

        public override async Task OnConnectedAsync()
        {
            try
            {
                UserViewModel userViewModel;
                // Check if we have an authenticated user
                var userName = IdentityName;
                if (userName.StartsWith("guest-"))
                {
                    // Create a guest user view model
                    userViewModel = new UserViewModel
                    {
                        UserName = userName,
                        FullName = "Guest User",
                        Avatar = "/images/default-avatar.png", // Use a default avatar
                        Device = GetDevice(),
                        CurrentRoom = ""
                    };
                }
                else
                {
                    // Get authenticated user from database
                    var user = _context.Users.Where(u => u.UserName == userName).FirstOrDefault();
                    userViewModel = _mapper.Map<ApplicationUser, UserViewModel>(user);
                    userViewModel.Device = GetDevice();
                    userViewModel.CurrentRoom = "";
                }

                // Store user connection in Redis
                await _redisService.AddConnection(userViewModel, Context.ConnectionId);

                await Clients.Caller.SendAsync("getProfileInfo", userViewModel);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("onError", "OnConnected:" + ex.Message);
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            try
            {
                var user = await _redisService.GetUserByName(IdentityName);
                if (user != null)
                {
                    // Tell other users to remove you from their list
                    await Clients.OthersInGroup(user.CurrentRoom).SendAsync("removeUser", user);

                    // Remove user from Redis
                    await _redisService.RemoveConnection(IdentityName);
                }
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("onError", "OnDisconnected: " + ex.Message);
            }

            await base.OnDisconnectedAsync(exception);
        }

        private string IdentityName
        {
            get {
                // Handle the case when there's no authenticated user
                return Context.User?.Identity?.Name ?? "guest-" + Context.ConnectionId;
            }
        }

        private string GetDevice()
        {
            var device = Context.GetHttpContext().Request.Headers["Device"].ToString();
            if (!string.IsNullOrEmpty(device) && (device.Equals("Desktop") || device.Equals("Mobile")))
                return device;

            return "Web";
        }
    }
}
