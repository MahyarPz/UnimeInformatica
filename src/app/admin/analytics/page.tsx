'use client';

import React, { useState, useMemo } from 'react';
import {
  useAnalyticsDaily,
  useAnalyticsKPIs,
  useTopCourses,
  useTopUsers,
  useRecentAuditLogs,
  exportDailyCSV,
  exportTopCoursesCSV,
  exportTopUsersCSV,
} from '@/lib/hooks/useAnalytics';
import type { AnalyticsTimeRange } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users,
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  Activity,
  BookOpen,
  MessageSquare,
  ShieldAlert,
  DollarSign,
  UserCheck,
  FileDown,
  CalendarDays,
  Info,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Area,
} from 'recharts';
import { format } from 'date-fns';
import { timeAgo } from '@/lib/utils';

// ─── Chart colors (from tailwind CSS vars) ──────────────────
const CHART_COLORS = {
  primary: 'hsl(var(--chart-1))',
  secondary: 'hsl(var(--chart-2))',
  tertiary: 'hsl(var(--chart-3))',
  quaternary: 'hsl(var(--chart-4))',
  quinary: 'hsl(var(--chart-5))',
};

// ─── KPI Card component ─────────────────────────────────────
function KPICard({
  title,
  value,
  change,
  icon: Icon,
  tooltip,
  suffix,
}: {
  title: string;
  value: number | string;
  change?: number;
  icon: React.ElementType;
  tooltip?: string;
  suffix?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              {title}
              {tooltip && (
                <span className="group relative">
                  <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                  <span className="invisible group-hover:visible absolute left-0 top-5 z-50 w-48 rounded bg-popover p-2 text-xs shadow-lg border">
                    {tooltip}
                  </span>
                </span>
              )}
            </p>
            <p className="text-2xl font-bold">
              {typeof value === 'number' ? value.toLocaleString() : value}
              {suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Icon className="h-5 w-5 text-muted-foreground" />
            {change !== undefined && (
              <span
                className={`text-xs font-medium flex items-center gap-0.5 ${
                  change > 0 ? 'text-green-600' : change < 0 ? 'text-red-500' : 'text-muted-foreground'
                }`}
              >
                {change > 0 ? <TrendingUp className="h-3 w-3" /> : change < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                {change > 0 ? '+' : ''}{change}%
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Loading skeleton ───────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

function KPISkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  );
}

// ─── Time range selector ────────────────────────────────────
function TimeRangeSelector({
  range,
  onRangeChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: {
  range: AnalyticsTimeRange;
  onRangeChange: (r: AnalyticsTimeRange) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={range} onValueChange={(v) => onRangeChange(v as AnalyticsTimeRange)}>
        <SelectTrigger className="w-[140px]">
          <CalendarDays className="h-4 w-4 mr-2" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="90d">Last 90 days</SelectItem>
          <SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>
      {range === 'custom' && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customStart}
            onChange={(e) => onCustomStartChange(e.target.value)}
            className="w-[150px]"
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="date"
            value={customEnd}
            onChange={(e) => onCustomEndChange(e.target.value)}
            className="w-[150px]"
          />
        </div>
      )}
    </div>
  );
}

// ─── Chart tooltip formatter ────────────────────────────────
function formatChartDate(dateStr: string) {
  try {
    return format(new Date(dateStr + 'T00:00:00'), 'MMM d');
  } catch {
    return dateStr;
  }
}

// ─── Main page ──────────────────────────────────────────────
export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<AnalyticsTimeRange>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const parsedCustomStart = customStart ? new Date(customStart) : undefined;
  const parsedCustomEnd = customEnd ? new Date(customEnd) : undefined;

  const { data, loading, error } = useAnalyticsDaily(range, parsedCustomStart, parsedCustomEnd);
  const kpis = useAnalyticsKPIs(data);
  const { data: topCourses, loading: coursesLoading } = useTopCourses(range, parsedCustomStart, parsedCustomEnd);
  const { data: topUsers, loading: usersLoading } = useTopUsers();
  const { data: auditLogs, loading: logsLoading } = useRecentAuditLogs(50);

  // Chart data (abbreviate dates for chart)
  const chartData = useMemo(
    () => data.map((d) => ({ ...d, label: formatChartDate(d.date) })),
    [data],
  );

  // Top 10 courses for bar chart
  const top10Courses = useMemo(() => topCourses.slice(0, 10), [topCourses]);

  // Top 10 courses by wrong rate
  const top10WrongRate = useMemo(
    () =>
      [...topCourses]
        .filter((c) => c.questionsAnswered > 0)
        .sort((a, b) => b.wrongRate - a.wrongRate)
        .slice(0, 10),
    [topCourses],
  );

  // Filter audit logs to analytics/ai/monetization-related
  const filteredLogs = useMemo(
    () =>
      auditLogs.filter((l) =>
        ['monetization', 'ai', 'analytics', 'auth'].includes(l.category || ''),
      ),
    [auditLogs],
  );

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Platform usage analytics and insights</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error loading analytics</h3>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Ensure analytics_daily collection exists and Firestore indexes are configured.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Platform usage trends, monetization, and AI insights</p>
        </div>
        <TimeRangeSelector
          range={range}
          onRangeChange={setRange}
          customStart={customStart}
          customEnd={customEnd}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
        />
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <KPISkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            title="Daily Active Users"
            value={kpis.dau}
            change={kpis.dauChange}
            icon={Users}
            tooltip="Users active in last 24h (from RTDB presence)"
          />
          <KPICard
            title="Weekly Active Users"
            value={kpis.wau}
            change={kpis.wauChange}
            icon={Activity}
            tooltip="Users active in last 7 days"
          />
          <KPICard
            title="New Signups"
            value={kpis.signups}
            change={kpis.signupsChange}
            icon={UserCheck}
            tooltip="New user registrations in this period"
          />
          <KPICard
            title="Practice Sessions"
            value={kpis.practiceSessions}
            change={kpis.practiceSessionsChange}
            icon={BookOpen}
            tooltip="Practice sessions started"
          />
          <KPICard
            title="Questions Answered"
            value={kpis.questionsAnswered}
            change={kpis.questionsAnsweredChange}
            icon={MessageSquare}
            tooltip="MCQ + Essay submissions"
          />
          <KPICard
            title="AI Requests"
            value={`${kpis.aiRequests}`}
            change={kpis.aiRequestsChange}
            icon={BrainCircuit}
            tooltip="Total AI requests / blocked by quota or kill switch"
            suffix={kpis.aiBlocked > 0 ? `(${kpis.aiBlocked} blocked)` : undefined}
          />
          <KPICard
            title="Donations"
            value={`${kpis.donationsApproved}`}
            icon={DollarSign}
            tooltip="Submitted / Approved donation requests"
            suffix={`/ ${kpis.donationsPending} submitted`}
          />
          <KPICard
            title="Paid Users"
            value={kpis.activeSupporter + kpis.activePro}
            change={kpis.paidUsersChange}
            icon={TrendingUp}
            tooltip="Active Supporter + Pro plan users"
            suffix={`(${kpis.activeSupporter}S / ${kpis.activePro}P)`}
          />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="ai-monetization">AI & Monetization</TabsTrigger>
          <TabsTrigger value="exports">Exports</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ──────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6">
          {loading ? (
            <>
              <ChartSkeleton />
              <ChartSkeleton />
            </>
          ) : (
            <>
              {/* DAU Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Daily Active Users</CardTitle>
                  <CardDescription>Users active per day (from RTDB presence)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="dau"
                        name="DAU"
                        stroke={CHART_COLORS.primary}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="wau"
                        name="WAU"
                        stroke={CHART_COLORS.secondary}
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="5 5"
                      />
                      <Legend />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Practice Sessions Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Practice Sessions & Questions</CardTitle>
                  <CardDescription>Sessions started and questions answered per day</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar
                        dataKey="practiceSessionsStarted"
                        name="Sessions"
                        fill={CHART_COLORS.primary}
                        opacity={0.7}
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        type="monotone"
                        dataKey="questionsAnswered"
                        name="Questions"
                        stroke={CHART_COLORS.quaternary}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Legend />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Signups */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">New Signups</CardTitle>
                  <CardDescription>User registrations per day</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar
                        dataKey="signups"
                        name="Signups"
                        fill={CHART_COLORS.secondary}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Engagement Tab ────────────────────────────────── */}
        <TabsContent value="engagement" className="space-y-6">
          {/* Top Courses by Sessions (bar chart) */}
          {coursesLoading ? (
            <ChartSkeleton />
          ) : top10Courses.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No course engagement data for this period.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 10 Courses by Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={top10Courses}
                    layout="vertical"
                    margin={{ left: 120 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      dataKey="courseTitle"
                      type="category"
                      tick={{ fontSize: 11 }}
                      width={120}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="sessions"
                      name="Sessions"
                      fill={CHART_COLORS.primary}
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Question Difficulty — courses by wrong rate */}
          {coursesLoading ? (
            <ChartSkeleton />
          ) : top10WrongRate.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No question difficulty data for this period.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Courses by Wrong Answer Rate</CardTitle>
                <CardDescription>Higher rate indicates harder/trickier content</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={top10WrongRate}
                    layout="vertical"
                    margin={{ left: 120 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 12 }} domain={[0, 100]} unit="%" />
                    <YAxis
                      dataKey="courseTitle"
                      type="category"
                      tick={{ fontSize: 11 }}
                      width={120}
                    />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Bar
                      dataKey="wrongRate"
                      name="Wrong Rate"
                      fill={CHART_COLORS.quinary}
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Top Courses Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Courses</CardTitle>
              <CardDescription>Course performance data for the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {coursesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : topCourses.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium">Course</th>
                        <th className="pb-2 font-medium text-right">Sessions</th>
                        <th className="pb-2 font-medium text-right">Questions</th>
                        <th className="pb-2 font-medium text-right">Correct</th>
                        <th className="pb-2 font-medium text-right">Wrong Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCourses.map((c) => (
                        <tr key={c.courseId} className="border-b last:border-0">
                          <td className="py-2 font-medium">{c.courseTitle}</td>
                          <td className="py-2 text-right">{c.sessions}</td>
                          <td className="py-2 text-right">{c.questionsAnswered}</td>
                          <td className="py-2 text-right">{c.correctAnswers}</td>
                          <td className="py-2 text-right">
                            <Badge variant={c.wrongRate > 50 ? 'destructive' : c.wrongRate > 30 ? 'warning' : 'secondary'}>
                              {c.wrongRate}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Users Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Users</CardTitle>
              <CardDescription>Most active users by practice sessions (admin-only data)</CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : topUsers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium">Username</th>
                        <th className="pb-2 font-medium text-right">Sessions</th>
                        <th className="pb-2 font-medium text-right">Plan</th>
                        <th className="pb-2 font-medium text-right">Last Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topUsers.map((u) => (
                        <tr key={u.uid} className="border-b last:border-0">
                          <td className="py-2 font-medium">{u.username}</td>
                          <td className="py-2 text-right">{u.sessions}</td>
                          <td className="py-2 text-right">
                            <Badge variant={u.plan === 'pro' ? 'default' : u.plan === 'supporter' ? 'success' : 'secondary'}>
                              {u.plan}
                            </Badge>
                          </td>
                          <td className="py-2 text-right text-muted-foreground">{u.lastActive || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Events */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Events</CardTitle>
              <CardDescription>Latest audit log entries (analytics, AI, monetization, auth)</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : filteredLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No recent events</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between py-2 border-b last:border-0 text-sm"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Badge variant="outline" className="text-xs shrink-0">
                          {log.category}
                        </Badge>
                        <span className="font-medium truncate">{log.action}</span>
                        <span className="text-muted-foreground truncate">
                          by {log.actorUsername}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {log.timestamp ? timeAgo(log.timestamp) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AI & Monetization Tab ─────────────────────────── */}
        <TabsContent value="ai-monetization" className="space-y-6">
          {loading ? (
            <>
              <ChartSkeleton />
              <ChartSkeleton />
            </>
          ) : (
            <>
              {/* AI Requests Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">AI Requests</CardTitle>
                  <CardDescription>Total AI requests per day with blocked overlay</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="aiRequests"
                        name="AI Requests"
                        fill={CHART_COLORS.primary}
                        fillOpacity={0.15}
                        stroke={CHART_COLORS.primary}
                        strokeWidth={2}
                      />
                      <Bar
                        dataKey="aiBlocked"
                        name="Blocked"
                        fill="hsl(0 84% 60%)"
                        opacity={0.7}
                        radius={[4, 4, 0, 0]}
                      />
                      <Legend />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Monetization */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Monetization</CardTitle>
                  <CardDescription>Approved donations and active paid users</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar
                        yAxisId="left"
                        dataKey="donationRequestsApproved"
                        name="Donations Approved"
                        fill={CHART_COLORS.quaternary}
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="activeSupporter"
                        name="Supporters"
                        stroke={CHART_COLORS.secondary}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="activePro"
                        name="Pro Users"
                        stroke={CHART_COLORS.primary}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Legend />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Paid Users Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Active Supporters</p>
                    <p className="text-3xl font-bold">{kpis.activeSupporter}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Active Pro</p>
                    <p className="text-3xl font-bold">{kpis.activePro}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-sm text-muted-foreground mb-1">AI Block Rate</p>
                    <p className="text-3xl font-bold">
                      {kpis.aiRequests > 0
                        ? `${Math.round((kpis.aiBlocked / kpis.aiRequests) * 100)}%`
                        : '0%'}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Exports Tab ────────────────────────────────────── */}
        <TabsContent value="exports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export Data</CardTitle>
              <CardDescription>
                Download CSV exports of analytics data. Only data currently loaded (for the selected time range) is exported.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  onClick={() =>
                    exportDailyCSV(
                      data,
                      `analytics_daily_${range}_${format(new Date(), 'yyyyMMdd')}.csv`,
                    )
                  }
                  disabled={loading || data.length === 0}
                  className="w-full"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Daily Metrics CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={() => exportTopCoursesCSV(topCourses)}
                  disabled={coursesLoading || topCourses.length === 0}
                  className="w-full"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Top Courses CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={() => exportTopUsersCSV(topUsers)}
                  disabled={usersLoading || topUsers.length === 0}
                  className="w-full"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Top Users CSV
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Exports only include data for the currently selected time range. All exports are generated client-side from already-loaded, server-secured data.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
