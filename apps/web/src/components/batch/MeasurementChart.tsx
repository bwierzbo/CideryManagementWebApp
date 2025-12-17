"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import { formatDateForChart } from "@/utils/date-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Beaker, Thermometer, Droplets } from "lucide-react";

interface MeasurementData {
  id?: string;
  measurementDate: string | Date;
  specificGravity?: number | null;
  abv?: number | null;
  ph?: number | null;
  totalAcidity?: number | null;
  temperature?: number | null;
  volume?: number | null;
  volumeUnit?: string | null;
}

interface MeasurementChartProps {
  measurements: MeasurementData[];
}

interface ChartDataPoint {
  date: string;
  dateLabel: string;
  sg?: number;
  abv?: number;
  ph?: number;
  temperature?: number;
  totalAcidity?: number;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-sm mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p
            key={`item-${index}`}
            className="text-xs"
            style={{ color: entry.color }}
          >
            {entry.name}:{" "}
            <span className="font-medium">
              {typeof entry.value === "number"
                ? entry.value.toFixed(entry.name === "SG" ? 3 : 2)
                : entry.value}
              {entry.name === "Temp" && "°C"}
              {entry.name === "ABV" && "%"}
              {entry.name === "TA" && " g/L"}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function MeasurementChart({ measurements }: MeasurementChartProps) {
  // Prepare chart data - sort by date ascending for proper timeline
  const chartData: ChartDataPoint[] = measurements
    .map((m) => {
      const measurementDate = new Date(m.measurementDate);
      return {
        date: measurementDate.toISOString(),
        dateLabel: formatDateForChart(measurementDate),
        sg: m.specificGravity ?? undefined,
        abv: m.abv ?? undefined,
        ph: m.ph ?? undefined,
        temperature: m.temperature ?? undefined,
        totalAcidity: m.totalAcidity ?? undefined,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Check which metrics have data
  const hasSG = chartData.some((d) => d.sg !== undefined);
  const hasABV = chartData.some((d) => d.abv !== undefined);
  const hasPH = chartData.some((d) => d.ph !== undefined);
  const hasTemp = chartData.some((d) => d.temperature !== undefined);
  const hasTA = chartData.some((d) => d.totalAcidity !== undefined);

  if (chartData.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Beaker className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No measurement data available to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SG & ABV Chart */}
      {(hasSG || hasABV) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Beaker className="w-4 h-4" />
              Fermentation Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="dateLabel"
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                />
                {hasSG && (
                  <YAxis
                    yAxisId="left"
                    stroke="#3b82f6"
                    fontSize={12}
                    tickLine={false}
                    domain={[0.9, 1.1]}
                    label={{
                      value: "Specific Gravity",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 12, fill: "#3b82f6" },
                    }}
                  />
                )}
                {hasABV && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#10b981"
                    fontSize={12}
                    tickLine={false}
                    domain={[0, "auto"]}
                    label={{
                      value: "ABV %",
                      angle: 90,
                      position: "insideRight",
                      style: { fontSize: 12, fill: "#10b981" },
                    }}
                  />
                )}
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {hasSG && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="sg"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="SG"
                    connectNulls
                  />
                )}
                {hasABV && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="abv"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="ABV"
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* pH & Temperature Chart */}
      {(hasPH || hasTemp) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Thermometer className="w-4 h-4" />
              pH & Temperature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="dateLabel"
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                />
                {hasPH && (
                  <YAxis
                    yAxisId="left"
                    stroke="#8b5cf6"
                    fontSize={12}
                    tickLine={false}
                    domain={[2, 5]}
                    label={{
                      value: "pH",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 12, fill: "#8b5cf6" },
                    }}
                  />
                )}
                {hasTemp && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#f59e0b"
                    fontSize={12}
                    tickLine={false}
                    domain={[0, "auto"]}
                    label={{
                      value: "Temp (°C)",
                      angle: 90,
                      position: "insideRight",
                      style: { fontSize: 12, fill: "#f59e0b" },
                    }}
                  />
                )}
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {hasPH && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="ph"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="pH"
                    connectNulls
                  />
                )}
                {hasTemp && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="temperature"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Temp"
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Total Acidity Chart */}
      {hasTA && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Droplets className="w-4 h-4" />
              Total Acidity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="dateLabel"
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="#ef4444"
                  fontSize={12}
                  tickLine={false}
                  domain={[0, "auto"]}
                  label={{
                    value: "TA (g/L)",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 12, fill: "#ef4444" },
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="totalAcidity"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="TA"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
