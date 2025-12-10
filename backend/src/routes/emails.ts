import express, { Request, Response } from "express";
import { Email, EmailStatus } from "../types";
import emailsData from "../data/emails.json";
import mailboxesData from "../data/mailboxes.json";
import { authMiddleware } from "../middleware/auth";
import gmailService from "../services/gmail";
import tokenStore from "../services/tokenStore";
import { parseGmailMessage, createRawEmail } from "../utils/emailParser";
import aiSummarization from "../services/aiSummarization";
import EmailModel from "../models/Email";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * Helper function to get email from DB or fetch from Gmail and save with AI summary
 * Falls back gracefully if MongoDB is not connected
 */
async function getOrCreateEmailFromGmail(
  userId: string,
  messageId: string,
  mailboxId: string
): Promise<Email> {
  // Try to check if email exists in MongoDB
  let existingEmail = null;
  try {
    existingEmail = await EmailModel.findOne({
      emailId: messageId,
      userId: userId,
    });

    if (existingEmail) {
      // Return existing email from DB (already has summary, status, etc.)
      return {
        id: existingEmail.emailId,
        userId: existingEmail.userId,
        mailboxId: existingEmail.mailboxId || mailboxId,
        from: existingEmail.from,
        to: existingEmail.to,
        cc: existingEmail.cc || [],
        subject: existingEmail.subject,
        body: existingEmail.body,
        preview:
          existingEmail.bodySnippet || existingEmail.body.substring(0, 150),
        timestamp: existingEmail.timestamp.toISOString(),
        isRead: existingEmail.isRead,
        isStarred: existingEmail.isStarred,
        attachments: existingEmail.attachments.map((att) => ({
          id: att.attachmentId,
          name: att.filename,
          size: att.size.toString(),
          type: att.mimeType,
        })),
        status: existingEmail.status,
        summary: null, // Summary not persisted, generated on-demand only
        snoozeUntil: existingEmail.snoozeUntil?.toISOString() || null,
        gmailLink: `https://mail.google.com/mail/u/0/#inbox/${existingEmail.emailId}`,
      } as Email;
    }
  } catch (error) {
    console.warn(
      "MongoDB query failed, fetching from Gmail without DB cache:",
      error
    );
    // Continue to fetch from Gmail
  }

  // Email doesn't exist in DB (or DB not available), fetch from Gmail
  const gmailMessage = await gmailService.getMessage(userId, messageId);
  const parsedEmail = parseGmailMessage(gmailMessage, userId, mailboxId);

  // Don't auto-generate AI summary - user will request it manually via button
  // This saves API calls and improves performance

  // Try to save to MongoDB (if connected)
  try {
    const labels = gmailMessage.labelIds || [];

    const newEmail = new EmailModel({
      emailId: parsedEmail.id,
      threadId: gmailMessage.threadId,
      userId: userId,
      subject: parsedEmail.subject,
      from: parsedEmail.from,
      to: parsedEmail.to,
      cc: parsedEmail.cc || [],
      body: parsedEmail.body,
      bodySnippet: parsedEmail.preview,
      timestamp: new Date(parsedEmail.timestamp),
      attachments: (parsedEmail.attachments || []).map((att) => ({
        filename: att.name,
        mimeType: att.type,
        size: parseInt(att.size) || 0,
        attachmentId: att.id || "",
      })),
      labels: labels,
      mailboxId: mailboxId,
      status: "inbox",
      isRead: parsedEmail.isRead,
      isStarred: parsedEmail.isStarred,
    });

    await newEmail.save();
    console.log(`Email ${parsedEmail.id} saved to MongoDB`);
  } catch (error) {
    console.warn(
      "Failed to save email to MongoDB, continuing without persistence:",
      error
    );
    // Continue anyway - user still gets the email from Gmail
  }

  return {
    ...parsedEmail,
    summary: null, // Summary will be generated on-demand
  };
}

// In-memory email store (initialized from JSON)
// Add default values for new fields
let emails = (emailsData as Email[]).map((email) => ({
  ...email,
  status: (email as any).status || ("inbox" as EmailStatus),
  snoozeUntil: (email as any).snoozeUntil || null,
  summary: (email as any).summary || null,
  gmailLink: (email as any).gmailLink || null,
}));

// Background job to check for expired snoozes every minute
setInterval(async () => {
  const now = new Date();
  try {
    // Find snoozed emails that have expired
    const expiredEmails = await EmailModel.find({
      status: "snoozed",
      snoozeUntil: { $lte: now },
    });

    // Restore them to inbox
    for (const email of expiredEmails) {
      email.status = "inbox";
      email.snoozeUntil = null;
      await email.save();
      console.log(`Email ${email.emailId} restored from snooze`);
    }
  } catch (error) {
    console.error("Error checking expired snoozes:", error);
  }
}, 60000); // Check every minute

// GET /api/mailboxes/:mailboxId/emails - Get emails for a specific mailbox
router.get(
  "/mailboxes/:mailboxId/emails",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      let { mailboxId } = req.params;
      const { page = "1", limit = "50" } = req.query;

      // Default to INBOX if mailboxId is empty
      if (!mailboxId || mailboxId.trim() === "") {
        mailboxId = "INBOX";
      }

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

          // Fetch or create emails from DB with AI summaries
          const emailPromises = (result.messages || []).map(async (msg) => {
            return getOrCreateEmailFromGmail(userId, msg.id!, mailboxId);
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

// PATCH /api/emails/:id/status - Update email status for Kanban workflow
router.patch(
  "/emails/:id/status",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      const { status } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const validStatuses: EmailStatus[] = ["inbox", "todo", "done", "snoozed"];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          message: "Invalid status. Must be one of: inbox, todo, done, snoozed",
        });
        return;
      }

      // Try to find email in MongoDB
      let emailDoc = await EmailModel.findOne({
        emailId: id,
        userId: userId,
      });

      // If not in DB, fetch from Gmail and create
      if (!emailDoc) {
        const hasGmailToken = tokenStore.hasToken(userId);

        if (hasGmailToken) {
          try {
            // Use helper to fetch and save
            const email = await getOrCreateEmailFromGmail(userId, id, "INBOX");

            // Update the status immediately
            emailDoc = await EmailModel.findOne({
              emailId: id,
              userId: userId,
            });
          } catch (error) {
            console.error("Failed to fetch Gmail email:", error);
            res.status(404).json({
              success: false,
              message: "Email not found",
            });
            return;
          }
        } else {
          res.status(404).json({
            success: false,
            message: "Email not found",
          });
          return;
        }
      }

      if (!emailDoc) {
        res.status(404).json({
          success: false,
          message: "Email not found",
        });
        return;
      }

      // Update status in MongoDB
      emailDoc.status = status;
      if (status !== "snoozed") {
        emailDoc.snoozeUntil = null;
      }
      await emailDoc.save();

      // Convert to Email type for response
      const updatedEmail: Email = {
        id: emailDoc.emailId,
        userId: emailDoc.userId,
        mailboxId: emailDoc.mailboxId || "INBOX",
        from: {
          name: emailDoc.from.name || emailDoc.from.email,
          email: emailDoc.from.email,
        },
        to: emailDoc.to.map((addr) => ({
          name: addr.name || addr.email,
          email: addr.email,
        })),
        cc: (emailDoc.cc || []).map((addr) => ({
          name: addr.name || addr.email,
          email: addr.email,
        })),
        subject: emailDoc.subject,
        body: emailDoc.body,
        preview: emailDoc.bodySnippet || emailDoc.body.substring(0, 150),
        timestamp: emailDoc.timestamp.toISOString(),
        isRead: emailDoc.isRead,
        isStarred: emailDoc.isStarred,
        attachments: emailDoc.attachments.map((att) => ({
          id: att.attachmentId,
          name: att.filename,
          size: att.size.toString(),
          type: att.mimeType,
        })),
        status: emailDoc.status,
        summary: null, // Summary not persisted
        snoozeUntil: emailDoc.snoozeUntil?.toISOString() || null,
        gmailLink: `https://mail.google.com/mail/u/0/#inbox/${emailDoc.emailId}`,
      };

      res.json({
        success: true,
        data: updatedEmail,
      });
    } catch (error) {
      console.error("Update email status error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// POST /api/emails/:id/snooze - Snooze an email until a specific time
router.post(
  "/emails/:id/snooze",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      const { snoozeUntil } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      if (!snoozeUntil) {
        res.status(400).json({
          success: false,
          message: "snoozeUntil date is required",
        });
        return;
      }

      const snoozeDate = new Date(snoozeUntil);
      if (isNaN(snoozeDate.getTime()) || snoozeDate <= new Date()) {
        res.status(400).json({
          success: false,
          message: "snoozeUntil must be a valid future date",
        });
        return;
      }

      // Find email in MongoDB
      const emailDoc = await EmailModel.findOne({
        emailId: id,
        userId: userId,
      });

      if (!emailDoc) {
        res.status(404).json({
          success: false,
          message: "Email not found",
        });
        return;
      }

      // Update snooze in MongoDB
      emailDoc.status = "snoozed";
      emailDoc.snoozeUntil = snoozeDate;
      await emailDoc.save();

      // Convert to Email type for response
      const updatedEmail: Email = {
        id: emailDoc.emailId,
        userId: emailDoc.userId,
        mailboxId: emailDoc.mailboxId || "INBOX",
        from: {
          name: emailDoc.from.name || emailDoc.from.email,
          email: emailDoc.from.email,
        },
        to: emailDoc.to.map((addr) => ({
          name: addr.name || addr.email,
          email: addr.email,
        })),
        cc: (emailDoc.cc || []).map((addr) => ({
          name: addr.name || addr.email,
          email: addr.email,
        })),
        subject: emailDoc.subject,
        body: emailDoc.body,
        preview: emailDoc.bodySnippet || emailDoc.body.substring(0, 150),
        timestamp: emailDoc.timestamp.toISOString(),
        isRead: emailDoc.isRead,
        isStarred: emailDoc.isStarred,
        attachments: emailDoc.attachments.map((att) => ({
          id: att.attachmentId,
          name: att.filename,
          size: att.size.toString(),
          type: att.mimeType,
        })),
        status: emailDoc.status,
        summary: null, // Summary not persisted
        snoozeUntil: emailDoc.snoozeUntil?.toISOString() || null,
        gmailLink: `https://mail.google.com/mail/u/0/#inbox/${emailDoc.emailId}`,
      };

      res.json({
        success: true,
        data: updatedEmail,
        message: `Email snoozed until ${snoozeDate.toLocaleString()}`,
      });
    } catch (error) {
      console.error("Snooze email error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// POST /api/emails/:id/summarize - Generate AI summary for an email (on-demand)
router.post(
  "/emails/:id/summarize",
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

      // Try to find email in MongoDB first
      let email = null;
      let emailDoc = null;

      try {
        emailDoc = await EmailModel.findOne({
          emailId: id,
          userId: userId,
        });

        if (emailDoc) {
          email = {
            id: emailDoc.emailId,
            subject: emailDoc.subject,
            body: emailDoc.body,
          };
        }
      } catch (error) {
        console.warn("MongoDB query failed, falling back to in-memory:", error);
      }

      // Fallback to in-memory emails
      if (!email) {
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

        email = emails[emailIndex];
      }

      // Generate summary using AI (ephemeral - not saved to DB)
      console.log(`Generating AI summary for email ${id}...`);
      const summary = await aiSummarization.generateSummary(
        email.body,
        email.subject
      );

      console.log(`✓ Summary generated for email ${id} (not persisted)`);

      // Return summary without saving to database
      res.json({
        success: true,
        data: {
          id: email.id,
          summary,
        },
      });
    } catch (error) {
      console.error("Summarize email error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate summary. Please try again.",
      });
    }
  }
);

// POST /api/emails/batch-summarize - Generate summaries for multiple emails
router.post(
  "/emails/batch-summarize",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { emailIds } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      if (!Array.isArray(emailIds) || emailIds.length === 0) {
        res.status(400).json({
          success: false,
          message: "emailIds array is required",
        });
        return;
      }

      // Try to find emails in MongoDB
      let emailDocs = [];
      try {
        emailDocs = await EmailModel.find({
          emailId: { $in: emailIds },
          userId: userId,
        });
      } catch (error) {
        console.warn("MongoDB query failed for batch-summarize:", error);
        res.status(500).json({
          success: false,
          message: "Database error. Please ensure MongoDB is running.",
        });
        return;
      }

      if (emailDocs.length === 0) {
        res.status(404).json({
          success: false,
          message: "No emails found in database",
        });
        return;
      }

      // Generate summaries in batch (ephemeral - not saved to DB)
      const summaries = await aiSummarization.batchSummarize(
        emailDocs.map((doc) => ({ body: doc.body, subject: doc.subject }))
      );

      // Return summaries without saving to database
      const results = emailDocs.map((doc, index) => ({
        id: doc.emailId,
        summary: summaries[index],
      }));

      console.log(`✓ Generated ${results.length} summaries (not persisted)`);

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error("Batch summarize error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// GET /api/emails/by-status/:status - Get emails by status (for Kanban view)
router.get(
  "/emails/by-status/:status",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { status } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const validStatuses: EmailStatus[] = ["inbox", "todo", "done", "snoozed"];
      if (!validStatuses.includes(status as EmailStatus)) {
        res.status(400).json({
          success: false,
          message: "Invalid status",
        });
        return;
      }

      // Auto-expire snoozed emails that have passed their snoozeUntil time
      try {
        const result = await EmailModel.updateMany(
          {
            userId: userId,
            status: "snoozed",
            snoozeUntil: { $lt: new Date() },
          },
          {
            $set: {
              status: "inbox",
              snoozeUntil: null,
            },
          }
        );

        if (result.modifiedCount > 0) {
          console.log(
            `✓ Auto-expired ${result.modifiedCount} snoozed email(s) back to inbox for user ${userId}`
          );
        }
      } catch (error) {
        console.warn("Failed to auto-expire snoozes:", error);
        // Continue even if auto-expire fails
      }

      // Query MongoDB for emails with this status
      let dbEmails = [];
      try {
        dbEmails = await EmailModel.find({
          userId: userId,
          status: status,
        })
          .sort({ timestamp: -1 })
          .limit(100);
      } catch (error) {
        console.warn(
          "MongoDB query failed for by-status, returning empty:",
          error
        );
        // Return empty array if MongoDB not available
        res.json({
          success: true,
          data: [],
        });
        return;
      }

      // Convert to Email type
      const emailsData: Email[] = dbEmails.map((doc) => ({
        id: doc.emailId,
        userId: doc.userId,
        mailboxId: doc.mailboxId || "INBOX",
        from: {
          name: doc.from.name || doc.from.email,
          email: doc.from.email,
        },
        to: doc.to.map((addr) => ({
          name: addr.name || addr.email,
          email: addr.email,
        })),
        cc: (doc.cc || []).map((addr) => ({
          name: addr.name || addr.email,
          email: addr.email,
        })),
        subject: doc.subject,
        body: doc.body,
        preview: doc.bodySnippet || doc.body.substring(0, 150),
        timestamp: doc.timestamp.toISOString(),
        isRead: doc.isRead,
        isStarred: doc.isStarred,
        attachments: doc.attachments.map((att) => ({
          id: att.attachmentId,
          name: att.filename,
          size: att.size.toString(),
          type: att.mimeType,
        })),
        status: doc.status,
        summary: null, // Summary is not persisted, generated on-demand only
        snoozeUntil: doc.snoozeUntil?.toISOString() || null,
        gmailLink: `https://mail.google.com/mail/u/0/#inbox/${doc.emailId}`,
      }));

      res.json({
        success: true,
        data: emailsData,
      });
    } catch (error) {
      console.error("Get emails by status error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

export default router;
