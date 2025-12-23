// Load environment variables FIRST before any other imports
import dotenv from "dotenv";
dotenv.config();

import express, { Application, Request, Response } from "express";
import cors from "cors";
import connectDB from "./config/database";
import authRoutes from "./routes/auth";
import mailboxesRoutes from "./routes/mailboxes";
import emailsRoutes from "./routes/emails";
import kanbanRoutes from "./routes/kanban";

// Connect to MongoDB
connectDB();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Email Dashboard API is running",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/mailboxes", mailboxesRoutes);
app.use("/api", emailsRoutes);
app.use("/api/kanban", kanbanRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`

    📧  Email Dashboard API Server
    🚀  Server running on port ${PORT}                    
    🌐  API: http://localhost:${PORT}                    
    ❤️   Health: http://localhost:${PORT}/health
    Environment: ${
      process.env.NODE_ENV || "development"
    }                          
  `);
});

export default app;
