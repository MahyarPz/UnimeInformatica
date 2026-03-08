'use client';

import React, { useMemo } from 'react';
import { useStudyHeatmap } from '@/lib/hooks/useGamification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StudyHeatmapProps {
  uid: string;
  days?: number;
}

export function StudyHeatmap({ uid, days = 180 }: StudyHeatmapProps) {
  const { data, loading } = useStudyHeatmap(uid, days);

  const { grid, maxXp, months } = useMemo(() => {
    // Build a map of date -> xp
    const xpMap = new Map<string, number>();
    let max = 1;
    for (const day of data) {
      xpMap.set(day.date, day.xpEarned);
      if (day.xpEarned > max) max = day.xpEarned;
    }

    // Generate grid: last N days, grouped by week
    const today = new Date();
    const weeks: Array<Array<{ date: string; xp: number; dayOfWeek: number }>> = [];
    const monthLabels: Array<{ label: string; weekIdx: number }> = [];
    let currentWeek: Array<{ date: string; xp: number; dayOfWeek: number }> = [];
    let lastMonth = -1;

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay();
      const month = d.getMonth();

      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      if (month !== lastMonth) {
        monthLabels.push({
          label: d.toLocaleString('en-US', { month: 'short' }),
          weekIdx: weeks.length,
        });
        lastMonth = month;
      }

      currentWeek.push({
        date: dateStr,
        xp: xpMap.get(dateStr) || 0,
        dayOfWeek,
      });
    }

    if (currentWeek.length > 0) weeks.push(currentWeek);

    return { grid: weeks, maxXp: max, months: monthLabels };
  }, [data, days]);

  const getIntensity = (xp: number): string => {
    if (xp === 0) return 'bg-muted/40';
    const ratio = xp / maxXp;
    if (ratio <= 0.25) return 'bg-emerald-200 dark:bg-emerald-900/60';
    if (ratio <= 0.5) return 'bg-emerald-400 dark:bg-emerald-700';
    if (ratio <= 0.75) return 'bg-emerald-500 dark:bg-emerald-500';
    return 'bg-emerald-600 dark:bg-emerald-400';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Study Heatmap</CardTitle></CardHeader>
        <CardContent>
          <div className="h-24 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Study Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {/* Month labels */}
          <div className="flex gap-0 mb-1 ml-6">
            {months.map((m, i) => (
              <div
                key={i}
                className="text-[10px] text-muted-foreground"
                style={{ marginLeft: i === 0 ? 0 : `${(m.weekIdx - (months[i - 1]?.weekIdx || 0)) * 14 - 20}px` }}
              >
                {m.label}
              </div>
            ))}
          </div>

          <div className="flex gap-0 items-start">
            {/* Day labels */}
            <div className="flex flex-col gap-[2px] mr-1 text-[10px] text-muted-foreground">
              <div className="h-[12px]" />
              <div className="h-[12px] flex items-center">M</div>
              <div className="h-[12px]" />
              <div className="h-[12px] flex items-center">W</div>
              <div className="h-[12px]" />
              <div className="h-[12px] flex items-center">F</div>
              <div className="h-[12px]" />
            </div>

            {/* Grid */}
            <TooltipProvider delayDuration={100}>
              <div className="flex gap-[2px]">
                {grid.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[2px]">
                    {Array.from({ length: 7 }, (_, di) => {
                      const cell = week.find(c => c.dayOfWeek === di);
                      if (!cell) return <div key={di} className="w-[12px] h-[12px]" />;
                      return (
                        <Tooltip key={di}>
                          <TooltipTrigger asChild>
                            <div
                              className={`w-[12px] h-[12px] rounded-[2px] ${getIntensity(cell.xp)} transition-colors`}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <p className="font-medium">{cell.date}</p>
                            <p>{cell.xp} XP earned</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </div>
            </TooltipProvider>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground justify-end">
            <span>Less</span>
            <div className="w-[10px] h-[10px] rounded-[2px] bg-muted/40" />
            <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-200 dark:bg-emerald-900/60" />
            <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-400 dark:bg-emerald-700" />
            <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-500 dark:bg-emerald-500" />
            <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-600 dark:bg-emerald-400" />
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
