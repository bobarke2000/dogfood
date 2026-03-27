'use client';

import React, { useState, useEffect } from 'react';

const DogFeedingTracker = () => {
  const [breakfastFed, setBreakfastFed] = useState(false);
  const [dinnerFed, setDinnerFed] = useState(false);
  const [breakfastTime, setBreakfastTime] = useState<Date | null>(null);
  const [dinnerTime, setDinnerTime] = useState<Date | null>(null);
  const [lastMovement, setLastMovement] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [streak, setStreak] = useState(0);
  const [avgBreakfastTime, setAvgBreakfastTime] = useState<Date | null>(null);
  const [avgDinnerTime, setAvgDinnerTime] = useState<Date | null>(null);
  const [earliestBreakfast, setEarliestBreakfast] = useState<Date | null>(null);
  const [latestBreakfast, setLatestBreakfast] = useState<Date | null>(null);
  const [earliestDinner, setEarliestDinner] = useState<Date | null>(null);
  const [latestDinner, setLatestDinner] = useState<Date | null>(null);

  useEffect(() => {
    fetchFeedingData();
    const interval = setInterval(fetchFeedingData, 120000);
    return () => clearInterval(interval);
  }, []);

  const fetchFeedingData = async () => {
    try {
      const response = await fetch(
        'https://raw.githubusercontent.com/bobarke2000/dogfood/main/beacon_events.csv?t=' + Date.now()
      );

      if (!response.ok) throw new Error('Failed to fetch data');

      const text = await response.text();
      const lines = text.trim().split('\n');

      const events = lines.slice(1)
        .filter(line => !line.startsWith('#'))
        .map(line => {
          const [timestamp] = line.split(',');
          return new Date(timestamp);
        })
        .filter(date => !isNaN(date.getTime()));

      if (events.length === 0) {
        setBreakfastFed(false);
        setDinnerFed(false);
        setLastMovement(null);
        setLoading(false);
        return;
      }

      events.sort((a, b) => b.getTime() - a.getTime());
      setLastMovement(events[0]);

      const now = new Date();
      const resetTime = new Date(now);
      resetTime.setHours(2, 0, 0, 0);
      if (now.getHours() < 2) {
        resetTime.setDate(resetTime.getDate() - 1);
      }

      const todayEvents = events.filter(date => date >= resetTime);

      const breakfastEvents = todayEvents.filter(date => {
        const hour = date.getHours();
        return hour >= 7 && hour < 12;
      });
      const dinnerEvents = todayEvents.filter(date => {
        const hour = date.getHours();
        return hour >= 16 && hour < 22;
      });

      setBreakfastFed(breakfastEvents.length > 0);
      setDinnerFed(dinnerEvents.length > 0);
      setBreakfastTime(breakfastEvents.length > 0 ? breakfastEvents[breakfastEvents.length - 1] : null);
      setDinnerTime(dinnerEvents.length > 0 ? dinnerEvents[dinnerEvents.length - 1] : null);

      // --- Stats ---

      // Helper: get feeding day key (days reset at 2am)
      const getFeedingDayKey = (date: Date): string => {
        const d = new Date(date);
        if (d.getHours() < 2) d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
      };

      // Group events by feeding day and meal
      const eventsByDay = new Map<string, { breakfast: Date[]; dinner: Date[] }>();
      for (const event of events) {
        const key = getFeedingDayKey(event);
        if (!eventsByDay.has(key)) eventsByDay.set(key, { breakfast: [], dinner: [] });
        const hour = event.getHours();
        if (hour >= 7 && hour < 12) eventsByDay.get(key)!.breakfast.push(event);
        else if (hour >= 16 && hour < 22) eventsByDay.get(key)!.dinner.push(event);
      }

      // Streak: consecutive days with both meals, going back from yesterday, +1 if today complete
      const todayKey = getFeedingDayKey(now);
      let streakCount = 0;
      const checkDate = new Date(now);
      if (checkDate.getHours() < 2) checkDate.setDate(checkDate.getDate() - 1);
      checkDate.setDate(checkDate.getDate() - 1); // start from yesterday
      let key = checkDate.toISOString().slice(0, 10);
      while (true) {
        const day = eventsByDay.get(key);
        if (day && day.breakfast.length > 0 && day.dinner.length > 0) {
          streakCount++;
          const d = new Date(key + 'T12:00:00');
          d.setDate(d.getDate() - 1);
          key = d.toISOString().slice(0, 10);
        } else {
          break;
        }
      }
      const todayDay = eventsByDay.get(todayKey);
      if (todayDay && todayDay.breakfast.length > 0 && todayDay.dinner.length > 0) {
        streakCount++;
      }
      setStreak(streakCount);

      // Average breakfast/dinner times over last 7 days
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentBreakfasts = events.filter(d => d >= sevenDaysAgo && d.getHours() >= 7 && d.getHours() < 12);
      const recentDinners = events.filter(d => d >= sevenDaysAgo && d.getHours() >= 16 && d.getHours() < 22);

      const avgMins = (dates: Date[]): Date | null => {
        if (dates.length === 0) return null;
        const total = dates.reduce((sum, d) => sum + d.getHours() * 60 + d.getMinutes(), 0);
        const mins = Math.round(total / dates.length);
        const result = new Date();
        result.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
        return result;
      };

      setAvgBreakfastTime(avgMins(recentBreakfasts));
      setAvgDinnerTime(avgMins(recentDinners));

      // Earliest/latest ever
      const allBreakfasts = events.filter(d => d.getHours() >= 7 && d.getHours() < 12);
      const allDinners = events.filter(d => d.getHours() >= 16 && d.getHours() < 22);
      const tod = (d: Date) => d.getHours() * 60 + d.getMinutes();

      setEarliestBreakfast(allBreakfasts.length > 0 ? allBreakfasts.reduce((m, d) => tod(d) < tod(m) ? d : m) : null);
      setLatestBreakfast(allBreakfasts.length > 0 ? allBreakfasts.reduce((m, d) => tod(d) > tod(m) ? d : m) : null);
      setEarliestDinner(allDinners.length > 0 ? allDinners.reduce((m, d) => tod(d) < tod(m) ? d : m) : null);
      setLatestDinner(allDinners.length > 0 ? allDinners.reduce((m, d) => tod(d) > tod(m) ? d : m) : null);

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="bg-zinc-900 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full">
          <div className="text-red-400 text-sm font-medium mb-1">Connection Error</div>
          <div className="text-zinc-400 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  const MealCard = ({
    meal,
    fed,
    time,
    window
  }: {
    meal: string;
    fed: boolean;
    time: Date | null;
    window: string;
  }) => (
    <div className={`
      relative overflow-hidden rounded-3xl p-6
      ${fed
        ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30'
        : 'bg-zinc-900/80 border border-zinc-800'
      }
    `}>
      {/* Status indicator dot */}
      <div className={`
        absolute top-4 right-4 w-3 h-3 rounded-full
        ${fed ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : 'bg-zinc-600'}
      `} />

      {/* Meal label */}
      <div className="text-zinc-500 text-xs font-medium tracking-wider uppercase mb-3">
        {meal}
      </div>

      {/* Main status */}
      <div className={`text-4xl font-bold mb-2 ${fed ? 'text-emerald-400' : 'text-zinc-300'}`}>
        {fed ? 'Fed' : 'Waiting'}
      </div>

      {/* Time info */}
      {fed && time ? (
        <div className="flex items-baseline gap-2">
          <span className="text-zinc-400 text-lg font-medium">{formatTime(time)}</span>
          <span className="text-zinc-600 text-sm">{getTimeAgo(time)}</span>
        </div>
      ) : (
        <div className="text-zinc-600 text-sm">{window}</div>
      )}
    </div>
  );

  const totalFed = (breakfastFed ? 1 : 0) + (dinnerFed ? 1 : 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-lg mx-auto px-5 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="flex justify-between items-center text-white leading-none text-7xl sm:text-8xl md:text-9xl" style={{ fontFamily: 'var(--font-anton)' }}>
            <img src="/LOGO_01.png" alt="Logo" className="h-[0.865em] w-auto" />
            <span>W</span>
            <span>O</span>
            <span>O</span>
            <span>F</span>
          </h1>
          <p
            className="text-zinc-300 uppercase mt-2 text-center tracking-wider whitespace-nowrap"
            style={{ fontSize: 'clamp(0.6rem, 3.8vw, 1rem)' }}
          >
            Wireless Observation Of Feeding - Juney Bjarke
          </p>
          <div className={`
            inline-block mt-3 px-2 py-0.5 rounded-full text-xs font-medium
            ${totalFed === 2
              ? 'bg-emerald-500/20 text-emerald-400'
              : totalFed === 1
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-zinc-800 text-zinc-500'
            }
          `}>
            {totalFed}/2 meals
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${(totalFed / 2) * 100}%` }}
            />
          </div>
        </div>

        {/* Meal cards */}
        <div className="space-y-4 mb-8">
          <MealCard
            meal="Breakfast"
            fed={breakfastFed}
            time={breakfastTime}
            window="7:00 AM - 12:00 PM"
          />
          <MealCard
            meal="Dinner"
            fed={dinnerFed}
            time={dinnerTime}
            window="4:00 PM - 10:00 PM"
          />
        </div>

        {/* Last activity */}
        {lastMovement && (
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-zinc-500 text-xs font-medium tracking-wider uppercase mb-1">
                  Last Movement Detection
                </div>
                <div className="text-zinc-300 font-medium">
                  {formatTime(lastMovement)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-zinc-600 text-sm">
                  {getTimeAgo(lastMovement)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="space-y-3">
          <div className="text-zinc-600 text-xs font-medium tracking-wider uppercase">Stats</div>

          {/* Streak */}
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4">
            <div className="text-zinc-500 text-xs font-medium tracking-wider uppercase mb-2">Streak</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-200">{streak}</span>
              <span className="text-zinc-500 text-sm">consecutive days with both meals</span>
            </div>
          </div>

          {/* Avg times this week */}
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4">
            <div className="text-zinc-500 text-xs font-medium tracking-wider uppercase mb-3">Avg this week</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-zinc-600 text-xs mb-1">Breakfast</div>
                <div className="text-zinc-200 font-medium">
                  {avgBreakfastTime ? formatTime(avgBreakfastTime) : '—'}
                </div>
              </div>
              <div>
                <div className="text-zinc-600 text-xs mb-1">Dinner</div>
                <div className="text-zinc-200 font-medium">
                  {avgDinnerTime ? formatTime(avgDinnerTime) : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* All time records */}
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4">
            <div className="text-zinc-500 text-xs font-medium tracking-wider uppercase mb-3">All time</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-zinc-600 text-xs mb-2">Breakfast</div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-600 text-xs">Earliest</span>
                    <span className="text-zinc-300 text-sm">{earliestBreakfast ? formatTime(earliestBreakfast) : '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-600 text-xs">Latest</span>
                    <span className="text-zinc-300 text-sm">{latestBreakfast ? formatTime(latestBreakfast) : '—'}</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-zinc-600 text-xs mb-2">Dinner</div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-600 text-xs">Earliest</span>
                    <span className="text-zinc-300 text-sm">{earliestDinner ? formatTime(earliestDinner) : '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-600 text-xs">Latest</span>
                    <span className="text-zinc-300 text-sm">{latestDinner ? formatTime(latestDinner) : '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center gap-2 text-zinc-600 text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-pulse" />
          <span>Live data from BLE sensor</span>
        </div>

      </div>
    </div>
  );
};

export default DogFeedingTracker;
