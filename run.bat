@echo off
echo Building and starting containers...
docker-compose up --build -d

echo.
echo Container status:
docker-compose ps

echo.
echo The chat application is running at http://localhost:8080
echo To view logs: docker-compose logs -f
echo To stop: docker-compose down