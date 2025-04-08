#!/bin/bash

# Build and start the containers
docker-compose up --build -d

# Display container status
echo "Container status:"
docker-compose ps

echo ""
echo "The chat application is running at http://localhost:8080"
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down"