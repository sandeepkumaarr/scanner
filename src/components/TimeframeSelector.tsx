"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock } from "lucide-react";
import { TimeframeType } from "@/lib/websocketClient";

interface TimeframeSelectorProps {
  value: TimeframeType;
  onChange: (timeframe: TimeframeType) => void;
  disabled?: boolean;
}

const TIMEFRAME_LABELS: Record<TimeframeType, string> = {
  "1m": "1 Minute",
  "5m": "5 Minutes",
  "15m": "15 Minutes",
  "1h": "1 Hour",
  "4h": "4 Hours",
  "1d": "1 Day",
};

const TIMEFRAME_DESCRIPTIONS: Record<TimeframeType, string> = {
  "1m": "High frequency, scalping patterns",
  "5m": "Short-term intraday patterns",
  "15m": "Medium-term intraday patterns",
  "1h": "Hourly swing patterns",
  "4h": "Primary timeframe for pattern detection",
  "1d": "Daily swing and position patterns",
};

export default function TimeframeSelector({
  value,
  onChange,
  disabled = false,
}: TimeframeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Clock className="w-4 h-4 text-white" />
      <Select
        value={value}
        onValueChange={(value) => onChange(value as TimeframeType)}
        disabled={disabled}
      >
        <SelectTrigger className="w-[140px] text-white border-white/40 bg-transparent">
          <SelectValue placeholder="Select timeframe" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(TIMEFRAME_LABELS).map(([timeframe, label]) => (
            <SelectItem
              key={timeframe}
              value={timeframe}
              className="cursor-pointer"
            >
              <div className="flex flex-col">
                <span className="font-medium">{label}</span>
                <span className="text-xs text-gray-500">
                  {TIMEFRAME_DESCRIPTIONS[timeframe as TimeframeType]}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
