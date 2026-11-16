"use client";
import { useState } from "react";

type EditableTargetPriceProps = {
  value: number | null;
  onSave: (v: number) => void;
};

export default function EditableTargetPrice({ value, onSave }: EditableTargetPriceProps) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value?.toString() || "");

  function save() {
    const num = parseFloat(input);
    if (!isNaN(num) && num > 0) {
      onSave(num);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        type="number"
        step="any"
        autoFocus
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-20 bg-bg-input border border-accent/50 rounded px-1.5 py-0.5 text-xs font-mono text-txt-primary text-right focus:outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => {
        setInput(value?.toString() || "");
        setEditing(true);
      }}
      className="font-mono text-txt-secondary hover:text-accent-light transition-colors cursor-pointer group text-xs"
      title="Click to edit target price"
    >
      {value ? `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
      <span className="text-[8px] text-txt-dim ml-0.5 opacity-0 group-hover:opacity-100">edit</span>
    </button>
  );
}
