using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using StackExchange.Redis;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace Chat.Web.Services
{
    public class RedisHealthCheck : IHealthCheck
    {
        private readonly IConfiguration _configuration;

        public RedisHealthCheck(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
        {
            try
            {
                var redisConnection = _configuration.GetConnectionString("Redis");
                var redis = ConnectionMultiplexer.Connect(redisConnection);
                var db = redis.GetDatabase();

                // Check if Redis is working by setting and getting a value
                await db.StringSetAsync("health-check", "Redis is healthy!");
                var result = await db.StringGetAsync("health-check");
                
                if (result == "Redis is healthy!")
                {
                    return HealthCheckResult.Healthy("Redis connection is healthy");
                }
                else
                {
                    return HealthCheckResult.Degraded("Redis connection is having issues");
                }
            }
            catch (Exception ex)
            {
                return HealthCheckResult.Unhealthy("Redis connection is unhealthy", ex);
            }
        }
    }
}