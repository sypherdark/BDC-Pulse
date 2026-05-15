"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ScoreHistoryChart({
  rows,
}: {
  rows: { name: string; score: number }[];
}) {
  if (!rows.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Migration Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">No migrations yet. Import SAC assets to populate charts.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Migration Scores</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Bar dataKey="score" fill="#0a6ed1" radius={6} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
