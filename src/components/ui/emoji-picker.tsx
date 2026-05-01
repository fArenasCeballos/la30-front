import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "🍔 Comida",
    emojis: [
      "🍔",
      "🌭",
      "🍕",
      "🌮",
      "🌯",
      "🥪",
      "🥙",
      "🧆",
      "🥗",
      "🥘",
      "🍝",
      "🍜",
      "🍲",
      "🍛",
      "🍣",
      "🍱",
      "🥟",
      "🍤",
      "🍙",
      "🍚",
      "🍘",
      "🍥",
      "🥠",
      "🥮",
      "🍢",
      "🍡",
      "🍧",
      "🍨",
      "🍦",
      "🥧",
      "🧁",
      "🍰",
      "🎂",
      "🍮",
      "🍭",
      "🍬",
      "🍫",
      "🍿",
      "🧈",
      "🥞",
      "🧇",
      "🥓",
      "🥩",
      "🍗",
      "🍖",
      "🫔",
      "🧀",
      "🥚",
      "🍳",
      "🥐",
      "🥖",
      "🫓",
      "🍞",
      "🥯",
      "🥨",
      "🫕",
      "🥣",
      "🫙",
      "🥫",
    ],
  },
  {
    label: "🍎 Frutas y Verduras",
    emojis: [
      "🍎",
      "🍏",
      "🍐",
      "🍊",
      "🍋",
      "🍌",
      "🍉",
      "🍇",
      "🍓",
      "🫐",
      "🍈",
      "🍒",
      "🍑",
      "🥭",
      "🍍",
      "🥥",
      "🥝",
      "🍅",
      "🫒",
      "🥑",
      "🍆",
      "🌶️",
      "🫑",
      "🥒",
      "🥬",
      "🥦",
      "🧄",
      "🧅",
      "🥕",
      "🌽",
      "🥔",
      "🍠",
      "🫘",
      "🥜",
      "🌰",
      "🫚",
      "🫛",
      "🍄",
    ],
  },
  {
    label: "🥤 Bebidas",
    emojis: [
      "☕",
      "🫖",
      "🍵",
      "🧃",
      "🥤",
      "🧋",
      "🍶",
      "🍺",
      "🍻",
      "🥂",
      "🍷",
      "🍸",
      "🍹",
      "🍾",
      "🧊",
      "🥛",
      "🫗",
      "🍼",
    ],
  },
  {
    label: "⭐ Símbolos",
    emojis: [
      "⭐",
      "🌟",
      "✨",
      "💫",
      "🔥",
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🤍",
      "🖤",
      "💯",
      "✅",
      "❌",
      "⚡",
      "🎯",
      "🏷️",
      "📌",
      "🔖",
      "🎉",
      "🎊",
      "👑",
      "💎",
      "🏆",
      "🥇",
      "🥈",
      "🥉",
      "🎁",
      "🎀",
      "🎈",
    ],
  },
  {
    label: "🍽️ Restaurante",
    emojis: [
      "🍽️",
      "🥄",
      "🍴",
      "🥢",
      "🔪",
      "🫙",
      "🧂",
      "🫗",
      "🏪",
      "🛒",
      "📦",
      "🧊",
      "♨️",
      "🛎️",
      "🧑‍🍳",
      "👨‍🍳",
      "👩‍🍳",
      "🤌",
      "👍",
      "👎",
      "🚫",
      "⏱️",
      "📋",
      "🗒️",
    ],
  },
  {
    label: "🐾 Otros",
    emojis: [
      "🐔",
      "🐷",
      "🐮",
      "🐟",
      "🦐",
      "🦀",
      "🦞",
      "🐙",
      "🦑",
      "🦪",
      "🌿",
      "🌱",
      "🌾",
      "🌻",
      "🍀",
      "🎋",
      "🎍",
      "🌈",
      "☀️",
      "🌙",
      "💪",
      "🤤",
      "😋",
      "🤩",
      "😍",
      "🥰",
    ],
  },
];

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  placeholder?: string;
}

function ScrollableContainer({
  children,
  className,
  axis = "both",
}: {
  children: React.ReactNode;
  className?: string;
  axis?: "x" | "y" | "both";
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const el = ref.current;

    const startX = e.pageX - el.offsetLeft;
    const startY = e.pageY - el.offsetTop;
    const scrollLeft = el.scrollLeft;
    const scrollTop = el.scrollTop;

    let isDragging = false;

    const handleMouseMove = (ev: MouseEvent) => {
      ev.preventDefault();
      const x = ev.pageX - el.offsetLeft;
      const y = ev.pageY - el.offsetTop;

      const walkX = axis === "x" || axis === "both" ? (x - startX) * 1.5 : 0;
      const walkY = axis === "y" || axis === "both" ? (y - startY) * 1.5 : 0;

      if (Math.abs(walkX) > 5 || Math.abs(walkY) > 5) {
        isDragging = true;
      }

      if (axis === "x" || axis === "both") el.scrollLeft = scrollLeft - walkX;
      if (axis === "y" || axis === "both") el.scrollTop = scrollTop - walkY;
    };

    const handleMouseUp = () => {
      if (isDragging) {
        const preventClick = (clickEv: MouseEvent) => {
          clickEv.stopPropagation();
          clickEv.preventDefault();
        };
        window.addEventListener("click", preventClick, {
          capture: true,
          once: true,
        });
        setTimeout(
          () =>
            window.removeEventListener("click", preventClick, {
              capture: true,
            }),
          50,
        );
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      className={cn("cursor-grab active:cursor-grabbing", className)}
      style={{
        touchAction: axis === "x" ? "pan-x" : axis === "y" ? "pan-y" : "auto",
      }}
    >
      {children}
    </div>
  );
}

export function EmojiPicker({
  value,
  onChange,
  placeholder = "🍔",
}: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(0);

  const allEmojis = EMOJI_CATEGORIES.flatMap((cat) => cat.emojis);
  const filtered = search
    ? allEmojis.filter((e) => e.includes(search))
    : EMOJI_CATEGORIES[activeCategory]?.emojis || [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full h-12 text-3xl justify-center hover:bg-muted/50 transition-all"
          type="button"
        >
          {value || (
            <span className="text-muted-foreground text-sm font-normal">
              Seleccionar emoji
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" sideOffset={8}>
        {/* Search */}
        <div className="p-3 border-b">
          <Input
            placeholder="Buscar emoji..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
            autoFocus
          />
        </div>

        {/* Category tabs */}
        {!search && (
          <ScrollableContainer
            axis="x"
            className="flex gap-1 p-2 border-b overflow-x-auto scrollbar-hide"
          >
            {EMOJI_CATEGORIES.map((cat, idx) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => setActiveCategory(idx)}
                className={`shrink-0 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeCategory === idx
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </ScrollableContainer>
        )}

        {/* Emoji grid */}
        <ScrollableContainer axis="y" className="p-2 max-h-52 overflow-y-auto">
          <div className="grid grid-cols-8 gap-0.5">
            {filtered.map((emoji, idx) => (
              <button
                key={`${emoji}-${idx}`}
                type="button"
                onClick={() => {
                  onChange(emoji);
                  setOpen(false);
                  setSearch("");
                }}
                className="h-9 w-9 flex items-center justify-center rounded-md text-xl hover:bg-muted transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No se encontraron emojis
            </p>
          )}
        </ScrollableContainer>

        {/* Custom input fallback */}
        <div className="p-2 border-t">
          <div className="flex gap-2 items-center">
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="h-8 text-center text-lg flex-1"
            />
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              o pega un emoji
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
