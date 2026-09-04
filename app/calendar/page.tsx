'use client';

import { useEffect, useState } from 'react';
import { getSingaporeNow } from '@/lib/timezone';
import { buildMonthGrid, addMonths, getMonthName, type CalendarMonth, type CalendarDay } from '@/lib/calendar';
import type { Todo, Holiday } from '@/lib/db';

export default function CalendarPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [currentDate, setCurrentDate] = useState<string>('');
  const [calendar, setCalendar] = useState<CalendarMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch todos and holidays
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const now = getSingaporeNow().toISOString();
        setCurrentDate(now);

        const [todosRes, holidaysRes] = await Promise.all([
          fetch('/api/todos'),
          fetch('/api/holidays'),
        ]);

        if (!todosRes.ok || !holidaysRes.ok) {
          throw new Error('Failed to load calendar data');
        }

        const todosData = await todosRes.json();
        const holidaysData = await holidaysRes.json();

        setTodos(todosData);
        setHolidays(holidaysData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Build calendar when data changes
  useEffect(() => {
    if (currentDate && todos.length >= 0 && holidays.length >= 0) {
      const month = buildMonthGrid(currentDate, todos, holidays);
      setCalendar(month);
    }
  }, [currentDate, todos, holidays]);

  const handlePrevMonth = () => {
    setCurrentDate(addMonths(currentDate, -1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(getSingaporeNow().toISOString());
  };

  if (loading) {
    return <main style={{ padding: '2rem' }}><p>Loading calendar...</p></main>;
  }

  if (error) {
    return <main style={{ padding: '2rem' }}><p style={{ color: 'red' }}>Error: {error}</p></main>;
  }

  if (!calendar) {
    return <main style={{ padding: '2rem' }}><p>No calendar data available</p></main>;
  }

  return (
    <main style={{ minHeight: '100vh', padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '1rem' }}>📅 Calendar</h1>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button onClick={handlePrevMonth} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>← Previous</button>
          <h2 style={{ margin: '0', marginRight: 'auto', paddingTop: '0.5rem' }}>
            {getMonthName(calendar.month)} {calendar.year}
          </h2>
          <button onClick={handleToday} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Today</button>
          <button onClick={handleNextMonth} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Next →</button>
        </div>
      </div>

      {/* Weekday headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '1px',
        backgroundColor: '#e5e7eb',
        padding: '1px',
        marginBottom: '1rem',
      }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} style={{
            backgroundColor: '#f3f4f6',
            padding: '0.75rem',
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: '0.875rem',
          }}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '1px',
        backgroundColor: '#e5e7eb',
        padding: '1px',
        minHeight: '500px',
      }}>
        {calendar.weeks.flatMap(week =>
          week.days.map(day => (
            <CalendarDayCell key={day.date} day={day} />
          ))
        )}
      </div>

      <div style={{ marginTop: '2rem' }}>
        <a href="/" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 'bold' }}>← Back to Todos</a>
      </div>
    </main>
  );
}

function CalendarDayCell({ day }: { day: CalendarDay }) {
  const isDayOff = day.holiday ? '#fef3c7' : 'white';
  const bgColor = day.isCurrentMonth ? isDayOff : '#f9fafb';
  const textColor = day.isCurrentMonth ? '#1f2937' : '#9ca3af';
  const borderColor = day.isToday ? '#ef4444' : '#e5e7eb';
  const borderWidth = day.isToday ? '3px' : '1px';

  return (
    <div style={{
      backgroundColor: bgColor,
      padding: '0.75rem',
      minHeight: '120px',
      display: 'flex',
      flexDirection: 'column',
      borderRight: borderWidth + ' solid ' + borderColor,
      borderBottom: borderWidth + ' solid ' + borderColor,
      overflow: 'hidden',
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: textColor }}>
        {day.dayOfMonth}
      </div>

      {day.holiday && (
        <div style={{
          fontSize: '0.75rem',
          backgroundColor: '#f59e0b',
          color: 'white',
          padding: '0.25rem 0.5rem',
          borderRadius: '2px',
          marginBottom: '0.5rem',
          fontWeight: 'bold',
        }}>
          🎉 {day.holiday.name}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', fontSize: '0.75rem' }}>
        {day.todos.map(todo => (
          <div
            key={todo.id}
            style={{
              backgroundColor: todo.completed ? '#dbeafe' : '#e0e7ff',
              padding: '0.25rem 0.5rem',
              borderRadius: '2px',
              marginBottom: '0.25rem',
              textDecoration: todo.completed ? 'line-through' : 'none',
              color: '#1f2937',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={todo.title}
          >
            {todo.completed ? '✓ ' : '• '}{todo.title}
          </div>
        ))}
      </div>
    </div>
  );
}
