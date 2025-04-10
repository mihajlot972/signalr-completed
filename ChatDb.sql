USE master;
GO

IF NOT EXISTS (SELECT name FROM master.sys.databases WHERE name = N'ChatDb')
BEGIN
    CREATE DATABASE [ChatDb];
END
GO