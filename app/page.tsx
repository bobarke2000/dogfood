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
        return hour >= 7 && hour < 10;
      });

      const dinnerEvents = todayEvents.filter(date => {
        const hour = date.getHours();
        return hour >= 16 && hour < 20;
      });

      setBreakfastFed(breakfastEvents.length > 0);
      setDinnerFed(dinnerEvents.length > 0);
      setBreakfastTime(breakfastEvents.length > 0 ? breakfastEvents[breakfastEvents.length - 1] : null);
      setDinnerTime(dinnerEvents.length > 0 ? dinnerEvents[dinnerEvents.length - 1] : null);

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
          <h1 className="flex justify-between text-white leading-none text-9xl sm:text-8xl md:text-9l" style={{ fontFamily: 'var(--font-anton)' }}>
            <span>W</span>
            <span>O</span>
            <span>O</span>
            <span>F</span>
          </h1>
          <p className="text-zinc-300 text-l uppercase mt-2 text-center tracking-wider">
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
            window="7:00 AM - 10:00 AM"
          />
          <MealCard
            meal="Dinner"
            fed={dinnerFed}
            time={dinnerTime}
            window="4:00 PM - 8:00 PM"
          />
        </div>

        {/* Last activity */}
        {lastMovement && (
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-zinc-500 text-xs font-medium tracking-wider uppercase mb-1">
                  Last Detection
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