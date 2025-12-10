import mongoose, { Schema, Document } from "mongoose";

export interface EmailAddress {
  name?: string;
  email: string;
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

export interface IEmail extends Document {
  // Gmail identifiers
  emailId: string; // Gmail message ID
  threadId?: string; // Gmail thread ID

  // User association
  userId: string;

  // Email content (from Gmail)
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  body: string;
  bodySnippet?: string;
  timestamp: Date;

  // Attachments
  attachments: EmailAttachment[];

  // Labels/Mailbox
  labels: string[]; // Gmail labels
  mailboxId?: string;

  // Workflow status (custom field)
  status: "inbox" | "todo" | "done" | "snoozed";

  // Snooze feature
  snoozeUntil?: Date | null;

  // Flags
  isRead: boolean;
  isStarred: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const EmailAddressSchema = new Schema(
  {
    name: { type: String },
    email: { type: String, required: true },
  },
  { _id: false }
);

const EmailAttachmentSchema = new Schema(
  {
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    attachmentId: { type: String, required: true },
  },
  { _id: false }
);

const EmailSchema = new Schema<IEmail>(
  {
    // Gmail identifiers
    emailId: {
      type: String,
      required: true,
      index: true,
    },
    threadId: { type: String },

    // User association
    userId: {
      type: String,
      required: true,
      index: true,
    },

    // Email content
    subject: { type: String, required: true },
    from: { type: EmailAddressSchema, required: true },
    to: { type: [EmailAddressSchema], required: true },
    cc: { type: [EmailAddressSchema], default: [] },
    body: { type: String, required: true },
    bodySnippet: { type: String },
    timestamp: { type: Date, required: true, index: true },

    // Attachments
    attachments: { type: [EmailAttachmentSchema], default: [] },

    // Labels/Mailbox
    labels: { type: [String], default: [] },
    mailboxId: { type: String },

    // Workflow status
    status: {
      type: String,
      enum: ["inbox", "todo", "done", "snoozed"],
      default: "inbox",
      index: true,
    },

    // Snooze feature
    snoozeUntil: { type: Date, default: null },

    // Flags
    isRead: { type: Boolean, default: false },
    isStarred: { type: Boolean, default: false },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt
  }
);

// Compound indexes for efficient queries
EmailSchema.index({ emailId: 1, userId: 1 }, { unique: true });
EmailSchema.index({ userId: 1, status: 1 });
EmailSchema.index({ userId: 1, mailboxId: 1 });
EmailSchema.index({ userId: 1, timestamp: -1 });

const Email = mongoose.model<IEmail>("Email", EmailSchema);

export default Email;
