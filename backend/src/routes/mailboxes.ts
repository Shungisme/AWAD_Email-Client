import express, { Request, Response } from "express";
import { Mailbox } from "../types";
import mailboxesData from "../data/mailboxes.json";
import { authMiddleware } from "../middleware/auth";
import gmailService from "../services/gmail";
import tokenStore from "../services/tokenStore";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/mailboxes - Get all mailboxes for current user
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Check if user has Gmail tokens (using real Gmail)
    const hasGmailToken = tokenStore.hasToken(userId);

    if (hasGmailToken) {
      // Fetch real Gmail labels
      try {
        const labels = await gmailService.listLabels(userId);

        // Transform Gmail labels to our Mailbox format
        const mailboxes: Mailbox[] = labels.map((label) => ({
          id: label.id!,
          userId,
          name: label.name!,
          icon: getIconForLabel(label.id!),
          unreadCount: label.messagesUnread || 0,
        }));

        res.json({
          success: true,
          data: mailboxes,
        });
        return;
      } catch (error) {
        console.error("Gmail labels fetch error:", error);
        // Fall through to mock data on error
      }
    }

    // Fallback to mock data
    const mailboxes = (mailboxesData as Mailbox[]).filter(
      (mailbox) => mailbox.userId === userId
    );

    res.json({
      success: true,
      data: mailboxes,
    });
  } catch (error) {
    console.error("Get mailboxes error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// GET /api/mailboxes/:id - Get specific mailbox by ID
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Check if user has Gmail tokens
    const hasGmailToken = tokenStore.hasToken(userId);

    if (hasGmailToken) {
      try {
        const labels = await gmailService.listLabels(userId);
        const label = labels.find((l) => l.id === id);

        if (!label) {
          res.status(404).json({
            success: false,
            message: "Mailbox not found",
          });
          return;
        }

        const mailbox: Mailbox = {
          id: label.id!,
          userId,
          name: convertToTitleCase(label.name!),
          icon: getIconForLabel(label.id!),
          unreadCount: label.messagesUnread || 0,
        };

        res.json({
          success: true,
          data: mailbox,
        });
        return;
      } catch (error) {
        console.error("Gmail label fetch error:", error);
        // Fall through to mock data
      }
    }

    // Fallback to mock data
    const mailbox = (mailboxesData as Mailbox[]).find(
      (m) => m.id === id && m.userId === userId
    );

    if (!mailbox) {
      res.status(404).json({
        success: false,
        message: "Mailbox not found",
      });
      return;
    }

    res.json({
      success: true,
      data: mailbox,
    });
  } catch (error) {
    console.error("Get mailbox error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Helper function to map Gmail label IDs to mailbox types
function mapLabelToType(labelId: string): string {
  const typeMap: { [key: string]: string } = {
    INBOX: "inbox",
    SENT: "sent",
    DRAFT: "draft",
    TRASH: "trash",
    SPAM: "spam",
    STARRED: "starred",
    IMPORTANT: "important",
  };
  return typeMap[labelId] || "custom";
}

// Helper function to assign colors to labels
function getColorForLabel(labelId: string): string {
  const colorMap: { [key: string]: string } = {
    INBOX: "blue",
    SENT: "green",
    DRAFT: "yellow",
    TRASH: "red",
    SPAM: "gray",
    STARRED: "orange",
    IMPORTANT: "purple",
  };
  return colorMap[labelId] || "gray";
}

// Helper function to get icon for label
function getIconForLabel(labelId: string): string {
  const iconMap: { [key: string]: string } = {
    INBOX: "inbox",
    SENT: "send",
    DRAFT: "draft",
    TRASH: "trash",
    SPAM: "report",
    STARRED: "star",
    IMPORTANT: "label_important",
  };
  return iconMap[labelId] || "folder";
}

export default router;
