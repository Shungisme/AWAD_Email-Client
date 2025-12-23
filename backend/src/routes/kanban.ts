import express, { Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import KanbanConfig, { KanbanColumn } from "../models/KanbanConfig";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * GET /api/kanban/config
 * Get user's Kanban configuration
 */
router.get("/config", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Find user's config or create default if doesn't exist
    let config = await KanbanConfig.findOne({ userId });

    if (!config) {
      // Create default config
      config = new KanbanConfig({
        userId,
        columns: [
          {
            id: "inbox",
            title: "Inbox",
            color: "bg-blue-500",
            icon: "Inbox",
            gmailLabel: "INBOX",
            order: 0,
          },
          {
            id: "todo",
            title: "To Do",
            color: "bg-yellow-500",
            icon: "Clock",
            gmailLabel: "STARRED",
            order: 1,
          },
          {
            id: "done",
            title: "Done",
            color: "bg-green-500",
            icon: "CheckCircle",
            gmailLabel: undefined,
            order: 2,
          },
          {
            id: "snoozed",
            title: "Snoozed",
            color: "bg-purple-500",
            icon: "Clock",
            gmailLabel: undefined,
            order: 3,
          },
        ],
      });
      await config.save();
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error("Get Kanban config error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * PUT /api/kanban/config
 * Update user's Kanban configuration
 */
router.put("/config", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { columns } = req.body as { columns: KanbanColumn[] };

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    if (!columns || !Array.isArray(columns)) {
      res.status(400).json({
        success: false,
        message: "Invalid columns data",
      });
      return;
    }

    // Validate columns
    for (const column of columns) {
      if (!column.id || !column.title || !column.color || !column.icon) {
        res.status(400).json({
          success: false,
          message: "Each column must have id, title, color, and icon",
        });
        return;
      }
    }

    // Update or create config
    const config = await KanbanConfig.findOneAndUpdate(
      { userId },
      { columns },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      data: config,
      message: "Kanban configuration updated successfully",
    });
  } catch (error) {
    console.error("Update Kanban config error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/kanban/config/columns
 * Add a new column to user's Kanban configuration
 */
router.post(
  "/config/columns",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const column = req.body as KanbanColumn;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      if (!column.id || !column.title || !column.color || !column.icon) {
        res.status(400).json({
          success: false,
          message: "Column must have id, title, color, and icon",
        });
        return;
      }

      // Get or create config
      let config = await KanbanConfig.findOne({ userId });

      if (!config) {
        config = new KanbanConfig({ userId, columns: [] });
      }

      // Check if column with same ID already exists
      if (config.columns.some((c) => c.id === column.id)) {
        res.status(400).json({
          success: false,
          message: "Column with this ID already exists",
        });
        return;
      }

      // Add column
      config.columns.push(column);
      await config.save();

      res.json({
        success: true,
        data: config,
        message: "Column added successfully",
      });
    } catch (error) {
      console.error("Add Kanban column error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * DELETE /api/kanban/config/columns/:columnId
 * Remove a column from user's Kanban configuration
 */
router.delete(
  "/config/columns/:columnId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { columnId } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const config = await KanbanConfig.findOne({ userId });

      if (!config) {
        res.status(404).json({
          success: false,
          message: "Kanban configuration not found",
        });
        return;
      }

      // Remove column
      config.columns = config.columns.filter((c) => c.id !== columnId);
      await config.save();

      res.json({
        success: true,
        data: config,
        message: "Column removed successfully",
      });
    } catch (error) {
      console.error("Delete Kanban column error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * PATCH /api/kanban/config/columns/:columnId
 * Update a specific column in user's Kanban configuration
 */
router.patch(
  "/config/columns/:columnId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { columnId } = req.params;
      const updates = req.body as Partial<KanbanColumn>;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const config = await KanbanConfig.findOne({ userId });

      if (!config) {
        res.status(404).json({
          success: false,
          message: "Kanban configuration not found",
        });
        return;
      }

      // Find and update column
      const columnIndex = config.columns.findIndex((c) => c.id === columnId);

      if (columnIndex === -1) {
        res.status(404).json({
          success: false,
          message: "Column not found",
        });
        return;
      }

      // Update column properties
      config.columns[columnIndex] = {
        ...config.columns[columnIndex],
        ...updates,
        id: columnId, // Prevent ID change
      };

      await config.save();

      res.json({
        success: true,
        data: config,
        message: "Column updated successfully",
      });
    } catch (error) {
      console.error("Update Kanban column error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export default router;
