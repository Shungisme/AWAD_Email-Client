import express, { Request, Response } from "express";
import { Email } from "../types";
import emailsData from "../data/emails.json";
import mailboxesData from "../data/mailboxes.json";
import { authMiddleware } from "../middleware/auth";
import gmailService from "../services/gmail";
import tokenStore from "../services/tokenStore";
import { parseGmailMessage, createRawEmail } from "../utils/emailParser";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// In-memory email store (initialized from JSON)
let emails = [...(emailsData as Email[])];

// GET /api/mailboxes/:mailboxId/emails - Get emails for a specific mailbox
router.get(
  "/mailboxes/:mailboxId/emails",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { mailboxId } = req.params;
      const { page = "1", limit = "50" } = req.query;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      // Check if user has Gmail tokens
      const hasGmailToken = tokenStore.hasToken(userId);

      if (hasGmailToken) {
        try {
          // Fetch real Gmail messages
          const result = await gmailService.listMessages(
            userId,
            mailboxId,
            limitNum
          );

          // Fetch full details for each message
          const emailPromises = (result.messages || []).map(async (msg) => {
            const fullMessage = await gmailService.getMessage(userId, msg.id!);
            return parseGmailMessage(fullMessage, userId, mailboxId);
          });

          const mailboxEmails = await Promise.all(emailPromises);

          res.json({
            success: true,
            data: mailboxEmails,
            pagination: {
              page: pageNum,
              limit: limitNum,
              total: result.resultSizeEstimate || 0,
              nextPageToken: result.nextPageToken,
            },
          });
          return;
        } catch (error) {
          console.error("Gmail fetch error:", error);
          // Fall through to mock data on error
        }
      }

      // Fallback to mock data
      // Verify mailbox belongs to user
      const mailbox = mailboxesData.find(
        (m) => m.id === mailboxId && m.userId === userId
      );

      if (!mailbox) {
        res.status(404).json({
          success: false,
          message: "Mailbox not found",
        });
        return;
      }

      // Filter emails by mailbox and user
      const mailboxEmails = emails.filter(
        (email) => email.mailboxId === mailboxId && email.userId === userId
      );

      // Sort by timestamp (newest first)
      mailboxEmails.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Pagination
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedEmails = mailboxEmails.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: paginatedEmails,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: mailboxEmails.length,
          totalPages: Math.ceil(mailboxEmails.length / limitNum),
        },
      });
    } catch (error) {
      console.error("Get mailbox emails error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// GET /api/emails/:id - Get specific email by ID
router.get(
  "/emails/:id",
  async (req: Request, res: Response): Promise<void> => {
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
          const message = await gmailService.getMessage(userId, id);
          const labelIds = message.labelIds || [];
          const primaryLabel =
            labelIds.find((l) =>
              ["INBOX", "SENT", "DRAFT", "TRASH", "SPAM"].includes(l)
            ) || "INBOX";
          const email = parseGmailMessage(message, userId, primaryLabel);

          res.json({
            success: true,
            data: email,
          });
          return;
        } catch (error) {
          console.error("Gmail message fetch error:", error);
          // Fall through to mock data
        }
      }

      // Fallback to mock data
      const email = emails.find((e) => e.id === id && e.userId === userId);

      if (!email) {
        res.status(404).json({
          success: false,
          message: "Email not found",
        });
        return;
      }

      res.json({
        success: true,
        data: email,
      });
    } catch (error) {
      console.error("Get email error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// PATCH /api/emails/:id - Update email (mark as read/unread, star/unstar)
router.patch(
  "/emails/:id",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      const { isRead, isStarred } = req.body;

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
          const addLabelIds: string[] = [];
          const removeLabelIds: string[] = [];

          if (typeof isRead === "boolean") {
            if (isRead) {
              removeLabelIds.push("UNREAD");
            } else {
              addLabelIds.push("UNREAD");
            }
          }

          if (typeof isStarred === "boolean") {
            if (isStarred) {
              addLabelIds.push("STARRED");
            } else {
              removeLabelIds.push("STARRED");
            }
          }

          const result = await gmailService.modifyMessage(
            userId,
            id,
            addLabelIds,
            removeLabelIds
          );
          const message = await gmailService.getMessage(userId, id);
          const labelIds = message.labelIds || [];
          const primaryLabel =
            labelIds.find((l) =>
              ["INBOX", "SENT", "DRAFT", "TRASH", "SPAM"].includes(l)
            ) || "INBOX";
          const email = parseGmailMessage(message, userId, primaryLabel);

          res.json({
            success: true,
            data: email,
          });
          return;
        } catch (error) {
          console.error("Gmail modify error:", error);
          // Fall through to mock data
        }
      }

      // Fallback to mock data
      const emailIndex = emails.findIndex(
        (e) => e.id === id && e.userId === userId
      );

      if (emailIndex === -1) {
        res.status(404).json({
          success: false,
          message: "Email not found",
        });
        return;
      }

      // Update email properties
      if (typeof isRead === "boolean") {
        emails[emailIndex].isRead = isRead;
      }
      if (typeof isStarred === "boolean") {
        emails[emailIndex].isStarred = isStarred;
      }

      res.json({
        success: true,
        data: emails[emailIndex],
      });
    } catch (error) {
      console.error("Update email error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// POST /api/emails/send - Send an email
router.post(
  "/emails/send",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { to, subject, body, cc, inReplyTo } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      if (!to || !Array.isArray(to) || to.length === 0) {
        res.status(400).json({
          success: false,
          message: "Recipients required",
        });
        return;
      }

      // Check if user has Gmail tokens
      const hasGmailToken = tokenStore.hasToken(userId);

      if (hasGmailToken) {
        try {
          const tokenData = tokenStore.getToken(userId);

          // Extract email addresses from EmailAddress objects
          const toEmails = to.map((addr: any) =>
            typeof addr === "string" ? addr : addr.email
          );
          const ccEmails = cc
            ? cc.map((addr: any) =>
                typeof addr === "string" ? addr : addr.email
              )
            : undefined;

          const rawMessage = createRawEmail({
            from: tokenData!.email,
            to: toEmails,
            subject: subject || "(no subject)",
            body: body || "",
            cc: ccEmails,
            inReplyTo,
          });

          const result = await gmailService.sendMessage(userId, rawMessage);

          res.json({
            success: true,
            message: "Email sent successfully",
            data: result,
          });
          return;
        } catch (error) {
          console.error("Gmail send error:", error);
          res.status(500).json({
            success: false,
            message: "Failed to send email via Gmail",
          });
          return;
        }
      }

      // Mock mode - just return success
      res.json({
        success: true,
        message: "Email sent successfully (mock)",
      });
    } catch (error) {
      console.error("Send email error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// DELETE /api/emails/:id - Delete email (move to trash)
router.delete(
  "/emails/:id",
  async (req: Request, res: Response): Promise<void> => {
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
          await gmailService.trashMessage(userId, id);
          res.json({
            success: true,
            message: "Email moved to trash",
          });
          return;
        } catch (error) {
          console.error("Gmail trash error:", error);
          // Fall through to mock
        }
      }

      // Fallback to mock data
      const emailIndex = emails.findIndex(
        (e) => e.id === id && e.userId === userId
      );

      if (emailIndex === -1) {
        res.status(404).json({
          success: false,
          message: "Email not found",
        });
        return;
      }

      // Find trash mailbox
      const trashMailbox = mailboxesData.find(
        (m) => m.name === "Trash" && m.userId === userId
      );

      if (trashMailbox) {
        // Move to trash
        emails[emailIndex].mailboxId = trashMailbox.id;
      } else {
        // If no trash mailbox, actually delete
        emails.splice(emailIndex, 1);
      }

      res.json({
        success: true,
        message: "Email deleted successfully",
      });
    } catch (error) {
      console.error("Delete email error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// POST /api/emails/bulk-action - Bulk actions on multiple emails
router.post("/emails/bulk-action", (req: Request, res: Response): void => {
  try {
    const userId = req.user?.userId;
    const { emailIds, action, value } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    if (!Array.isArray(emailIds) || !action) {
      res.status(400).json({
        success: false,
        message: "Invalid request parameters",
      });
      return;
    }

    let updatedCount = 0;

    emailIds.forEach((emailId) => {
      const emailIndex = emails.findIndex(
        (e) => e.id === emailId && e.userId === userId
      );

      if (emailIndex !== -1) {
        switch (action) {
          case "markRead":
            emails[emailIndex].isRead = true;
            updatedCount++;
            break;
          case "markUnread":
            emails[emailIndex].isRead = false;
            updatedCount++;
            break;
          case "star":
            emails[emailIndex].isStarred = true;
            updatedCount++;
            break;
          case "unstar":
            emails[emailIndex].isStarred = false;
            updatedCount++;
            break;
          case "delete":
            const trashMailbox = mailboxesData.find(
              (m) => m.name === "Trash" && m.userId === userId
            );
            if (trashMailbox) {
              emails[emailIndex].mailboxId = trashMailbox.id;
              updatedCount++;
            }
            break;
        }
      }
    });

    res.json({
      success: true,
      message: `${updatedCount} email(s) updated`,
      updatedCount,
    });
  } catch (error) {
    console.error("Bulk action error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// GET /api/emails/:messageId/attachments/:attachmentId - Download attachment
router.get(
  "/emails/:messageId/attachments/:attachmentId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { messageId, attachmentId } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      // Check if user has Gmail tokens
      const hasGmailToken = tokenStore.hasToken(userId);

      if (!hasGmailToken) {
        res.status(400).json({
          success: false,
          message: "Gmail not connected",
        });
        return;
      }

      // Get attachment from Gmail
      const attachment = await gmailService.getAttachment(
        userId,
        messageId,
        attachmentId
      );

      if (!attachment.data) {
        res.status(404).json({
          success: false,
          message: "Attachment not found",
        });
        return;
      }

      // Decode base64url data
      const buffer = Buffer.from(attachment.data, "base64url");

      // Set appropriate headers
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="attachment_${attachmentId}"`
      );
      res.send(buffer);
    } catch (error) {
      console.error("Download attachment error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to download attachment",
      });
    }
  }
);

export default router;
