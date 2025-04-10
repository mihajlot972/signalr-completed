sleep 30s

/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Pass@word1 -C -d master -i ChatDb.sql
