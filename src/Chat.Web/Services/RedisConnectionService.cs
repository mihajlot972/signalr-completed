using Chat.Web.ViewModels;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;
using StackExchange.Redis;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Chat.Web.Services
{
    public class RedisConnectionService
    {
        private readonly ConnectionMultiplexer _redis;
        private readonly IDatabase _database;
        private const string ConnectionsKey = "chat:connections";
        private const string ConnectionsMapKey = "chat:connectionsMap";

        public RedisConnectionService(IConfiguration configuration)
        {
            var redisConnection = configuration.GetConnectionString("Redis");
            _redis = ConnectionMultiplexer.Connect(redisConnection);
            _database = _redis.GetDatabase();
        }

        public async Task AddConnection(UserViewModel user, string connectionId)
        {
            // Store the user in Redis
            await _database.HashSetAsync(ConnectionsKey, user.UserName, JsonConvert.SerializeObject(user));
            // Map the username to their connection ID
            await _database.HashSetAsync(ConnectionsMapKey, user.UserName, connectionId);
        }

        public async Task RemoveConnection(string username)
        {
            // Remove the user from Redis
            await _database.HashDeleteAsync(ConnectionsKey, username);
            // Remove the connection mapping
            await _database.HashDeleteAsync(ConnectionsMapKey, username);
        }

        public async Task<UserViewModel> GetUserByName(string username)
        {
            var userJson = await _database.HashGetAsync(ConnectionsKey, username);
            if (userJson.IsNullOrEmpty)
                return null;

            return JsonConvert.DeserializeObject<UserViewModel>(userJson);
        }

        public async Task<string> GetConnectionIdByName(string username)
        {
            return await _database.HashGetAsync(ConnectionsMapKey, username);
        }

        public async Task<List<UserViewModel>> GetAllUsersInRoom(string roomName)
        {
            var allUsers = await GetAllUsers();
            return allUsers.Where(u => u.CurrentRoom == roomName).ToList();
        }

        public async Task<List<UserViewModel>> GetAllUsers()
        {
            var users = new List<UserViewModel>();
            var hashEntries = await _database.HashGetAllAsync(ConnectionsKey);

            foreach (var entry in hashEntries)
            {
                var user = JsonConvert.DeserializeObject<UserViewModel>(entry.Value);
                users.Add(user);
            }

            return users;
        }

        public async Task UpdateUserRoom(string username, string roomName)
        {
            var user = await GetUserByName(username);
            if (user != null)
            {
                user.CurrentRoom = roomName;
                await _database.HashSetAsync(ConnectionsKey, username, JsonConvert.SerializeObject(user));
            }
        }
    }
}