using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Chat.Web.Data;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Chat.Web.Hubs;
using Chat.Web.Models;
using AutoMapper;
using Chat.Web.Helpers;
using Chat.Web.Services;
using StackExchange.Redis;

namespace Chat.Web
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            // Add CORS services
            services.AddCors(options =>
            {
                options.AddPolicy("AllowAll",
                    builder =>
                    {
                        builder.SetIsOriginAllowed(_ => true) // Allow any origin
                               .AllowAnyHeader()
                               .AllowAnyMethod()
                               .AllowCredentials();
                    });
            });
            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseSqlServer(Configuration.GetConnectionString("DefaultConnection")));

            services.AddDatabaseDeveloperPageExceptionFilter();
            
            // Add health checks for Redis
            services.AddHealthChecks()
                .AddCheck<RedisHealthCheck>("redis_health_check");

            services.AddDefaultIdentity<ApplicationUser>(options =>
            {
                options.SignIn.RequireConfirmedAccount = false;
                options.User.AllowedUserNameCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
                options.User.RequireUniqueEmail = true;
            }).AddEntityFrameworkStores<ApplicationDbContext>();

            services.AddAutoMapper(typeof(Startup));
            services.AddTransient<IFileValidator, FileValidator>();
            services.AddSingleton<RedisConnectionService>();
            services.AddRazorPages();
            services.AddControllers();
            
            // Configure SignalR with Redis backplane for scaling
            services.AddSignalR(options =>
            {
                // Allow any origin for WebSocket connections
                options.EnableDetailedErrors = true;
            })
            .AddStackExchangeRedis(Configuration.GetConnectionString("Redis"), options =>
            {
                options.Configuration.ChannelPrefix = "ChatApp";
            });
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
                app.UseMigrationsEndPoint();
            }
            else
            {
                app.UseExceptionHandler("/Error");
                // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
                app.UseHsts();
            }

            app.UseHttpsRedirection();
            app.UseStaticFiles();

            app.UseRouting();

            // Apply CORS middleware - must be after UseRouting and before UseAuthentication
            app.UseCors("AllowAll");

            app.UseAuthentication();
            app.UseAuthorization();

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapRazorPages();
                endpoints.MapControllers();
                endpoints.MapHub<ChatHub>("/chatHub");
                endpoints.MapHealthChecks("/health");
                
                // Add a route for /chat that serves the chat interface
                endpoints.MapGet("/chat", async context => {
                    // Serve the index page for the chat interface
                    await context.Response.WriteAsync(@"
<!DOCTYPE html>
<html>
<head>
    <title>SignalR Chat</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        h1 { color: #333; }
        #message-list { height: 300px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; }
        #message-form { display: flex; }
        #message-input { flex-grow: 1; padding: 5px; }
        button { padding: 5px 15px; margin-left: 10px; }
    </style>
</head>
<body>
    <h1>SignalR Chat</h1>
    <div id='message-list'></div>
    <form id='message-form'>
        <input type='text' id='message-input' placeholder='Type a message...' />
        <button type='submit'>Send</button>
    </form>

    <script src='https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/5.0.0/signalr.min.js'></script>
    <script>
        const messageList = document.getElementById('message-list');
        const messageForm = document.getElementById('message-form');
        const messageInput = document.getElementById('message-input');

        // Create connection
        const connection = new signalR.HubConnectionBuilder()
            .withUrl('/chatHub')
            .build();

        // Start connection
        connection.start().catch(err => console.error(err));

        // Handle new messages
        connection.on('newMessage', function(message) {
            const messageElement = document.createElement('div');
            messageElement.textContent = `${message.fromUserName}: ${message.content}`;
            messageList.appendChild(messageElement);
            messageList.scrollTop = messageList.scrollHeight;
        });

        // Send message
        messageForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (messageInput.value) {
                // This would typically send to a specific room
                connection.invoke('SendMessage', 'General', messageInput.value).catch(err => console.error(err));
                messageInput.value = '';
            }
        });
    </script>
</body>
</html>");
                });
                // This enables access to the chat API at 192.168.1.108:8080/chat
            });
        }
    }
}
