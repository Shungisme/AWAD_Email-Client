import mongoose, { Schema, Document } from "mongoose";

export interface KanbanColumn {
  id: string; // Column identifier (e.g., "inbox", "todo", custom IDs)
  title: string; // Display title
  color: string; // Tailwind color class (e.g., "bg-blue-500")
  icon: string; // Icon name from lucide-react (e.g., "Inbox", "Clock")
  gmailLabel?: string; // Gmail label to sync (e.g., "INBOX", "STARRED", custom label)
  order: number; // Display order
}

export interface IKanbanConfig extends Document {
  userId: string;
  columns: KanbanColumn[];
  createdAt: Date;
  updatedAt: Date;
}

const KanbanColumnSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    color: { type: String, required: true },
    icon: { type: String, required: true },
    gmailLabel: { type: String }, // Optional - for syncing with Gmail
    order: { type: Number, required: true },
  },
  { _id: false }
);

const KanbanConfigSchema = new Schema<IKanbanConfig>(
  {
    userId: {
      type: String,
      required: true,
      unique: true, // One config per user
      index: true,
    },
    columns: {
      type: [KanbanColumnSchema],
      required: true,
      default: [
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
          gmailLabel: "STARRED", // Map to starred emails
          order: 1,
        },
        {
          id: "done",
          title: "Done",
          color: "bg-green-500",
          icon: "CheckCircle",
          gmailLabel: undefined, // No Gmail label mapping
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
    },
  },
  {
    timestamps: true,
  }
);

const KanbanConfig = mongoose.model<IKanbanConfig>(
  "KanbanConfig",
  KanbanConfigSchema
);

export default KanbanConfig;
