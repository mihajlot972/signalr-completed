# SignalR Chat Application with Docker and Redis

This project is a real-time chat application built with ASP.NET Core and SignalR. The application has been dockerized and configured to use Redis as a backplane for SignalR, which allows for scaling across multiple instances.

## Features

- Real-time chat using SignalR
- Persistent user connections with Redis backplane
- Dockerized application for easy deployment
- SQL Server for data storage
- Health checks for monitoring Redis connectivity

## Prerequisites

- Docker and Docker Compose
- .NET SDK 7.0 (only required for development)

## Getting Started

### Running with Docker

1. Clone this repository
2. Navigate to the root directory containing the `docker-compose.yml` file
3. Run the application using the provided scripts:

**Windows:**

```batch
run.bat
```

**Linux/macOS:**

```bash
chmod +x run.sh
./run.sh
```

The application will be available at http://localhost:8080

### Accessing the Application

After starting the containers, you can:

- Visit http://localhost:8080 to access the chat application
- Visit http://localhost:8080/health to check the health of the Redis connection

### Docker Compose Services

The application consists of three services:

1. **chatapp** - The ASP.NET Core application
2. **db** - SQL Server instance for data storage
3. **redis** - Redis server for SignalR backplane

## Testing Redis Connectivity

To verify Redis connectivity:

1. Start the application using docker-compose
2. Access the health check endpoint at http://localhost:8080/health
3. If Redis is connected properly, you will see a "Healthy" status

## Stopping the Application

To stop the application:

```bash
docker-compose down
```

To stop and remove all containers, networks, and volumes:

```bash
docker-compose down -v
```

## Development

For development, you can:

1. Install the .NET SDK 7.0
2. Run Redis and SQL Server separately
3. Update the connection strings in appsettings.json
4. Run the application using `dotnet run` from the src/Chat.Web directory

## Architecture

The application uses:

- ASP.NET Core for the web application
- SignalR for real-time communication
- Redis for SignalR backplane (ensuring message delivery across multiple instances)
- SQL Server for data storage
- Entity Framework Core for data access
- Docker for containerization
