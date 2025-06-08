"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Clock } from "lucide-react";
import { TimeframeType } from "@/lib/websocketClient";

// TimeframeSelector component

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
    <div className="inline-flex items-center bg-blue-500/40 rounded-lg px-3 py-1.5">
      <Clock className="w-4 h-4 text-white mr-2" />
      <span className="text-xs text-white/70 mr-2">Primary timeframe</span>
      <Select
        value={value}
        onValueChange={(value) => onChange(value as TimeframeType)}
        disabled={disabled}
      >
        <SelectTrigger className="min-h-0 h-6 w-9 text-white border-none bg-transparent hover:bg-white/10 focus:ring-0 focus:ring-offset-0 p-0">
          <div className="flex justify-center items-center w-full">
            <span className="text-center text-sm font-medium">{value}</span>
          </div>
        </SelectTrigger>
        <SelectContent className="bg-blue-800 border-blue-700">
          {Object.entries(TIMEFRAME_LABELS).map(([timeframe, label]) => (
            <SelectItem
              key={timeframe}
              value={timeframe}
              className="cursor-pointer hover:bg-blue-700 focus:bg-blue-700"
            >
              <div className="flex flex-col">
                <span className="font-medium text-white">{label}</span>
                <span className="text-xs text-blue-200">
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
