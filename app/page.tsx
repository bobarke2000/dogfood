'use client';

import React, { useState, useEffect } from 'react';
import { Coffee, Moon, Check, X, Clock } from 'lucide-react';

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
    // Refresh every 2 minutes
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
      
      // Skip header and filter out any comment lines
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

      // Set last movement (most recent event regardless of time window)
      events.sort((a, b) => b.getTime() - a.getTime());
      setLastMovement(events[0]);

      // Get today's date at 2am (reset time)
      const now = new Date();
      const resetTime = new Date(now);
      resetTime.setHours(2, 0, 0, 0);
      
      // If it's before 2am, we're looking at yesterday's reset
      if (now.getHours() < 2) {
        resetTime.setDate(resetTime.getDate() - 1);
      }

      // Filter events since last reset (2am)
      const todayEvents = events.filter(date => date >= resetTime);

      // Check for breakfast (7am-10am)
      const breakfastEvents = todayEvents.filter(date => {
        const hour = date.getHours();
        return hour >= 7 && hour < 10;
      });

      // Check for dinner (4pm-8pm)
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

  const formatFullDateTime = (date: Date) => {
    return date.toLocaleString('en-US', { 
      month: 'short',
      day: 'numeric',
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getCurrentPeriod = () => {
    const hour = new Date().getHours();
    if (hour >= 7 && hour < 10) return 'breakfast';
    if (hour >= 16 && hour < 20) return 'dinner';
    return 'none';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center">
        <div className="text-2xl text-gray-700">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
          <div className="text-red-600 text-xl font-semibold mb-2">Error</div>
          <div className="text-gray-700">{error}</div>
        </div>
      </div>
    );
  }

  const currentPeriod = getCurrentPeriod();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl md:text-8xl font-bold text-gray-800 mb-0 text-center mt-4 md:mt-8">
          Has Juney Been Fed?
        </h1>
        <p className="text-center text-gray-600 mb-4">
          Automated Juney Feeding Detection System®
        </p>

        {/* Two meal cards side by side */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Breakfast Card */}
          <div className={`rounded-2xl shadow-2xl p-6 transition-all relative overflow-visible ${
            breakfastFed 
              ? 'bg-gradient-to-br from-green-400 to-emerald-500' 
              : 'bg-gradient-to-br from-orange-300 to-amber-400'
          }`}>
            {/* Dog image positioned breaking out of the box */}
            <div className="absolute bottom-16 -left-12 w-48 h-48 md:w-56 md:h-56" style={{ transform: 'rotate(-10deg)' }}>
              <img 
                src={breakfastFed ? "/images/happy_01.png" : "/images/sad_01.png"}
                alt="Dog"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex items-center justify-center mb-3">
              <Coffee className="w-12 h-12 text-white" />
            </div>
            
            <h2 className="text-xl font-bold text-white text-center mb-3">
              Breakfast
            </h2>

            <div className="flex items-center justify-center mb-3">
              {breakfastFed ? (
                <Check className="w-10 h-10 text-white" />
              ) : (
                <X className="w-10 h-10 text-white" />
              )}
            </div>
            
            <div className="text-center text-white">
              <div className="text-lg font-semibold mb-1">
                {breakfastFed ? 'Yes!' : 'Not Yet'}
              </div>
              {breakfastTime && (
                <div className="text-base opacity-90">
                  at {formatTime(breakfastTime)}
                </div>
              )}
              <div className="text-sm opacity-75 mt-2">
                Detection window 7:00 AM - 10:00 AM
              </div>
            </div>
          </div>

          {/* Dinner Card */}
          <div className={`rounded-2xl shadow-2xl p-6 transition-all relative overflow-visible ${
            dinnerFed 
              ? 'bg-gradient-to-br from-green-400 to-emerald-500' 
              : 'bg-gradient-to-br from-indigo-400 to-purple-500'
          }`}>
            {/* Dog image positioned breaking out of the box */}
            <div className="absolute -bottom--8 -right-8 w-48 h-48 md:w-56 md:h-56" style={{ transform: 'rotate(10deg)' }}>
              <img 
                src={dinnerFed ? "/images/happy_01.png" : "/images/sad_01.png"}
                alt="Dog"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex items-center justify-center mb-3">
              <Moon className="w-12 h-12 text-white" />
            </div>
            
            <h2 className="text-xl font-bold text-white text-center mb-3">
              Dinner
            </h2>

            <div className="flex items-center justify-center mb-3">
              {dinnerFed ? (
                <Check className="w-10 h-10 text-white" />
              ) : (
                <X className="w-10 h-10 text-white" />
              )}
            </div>
            
            <div className="text-center text-white">
              <div className="text-lg font-semibold mb-1">
                {dinnerFed ? 'Yes!' : 'Not Yet'}
              </div>
              {dinnerTime && (
                <div className="text-base opacity-90">
                  at {formatTime(dinnerTime)}
                </div>
              )}
              <div className="text-sm opacity-75 mt-2">
                Detection window 4:00 PM - 8:00 PM
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-600 text-sm">
          Resets at 2:00 AM daily. Updated.
        </div>

        {/* Debug: Last Movement */}
        {lastMovement && (
          <div className="mt-4 bg-gray-100 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-500 mb-1">Last Movement Detected</div>
            <div className="text-sm font-mono text-gray-700">
              {formatFullDateTime(lastMovement)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DogFeedingTracker;