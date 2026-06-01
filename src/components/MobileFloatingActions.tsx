import React, { useState, useRef, useEffect } from "react";

interface MobileFloatingActionsProps {
  onSelectStructure: (structureId: string, isStructure: boolean) => void;
  visible: boolean;
}

const SPEED_DIAL_ACTIONS = [
  { id: "raised-bed", label: "Raised Bed", emoji: "🟫" },
  { id: "growing-bed", label: "Growing Bed", emoji: "🌱" },
  { id: "greenhouse", label: "Greenhouse", emoji: "🏠" },
  { id: "path", label: "Path", emoji: "🧱" },
];

const MobileFloatingActions: React.FC<MobileFloatingActionsProps> = ({
  onSelectStructure,
  visible,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) {
      setIsOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        isOpen &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const handleActionSelect = (structureId: string) => {
    navigator.vibrate?.(10);
    onSelectStructure(structureId, true);
    setIsOpen(false);
  };

  const handleMainButtonTap = () => {
    navigator.vibrate?.(10);
    setIsOpen((prev) => !prev);
  };

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className="fixed bottom-24 right-4 z-[25] flex flex-col items-end gap-3 lg:hidden"
    >
      {/* Speed-dial actions */}
      <div className="flex flex-col items-end gap-2">
        {SPEED_DIAL_ACTIONS.map((action, index) => (
          <div
            key={action.id}
            className="flex items-center gap-2 transition-all duration-200 ease-out"
            style={{
              opacity: isOpen ? 1 : 0,
              transform: isOpen
                ? "scale(1) translateY(0)"
                : "scale(0.5) translateY(16px)",
              transitionDelay: isOpen ? `${index * 50}ms` : "0ms",
              pointerEvents: isOpen ? "auto" : "none",
            }}
          >
            {/* Label pill */}
            <span className="bg-card text-xs px-2 py-1 rounded shadow text-foreground whitespace-nowrap">
              {action.label}
            </span>
            {/* Action button */}
            <button
              type="button"
              onClick={() => handleActionSelect(action.id)}
              className="w-12 h-12 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-lg active:scale-95 transition-transform"
              aria-label={action.label}
            >
              {action.emoji}
            </button>
          </div>
        ))}
      </div>

      {/* Main FAB button */}
      <button
        type="button"
        onClick={handleMainButtonTap}
        className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center text-2xl active:scale-95 transition-transform"
        aria-label={isOpen ? "Close menu" : "Add structure"}
      >
        <span
          className="inline-block transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}
        >
          +
        </span>
      </button>
    </div>
  );
};

export default MobileFloatingActions;
