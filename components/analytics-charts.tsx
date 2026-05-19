"use client";

import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["#d97757", "#5b9aae", "#374f6c", "#a8c5a0", "#e8b04f", "#a76d8e", "#f29479", "#8caec7", "#9a8676"];

const TOOLTIP_STYLE = {
  background: "white",
  border: "1px solid #e5d6c0",
  borderRadius: "6px",
  fontSize: "12px",
  padding: "8px",
};

function formatMAD(n: number) {
  return new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(n) + " MAD";
}

export function RevenueChart({ data }: { data: { month: string; revenue: number }[] }) {
  if (data.every((d) => d.revenue === 0)) {
    return <div className="h-[300px] flex items-center justify-center text-sm text-sand-700">Aucun revenu enregistré sur les 12 derniers mois.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5d6c0" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#7a6a55" }} axisLine={{ stroke: "#e5d6c0" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#7a6a55" }} axisLine={false} tickLine={false} tickFormatter={(v: any) => `${(Number(v) / 1000).toFixed(0)}k`} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: any) => [formatMAD(Number(value)), "Revenu"]} />
        <Line type="monotone" dataKey="revenue" stroke="#d97757" strokeWidth={2.5} dot={{ fill: "#d97757", r: 4 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TopCircuitsChart({ data }: { data: { title: string; revenue: number; count: number }[] }) {
  if (data.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-sm text-sand-700">Aucun circuit avec revenu sur la période.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5d6c0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#7a6a55" }} axisLine={false} tickLine={false} tickFormatter={(v: any) => `${(Number(v) / 1000).toFixed(0)}k`} />
        <YAxis type="category" dataKey="title" tick={{ fontSize: 11, fill: "#3a2e22" }} axisLine={false} tickLine={false} width={130} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: any) => [formatMAD(Number(value)), "Revenu"]} />
        <Bar dataKey="revenue" fill="#5b9aae" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SourcesChart({ data }: { data: { source: string; count: number }[] }) {
  if (data.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-sm text-sand-700">Aucune donnée d&apos;acquisition.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="source" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} label={(props: any) => `${((props.percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
          {data.map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: any, name: any) => [`${value} réservation(s)`, String(name)]} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}
