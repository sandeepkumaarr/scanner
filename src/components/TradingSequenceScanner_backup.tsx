"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Target,
} from "lucide-react";
import { BlueprintResult } from "@/lib/blueprintDetector";

interface ScannerData {
  success: boolean;
  data: BlueprintResult[];
  totalFound: number;
  totalScanned: number;
  timestamp: string;
}

export default function TradingSequenceScanner() {
  const [scannerData, setScannerData] = useState<ScannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedConfidence, setSelectedConfidence] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("confidence");

  const blueprintTypes = [
    "all",
    "rejection day",
    "absorption day",
    "failed new low",
    "failed new high",
    "outside day",
    "stop run day",
  ];

  const confidenceLevels = ["all", "high", "medium", "low"];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        type: selectedType,
        confidence: selectedConfidence,
        sortBy: sortBy,
      });

      const response = await fetch(`/api/scanner?${params}`);
      const data = await response.json();

      if (data.success) {
        setScannerData(data);
      } else {
        setError(data.error || "Failed to fetch scanner data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error occurred");
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedConfidence, sortBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getBlueprintIcon = (type: string) => {
    if (type.includes("Rejection"))
      return <AlertTriangle className="w-4 h-4" />;
    if (type.includes("Failed")) return <TrendingDown className="w-4 h-4" />;
    if (type.includes("Outside")) return <Activity className="w-4 h-4" />;
    if (type.includes("Stop Run")) return <Target className="w-4 h-4" />;
    if (type.includes("Absorption")) return <TrendingUp className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
  };

  const getBlueprintColor = (type: string) => {
    if (type.includes("Long") || type.includes("Failed New Low"))
      return "bg-green-100 text-green-800 border-green-200";
    if (type.includes("Short") || type.includes("Failed New High"))
      return "bg-red-100 text-red-800 border-red-200";
    if (type.includes("Rejection"))
      return "bg-blue-100 text-blue-800 border-blue-200";
    if (type.includes("Absorption"))
      return "bg-purple-100 text-purple-800 border-purple-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "High":
        return "bg-green-100 text-green-800 border-green-200";
      case "Medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Low":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 1) return price.toFixed(4);
    if (price >= 0.01) return price.toFixed(6);
    return price.toFixed(8);
  };

  const formatChange = (change: number) => {
    const formatted = change.toFixed(2);
    return change >= 0 ? `+${formatted}%` : `${formatted}%`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `${(volume / 1e9).toFixed(1)}B`;
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`;
    if (volume >= 1e3) return `${(volume / 1e3).toFixed(1)}K`;
    return volume.toFixed(0);
  };

  const groupedData =
    scannerData?.data.reduce((acc, item) => {
      const key = item.blueprintType;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, BlueprintResult[]>) || {};

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-7xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-700">{error}</p>
              <button
                onClick={fetchData}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-3xl font-bold">
                    Trading Sequence Scanner
                  </CardTitle>
                  <CardDescription className="text-blue-100 text-lg">
                    Real-time detection of Day Type Blueprints on Binance
                    Futures
                  </CardDescription>
                </div>
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>
            </CardHeader>
          </Card>

          {/* Stats Cards */}
          {scannerData && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-0 shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">Total Scanned</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {scannerData.totalScanned}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-600">Patterns Found</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {scannerData.totalFound}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-sm text-gray-600">Success Rate</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {scannerData.totalScanned > 0
                          ? (
                              (scannerData.totalFound /
                                scannerData.totalScanned) *
                              100
                            ).toFixed(1)
                          : 0}
                        %
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="text-sm text-gray-600">Last Updated</p>
                      <p className="text-sm font-medium text-gray-900">
                        {scannerData.timestamp
                          ? new Date(scannerData.timestamp).toLocaleTimeString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Filters & Sorting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Blueprint Type
                  </label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select blueprint type" />
                    </SelectTrigger>
                    <SelectContent>
                      {blueprintTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Confidence Level
                  </label>
                  <Select
                    value={selectedConfidence}
                    onValueChange={setSelectedConfidence}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select confidence level" />
                    </SelectTrigger>
                    <SelectContent>
                      {confidenceLevels.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Sort By
                  </label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confidence">Confidence</SelectItem>
                      <SelectItem value="symbol">Symbol</SelectItem>
                      <SelectItem value="price">Price</SelectItem>
                      <SelectItem value="change">24h Change</SelectItem>
                      <SelectItem value="volume">Volume</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <Tabs defaultValue="table" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="table">Table View</TabsTrigger>
              <TabsTrigger value="grouped">Grouped View</TabsTrigger>
            </TabsList>

            <TabsContent value="table" className="space-y-4">
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">Scanner Results</CardTitle>
                  <CardDescription>
                    {loading
                      ? "Scanning..."
                      : `Found ${scannerData?.totalFound || 0} patterns`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                      <span className="ml-2 text-gray-600">
                        Scanning symbols...
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Symbol</TableHead>
                            <TableHead>Blueprint</TableHead>
                            <TableHead>Confidence</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">
                              24h Change
                            </TableHead>
                            <TableHead className="text-right">Volume</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {scannerData?.data.map((item, index) => (
                            <TableRow
                              key={`${item.symbol}-${index}`}
                              className="hover:bg-gray-50"
                            >
                              <TableCell className="font-medium">
                                {item.symbol}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getBlueprintIcon(item.blueprintType)}
                                  <Badge
                                    className={getBlueprintColor(
                                      item.blueprintType
                                    )}
                                  >
                                    {item.blueprintType}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={getConfidenceColor(
                                    item.confidence
                                  )}
                                >
                                  {item.confidence}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                ${formatPrice(item.price)}
                              </TableCell>
                              <TableCell
                                className={`text-right font-mono ${
                                  item.change24h >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {formatChange(item.change24h)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatVolume(item.volume)}
                              </TableCell>
                              <TableCell>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <span className="text-sm text-gray-600 cursor-help">
                                      {item.details.substring(0, 30)}...
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">{item.details}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="grouped" className="space-y-4">
              {Object.entries(groupedData).map(([blueprintType, items]) => (
                <Card key={blueprintType} className="border-0 shadow-md">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      {getBlueprintIcon(blueprintType)}
                      <CardTitle className="text-lg">{blueprintType}</CardTitle>
                      <Badge variant="outline">{items.length} found</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map((item, index) => (
                        <Card
                          key={`${item.symbol}-${index}`}
                          className="border border-gray-200"
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-lg">
                                {item.symbol}
                              </span>
                              <Badge
                                className={getConfidenceColor(item.confidence)}
                              >
                                {item.confidence}
                              </Badge>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Price:</span>
                                <span className="font-mono">
                                  ${formatPrice(item.price)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">
                                  24h Change:
                                </span>
                                <span
                                  className={`font-mono ${
                                    item.change24h >= 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {formatChange(item.change24h)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Volume:</span>
                                <span className="font-mono">
                                  {formatVolume(item.volume)}
                                </span>
                              </div>
                            </div>
                            <Tooltip>
                              <TooltipTrigger>
                                <p className="text-xs text-gray-500 mt-2 cursor-help">
                                  {item.details.substring(0, 50)}...
                                </p>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">{item.details}</p>
                              </TooltipContent>
                            </Tooltip>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
}
