import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  Settings,
  MoveUp,
  MoveDown,
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

const KanbanSettings: React.FC<KanbanSettingsProps> = ({
  isOpen,
  onClose,
  onConfigUpdated,
}) => {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
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
      setColumns(config.columns.sort((a, b) => a.order - b.order));
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

      await updateKanbanConfig(orderedColumns);
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
    const newColumn: KanbanColumn = {
      id: `custom-${Date.now()}`,
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
    value: any
  ) => {
    setColumns(
      columns.map((col) =>
        col.id === columnId ? { ...col, [field]: value } : col
      )
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
                          <MoveUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveColumn(column.id, "down")}
                          disabled={index === columns.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <MoveDown className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Title */}
                      <div className="col-span-3">
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
                                {color.replace("bg-", "").replace("-500", "")}
                              </option>
                            ))}
                          </select>
                          <div
                            className={`h-9 w-9 rounded ${column.color} flex-shrink-0`}
                          ></div>
                        </div>
                      </div>

                      {/* Icon */}
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Icon
                        </label>
                        <select
                          value={column.icon}
                          onChange={(e) =>
                            handleUpdateColumn(
                              column.id,
                              "icon",
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        >
                          {AVAILABLE_ICONS.map((icon) => (
                            <option key={icon} value={icon}>
                              {icon}
                            </option>
                          ))}
                        </select>
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
                          {GMAIL_LABELS.map((label) => (
                            <option key={label.value} value={label.value}>
                              {label.label}
                            </option>
                          ))}
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
