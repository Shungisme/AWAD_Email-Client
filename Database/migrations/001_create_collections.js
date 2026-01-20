/**
 * Migration Script: Create Collections and Indexes
 * Database: email-dashboard
 * Description: Creates the necessary collections and indexes for the Email Client application
 */

// Connect to the database
const db = db.getSiblingDB('email-dashboard');

print("=================================");
print("Starting Migration: Create Collections");
print("=================================\n");

// 1. Create Users Collection
print("1. Creating 'users' collection...");
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "name"],
      properties: {
        email: {
          bsonType: "string",
          description: "User's email address - required and must be unique"
        },
        password: {
          bsonType: "string",
          description: "Hashed password - optional for OAuth users"
        },
        name: {
          bsonType: "string",
          description: "User's display name - required"
        },
        googleId: {
          bsonType: ["string", "null"],
          description: "Google OAuth ID - optional"
        },
        latestHistoryId: {
          bsonType: "string",
          description: "Gmail API history ID for sync - optional"
        },
        createdAt: {
          bsonType: "date",
          description: "Account creation timestamp"
        },
        updatedAt: {
          bsonType: "date",
          description: "Last update timestamp"
        }
      }
    }
  }
});

// Create indexes for users collection
db.users.createIndex({ email: 1 }, { unique: true, name: "email_unique_idx" });
db.users.createIndex({ googleId: 1 }, { unique: true, sparse: true, name: "googleId_unique_idx" });
print("✓ Users collection created with indexes\n");

// 2. Create Emails Collection
print("2. Creating 'emails' collection...");
db.createCollection("emails", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["emailId", "userId", "subject", "from", "to", "body", "timestamp", "labels", "status", "isRead", "isStarred"],
      properties: {
        emailId: {
          bsonType: "string",
          description: "Gmail message ID - required"
        },
        threadId: {
          bsonType: "string",
          description: "Gmail thread ID - optional"
        },
        userId: {
          bsonType: "string",
          description: "Owner user ID - required"
        },
        subject: {
          bsonType: "string",
          description: "Email subject - required"
        },
        from: {
          bsonType: "object",
          required: ["email"],
          properties: {
            name: { bsonType: "string" },
            email: { bsonType: "string" }
          }
        },
        to: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["email"],
            properties: {
              name: { bsonType: "string" },
              email: { bsonType: "string" }
            }
          }
        },
        cc: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["email"],
            properties: {
              name: { bsonType: "string" },
              email: { bsonType: "string" }
            }
          }
        },
        body: {
          bsonType: "string",
          description: "Email body content - required"
        },
        bodySnippet: {
          bsonType: "string",
          description: "Short preview of email body - optional"
        },
        timestamp: {
          bsonType: "date",
          description: "Email send/receive timestamp - required"
        },
        attachments: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["filename", "mimeType", "size", "attachmentId"],
            properties: {
              filename: { bsonType: "string" },
              mimeType: { bsonType: "string" },
              size: { bsonType: "number" },
              attachmentId: { bsonType: "string" }
            }
          }
        },
        labels: {
          bsonType: "array",
          items: { bsonType: "string" },
          description: "Gmail labels - required"
        },
        mailboxId: {
          bsonType: "string",
          description: "Mailbox/folder ID - optional"
        },
        status: {
          bsonType: "string",
          description: "Kanban workflow status - required"
        },
        snoozeUntil: {
          bsonType: ["date", "null"],
          description: "Snooze until timestamp - optional"
        },
        isRead: {
          bsonType: "bool",
          description: "Read status - required"
        },
        isStarred: {
          bsonType: "bool",
          description: "Starred status - required"
        },
        embedding: {
          bsonType: "array",
          items: { bsonType: "number" },
          description: "Vector embedding for semantic search - optional"
        },
        embeddingModel: {
          bsonType: "string",
          description: "Model used for embedding - optional"
        },
        embeddingDim: {
          bsonType: "number",
          description: "Embedding vector dimension - optional"
        },
        embeddingCreatedAt: {
          bsonType: "date",
          description: "Embedding generation timestamp - optional"
        },
        createdAt: {
          bsonType: "date"
        },
        updatedAt: {
          bsonType: "date"
        }
      }
    }
  }
});

// Create indexes for emails collection
db.emails.createIndex({ emailId: 1 }, { name: "emailId_idx" });
db.emails.createIndex({ userId: 1 }, { name: "userId_idx" });
db.emails.createIndex({ userId: 1, timestamp: -1 }, { name: "userId_timestamp_idx" });
db.emails.createIndex({ userId: 1, status: 1 }, { name: "userId_status_idx" });
db.emails.createIndex({ userId: 1, labels: 1 }, { name: "userId_labels_idx" });
db.emails.createIndex({ userId: 1, isStarred: 1 }, { name: "userId_starred_idx" });
db.emails.createIndex({ snoozeUntil: 1 }, { name: "snoozeUntil_idx", sparse: true });
print("✓ Emails collection created with indexes\n");

// 3. Create Kanban Configs Collection
print("3. Creating 'kanbanconfigs' collection...");
db.createCollection("kanbanconfigs", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "columns"],
      properties: {
        userId: {
          bsonType: "string",
          description: "User ID - required and must be unique"
        },
        columns: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["id", "status", "title", "color", "icon", "order"],
            properties: {
              id: { bsonType: "string" },
              status: { bsonType: "string" },
              title: { bsonType: "string" },
              color: { bsonType: "string" },
              icon: { bsonType: "string" },
              gmailLabel: { bsonType: "string" },
              order: { bsonType: "number" }
            }
          },
          description: "Kanban board columns configuration - required"
        },
        createdAt: {
          bsonType: "date"
        },
        updatedAt: {
          bsonType: "date"
        }
      }
    }
  }
});

// Create indexes for kanbanconfigs collection
db.kanbanconfigs.createIndex({ userId: 1 }, { unique: true, name: "userId_unique_idx" });
print("✓ Kanban configs collection created with indexes\n");

print("=================================");
print("Migration completed successfully!");
print("=================================");
print("\nCollections created:");
print("  - users (with email and googleId indexes)");
print("  - emails (with emailId, userId, and composite indexes)");
print("  - kanbanconfigs (with userId index)");
