import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardHelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const KeyboardHelpOverlay: React.FC<KeyboardHelpOverlayProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    {
      category: "Global Navigation",
      items: [
        { keys: ["g", "i"], description: "Go to Inbox" },
        { keys: ["g", "s"], description: "Go to Sent" },
        { keys: ["g", "d"], description: "Go to Drafts" },
        { keys: ["/"], description: "Search" },
        { keys: ["?"], description: "Show this help" },
      ]
    },
    {
      category: "Inbox List",
      items: [
        { keys: ["j", "↓"], description: "Next email" },
        { keys: ["k", "↑"], description: "Previous email" },
        { keys: ["Enter", "o"], description: "Open email" },
        { keys: ["u", "Esc"], description: "Close email / Back" },
        { keys: ["#", "Del"], description: "Delete" },
        { keys: ["e"], description: "Archive" },
        { keys: ["r"], description: "Mark as Read" },
        { keys: ["Shift", "r"], description: "Mark as Unread" },
        { keys: ["s"], description: "Toggle Star" },
      ]
    },
    {
      category: "Message View",
      items: [
        { keys: ["j"], description: "Next email" },
        { keys: ["k"], description: "Previous email" },
        { keys: ["r"], description: "Reply" },
        { keys: ["a"], description: "Reply All" },
        { keys: ["f"], description: "Forward" },
        { keys: ["s"], description: "Toggle Star" },
        { keys: ["Space"], description: "Scroll Down" },
        { keys: ["Shift", "Space"], description: "Scroll Up" },
      ]
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Keyboard className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-lg font-semibold text-blue-600 mb-4">{section.category}</h3>
              <ul className="space-y-3">
                {section.items.map((item, idx) => (
                  <li key={idx} className="flex justify-between items-center">
                    <span className="text-gray-700 dark:text-gray-300 text-sm">{item.description}</span>
                    <div className="flex gap-1">
                      {item.keys.map((key, kIdx) => (
                        <kbd key={kIdx} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono text-gray-800 dark:text-gray-200 min-w-[24px] text-center shadow-sm">
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Shortcuts are disabled when typing in input fields.
            </p>
        </div>
      </div>
    </div>
  );
};

export default KeyboardHelpOverlay;
