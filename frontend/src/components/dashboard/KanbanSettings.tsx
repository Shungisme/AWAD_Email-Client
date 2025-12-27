import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  Settings,
  Inbox,
  Clock,
  CheckCircle,
  Star,
  Archive,
  Mail,
  Send,
  AlertCircle,
  Zap,
  Target,
  Flag,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { KanbanColumn } from "../../api/kanban.api";
import { getKanbanConfig, updateKanbanConfig } from "../../api/kanban.api";

interface KanbanSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated: () => void;
}

const AVAILABLE_ICONS = [
  "Inbox",
  "Clock",
  "CheckCircle",
  "Star",
  "Archive",
  "Mail",
  "Send",
  "AlertCircle",
  "Zap",
  "Target",
  "Flag",
];

const AVAILABLE_COLORS = [
  "bg-blue-500",
  "bg-yellow-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-red-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-gray-500",
];

const ICON_COMPONENTS: Record<string, React.ReactNode> = {
  Inbox: <Inbox className="w-5 h-5 text-white" />,
  Clock: <Clock className="w-5 h-5 text-white" />,
  CheckCircle: <CheckCircle className="w-5 h-5 text-white" />,
  Star: <Star className="w-5 h-5 text-white" />,
  Archive: <Archive className="w-5 h-5 text-white" />,
  Mail: <Mail className="w-5 h-5 text-white" />,
  Send: <Send className="w-5 h-5 text-white" />,
  AlertCircle: <AlertCircle className="w-5 h-5 text-white" />,
  Zap: <Zap className="w-5 h-5 text-white" />,
  Target: <Target className="w-5 h-5 text-white" />,
  Flag: <Flag className="w-5 h-5 text-white" />,
};

const GMAIL_LABELS = [
  { value: "INBOX", label: "Inbox" },
  { value: "STARRED", label: "Starred" },
  { value: "SENT", label: "Sent" },
  { value: "DRAFT", label: "Draft" },
  { value: "IMPORTANT", label: "Important" },
  { value: "TRASH", label: "Trash" },
  { value: "SPAM", label: "Spam" },
  { value: "", label: "None" },
];

/**
 * Generate a slug from a title or Gmail label for use as status identifier
 * Example: "Sent Mail" -> "sent-mail", "INBOX" -> "inbox"
 */
const generateSlugFromTitle = (title: string): string => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
};

/**
 * Generate a unique status identifier from Gmail label or title
 * Priority: Gmail label > Title
 */
const generateUniqueStatus = (
  gmailLabel: string | undefined,
  title: string,
  columns: KanbanColumn[],
  excludeId?: string
): string => {
  // Priority 1: Use Gmail label if available
  const baseStatus = gmailLabel
    ? generateSlugFromTitle(gmailLabel)
    : generateSlugFromTitle(title);

  // Check if status is unique
  let status = baseStatus;
  let counter = 1;

  while (columns.some((col) => col.status === status && col.id !== excludeId)) {
    status = `${baseStatus}-${counter}`;
    counter++;
  }

  return status;
};

/**
 * Generate a UUID for column ID (React key purposes only)
 */
const generateColumnId = (): string => {
  return `col-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Check if a Gmail label is already used by another column
 */
const isGmailLabelUsed = (
  gmailLabel: string,
  columns: KanbanColumn[],
  excludeColumnId?: string
): boolean => {
  return columns.some(
    (col) => col.gmailLabel === gmailLabel && col.id !== excludeColumnId
  );
};

const KanbanSettings: React.FC<KanbanSettingsProps> = ({
  isOpen,
  onClose,
  onConfigUpdated,
}) => {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [originalStatuses, setOriginalStatuses] = useState<
    Record<string, string>
  >({}); // Track original statuses for migration
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const config = await getKanbanConfig();
      const sortedColumns = config.columns.sort((a, b) => a.order - b.order);

      // Migration: Add status field for old columns that don't have it
      const migratedColumns = sortedColumns.map((col) => {
        if (!col.status) {
          // Copy current id to status, generate new UUID for id
          return {
            ...col,
            status: col.id,
            id: generateColumnId(),
          };
        }
        return col;
      });

      // Store original statuses for migration tracking
      const statuses: Record<string, string> = {};
      migratedColumns.forEach((col) => {
        statuses[col.id] = col.status;
      });
      setOriginalStatuses(statuses);

      setColumns(migratedColumns);
    } catch (error) {
      console.error("Failed to load Kanban config:", error);
      setError("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Ensure order values are sequential
      const orderedColumns = columns.map((col, index) => ({
        ...col,
        order: index,
      }));

      // Build status migration map: { oldStatus: newStatus }
      const statusMigrations: Record<string, string> = {};
      orderedColumns.forEach((col) => {
        const originalStatus = originalStatuses[col.id];
        if (originalStatus && originalStatus !== col.status) {
          statusMigrations[originalStatus] = col.status;
          console.log(
            `📝 Status migration: "${originalStatus}" → "${col.status}"`
          );
        }
      });

      await updateKanbanConfig(orderedColumns, statusMigrations);
      onConfigUpdated();
      onClose();
    } catch (error) {
      console.error("Failed to save Kanban config:", error);
      setError("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleAddColumn = () => {
    const newColumnId = generateColumnId();
    const newColumn: KanbanColumn = {
      id: newColumnId,
      status: `new-status-${Date.now()}`, // Temporary, will be updated on save
      title: "New Column",
      color: "bg-blue-500",
      icon: "Inbox",
      gmailLabel: undefined,
      order: columns.length,
    };
    setColumns([...columns, newColumn]);
  };

  const handleDeleteColumn = (columnId: string) => {
    if (columns.length <= 1) {
      alert("You must have at least one column!");
      return;
    }
    if (confirm("Are you sure you want to delete this column?")) {
      setColumns(columns.filter((col) => col.id !== columnId));
    }
  };

  const handleUpdateColumn = (
    columnId: string,
    field: keyof KanbanColumn,
    value: string | undefined
  ) => {
    // Validate Gmail label uniqueness
    if (field === "gmailLabel" && value && value !== "") {
      if (isGmailLabelUsed(value, columns, columnId)) {
        alert(
          `Gmail label "${value}" is already used by another column. Each Gmail label can only be mapped to one column.`
        );
        return;
      }
    }

    setColumns(
      columns.map((col) => {
        if (col.id === columnId) {
          const updatedCol = { ...col, [field]: value };

          // If updating Gmail label or title, regenerate status
          if (field === "gmailLabel" || field === "title") {
            const newGmailLabel =
              field === "gmailLabel" ? value : col.gmailLabel;
            const newTitle = field === "title" ? (value || col.title) : col.title;
            updatedCol.status = generateUniqueStatus(
              newGmailLabel,
              newTitle,
              columns,
              col.id
            );
          }

          return updatedCol;
        }
        return col;
      })
    );
  };

  const handleMoveColumn = (columnId: string, direction: "up" | "down") => {
    const index = columns.findIndex((col) => col.id === columnId);
    if (index === -1) return;

    const newColumns = [...columns];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= columns.length) return;

    // Swap columns
    [newColumns[index], newColumns[targetIndex]] = [
      newColumns[targetIndex],
      newColumns[index],
    ];

    setColumns(newColumns);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Kanban Board Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}

              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  Customize your Kanban board columns. Map columns to Gmail
                  labels to automatically sync email labels when you move cards.
                </p>
              </div>

              <div className="space-y-4">
                {columns.map((column, index) => (
                  <div
                    key={column.id}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Order Controls */}
                      <div className="col-span-1 flex flex-col gap-1">
                        <button
                          onClick={() => handleMoveColumn(column.id, "up")}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronUp className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleMoveColumn(column.id, "down")}
                          disabled={index === columns.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronDown className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Title */}
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={column.title}
                          onChange={(e) =>
                            handleUpdateColumn(
                              column.id,
                              "title",
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      {/* Color */}
                      <div className="col-span-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Color
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={column.color}
                            onChange={(e) =>
                              handleUpdateColumn(
                                column.id,
                                "color",
                                e.target.value
                              )
                            }
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          >
                            {AVAILABLE_COLORS.map((color) => (
                              <option key={color} value={color}>
                                {color.replace("bg-", "").replace("-500", "").replace(/^\w/, c => c.toUpperCase())}
                              </option>
                            ))}
                          </select>
                          <div
                            className={`h-9 w-9 rounded ${column.color} flex-shrink-0`}
                          ></div>
                        </div>
                      </div>

                      {/* Icon */}
                      <div className="col-span-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Icon
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={column.icon}
                            onChange={(e) =>
                              handleUpdateColumn(
                                column.id,
                                "icon",
                                e.target.value
                              )
                            }
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          >
                            {AVAILABLE_ICONS.map((icon) => (
                              <option key={icon} value={icon}>
                                {icon}
                              </option>
                            ))}
                          </select>

                          <div className={`h-9 w-9 rounded ${column.color} border flex items-center justify-center flex-shrink-0`}>
                            {ICON_COMPONENTS[column.icon] || (
                              <div className="text-gray-400 text-xs">?</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Gmail Label */}
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Gmail Label
                        </label>
                        <select
                          value={column.gmailLabel || ""}
                          onChange={(e) =>
                            handleUpdateColumn(
                              column.id,
                              "gmailLabel",
                              e.target.value || undefined
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        >
                          {GMAIL_LABELS.map((label) => {
                            const isUsed =
                              !!label.value &&
                              isGmailLabelUsed(label.value, columns, column.id);
                            return (
                              <option
                                key={label.value || "none"}
                                value={label.value}
                                disabled={isUsed}
                                style={
                                  isUsed
                                    ? { color: "#999", fontStyle: "italic" }
                                    : undefined
                                }
                              >
                                {label.label}
                                {isUsed ? " (Already used)" : ""}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Delete Button */}
                      <div className="col-span-1 flex justify-end">
                        <button
                          onClick={() => handleDeleteColumn(column.id)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          title="Delete column"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddColumn}
                className="mt-6 w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Column
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KanbanSettings;
