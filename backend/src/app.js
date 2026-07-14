/**
 * ------------------------------------------------------------
 * MeetFlow - Server Entry Point
 * ------------------------------------------------------------
 * This file:
 * 1. Initializes the Express application
 * 2. Connects to MongoDB
 * 3. Configures middleware
 * 4. Attaches Socket.io to the HTTP server
 * 5. Registers API routes
 * 6. Starts the server
 * ------------------------------------------------------------
 */

import express from "express";
import { createServer } from "node:http";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import dns from "node:dns";

import { connectToSocket } from "./controllers/socketManager.js";
import userRoutes from "./routes/users.routes.js";

// Load environment variables from .env file
dotenv.config();

// Override DNS to use Google DNS - bypasses ISP blocks on MongoDB SRV records
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

// Create Express application instance
const app = express();

// Create HTTP server using Express app
// This is required to attach Socket.io
const server = createServer(app);

// Attach Socket.io to the HTTP server
connectToSocket(server);

// Application configuration
const PORT = process.env.PORT || 8000;
const MONGODB_URI = process.env.MONGODB_URI;

// CORS configuration
// Allows frontend application to communicate with backend
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      process.env.FRONTEND_URL,
      "https://meet-flow-five.vercel.app",
      "http://localhost:3000",
      "http://localhost:3001",
    ].filter(Boolean);

    // Allow any vercel.app subdomain or explicitly listed origins
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith(".vercel.app")
    ) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Global middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ extended: true, limit: "40kb" }));

// Register API routes
app.use("/api/v1/users", userRoutes);

// Root route - basic health check endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    message: "MeetFlow API Server",
    status: "Running",
    version: "1.0.0",
  });
});

// Simple test route
app.get("/home", (req, res) => {
  res.status(200).send("Hello World!");
});

/**
 * Connect to MongoDB and start the server.
 * The server will not start if database connection fails.
 */
const startServer = async () => {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log("MongoDB connected successfully");

    server.listen(PORT, () => {
      console.log(`Server is listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error.message);
    process.exit(1); // Exit process if database connection fails
  }
};

startServer();
