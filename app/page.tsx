'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Check, X } from 'lucide-react';

const DogFeedingTracker = () => {
  const [lastFed, setLastFed] = useState<Date | null>(null);
  const [todayFeedings, setTodayFeedings] = useState<Date[]>([]);
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
        'https://raw.githubusercontent.com/bobarke2000/dogfood/main/beacon_events.csv'
      );
      
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const text = await response.text();
      const lines = text.trim().split('\n');
      
      // Skip header
      const events = lines.slice(1).map(line => {
        const [timestamp] = line.split(',');
        return new Date(timestamp);
      }).filter(date => !isNaN(date.getTime()));

      if (events.length === 0) {
        setLastFed(null);
        setTodayFeedings([]);
        setLoading(false);
        return;
      }

      // Sort by most recent first
      events.sort((a, b) => b.getTime() - a.getTime());

      // Filter for feeding windows (6-10am, 4-9pm)
      const validFeedings = events.filter(date => {
        const hour = date.getHours();
        return (hour >= 6 && hour < 10) || (hour >= 16 && hour < 21);
      });

      if (validFeedings.length > 0) {
        setLastFed(validFeedings[0]);

        // Get today's feedings
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEvents = validFeedings.filter(date => {
          const eventDay = new Date(date);
          eventDay.setHours(0, 0, 0, 0);
          return eventDay.getTime() === today.getTime();
        });
        setTodayFeedings(todayEvents);
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const getTimeSince = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ${minutes}m ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h ago`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const shouldBeFed = () => {
    if (!lastFed) return true;
    
    const now = new Date();
    const hour = now.getHours();
    const lastFedHour = lastFed.getHours();
    
    // Morning feeding (6-10am)
    if (hour >= 6 && hour < 10) {
      // Check if last feeding was yesterday evening or earlier
      const morningToday = new Date(now);
      morningToday.setHours(6, 0, 0, 0);
      return lastFed < morningToday;
    }
    
    // Evening feeding (4-9pm)
    if (hour >= 16 && hour < 21) {
      // Check if last feeding was this morning or earlier
      const eveningToday = new Date(now);
      eveningToday.setHours(16, 0, 0, 0);
      return lastFed < eveningToday;
    }
    
    return false;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-2xl text-gray-700">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
          <div className="text-red-600 text-xl font-semibold mb-2">Error</div>
          <div className="text-gray-700">{error}</div>
        </div>
      </div>
    );
  }

  const needsFeeding = shouldBeFed();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">
          🐕 Dog Feeding Tracker
        </h1>

        {/* Main Status Card */}
        <div className={`rounded-2xl shadow-2xl p-8 mb-6 ${
          needsFeeding 
            ? 'bg-gradient-to-br from-orange-400 to-red-500' 
            : 'bg-gradient-to-br from-green-400 to-emerald-500'
        }`}>
          <div className="flex items-center justify-center mb-4">
            {needsFeeding ? (
              <X className="w-20 h-20 text-white" />
            ) : (
              <Check className="w-20 h-20 text-white" />
            )}
          </div>
          
          <div className="text-center text-white">
            <div className="text-2xl font-semibold mb-2">
              {needsFeeding ? 'Time to Feed!' : 'All Fed'}
            </div>
            {lastFed ? (
              <div className="text-lg opacity-90">
                Last fed {getTimeSince(lastFed)}
              </div>
            ) : (
              <div className="text-lg opacity-90">
                No feedings recorded yet
              </div>
            )}
          </div>
        </div>

        {/* Today's Feedings */}
        {todayFeedings.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Today's Feedings
            </h2>
            <div className="space-y-2">
              {todayFeedings.map((feeding, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-gray-700 font-medium">
                    {formatTime(feeding)}
                  </span>
                  <span className="text-gray-500 text-sm">
                    {getTimeSince(feeding)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-gray-600 text-sm">
          Auto-refreshes every 2 minutes • Shows 6-10am and 4-9pm feedings only
        </div>
      </div>
    </div>
  );
};

export default DogFeedingTracker;