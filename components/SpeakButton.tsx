"use client";

import { Volume2 } from "lucide-react";
import { speakChinese } from "@/lib/speech";

interface SpeakButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export default function SpeakButton({ text, label, className = "" }: SpeakButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speakChinese(text);
      }}
      title={`Phát âm: ${text}`}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 transition text-sm font-medium ${className}`}
    >
      <Volume2 className="w-4 h-4 shrink-0" />
      {label && <span>{label}</span>}
    </button>
  );
}
