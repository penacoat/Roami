import type { Trip, TripStopView } from '@roami/shared';
import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { minutesOfDay, validateActivityOverlap } from '../logic/trips';
import { activityName, calendarBounds, formatDuration, timedActivities } from './daySchedule';
import { itineraryStyles as controls } from './itineraryStyles';
import { formatMinutes, formatTimeRange, timeFromMinutes } from './stopTime';
import { tripTheme as theme } from './tripTheme';

const HALF_HOUR = 30;
const SLOT_HEIGHT = 44;
const PX_PER_MINUTE = SLOT_HEIGHT / HALF_HOUR;
const LABEL_WIDTH = 86;
const CARD_MIN_HEIGHT = 34;
const UNSCHEDULED_ROW_HEIGHT = 54;
const SCROLL_EDGE = 58;

type Props = {
  stops: TripStopView[];
  dailyWindow: Trip['dailyWindow'];
  disabled: boolean;
  canEdit: boolean;
  onDragging: (active: boolean) => void;
  onSchedule: (stop: TripStopView, startTime: string) => Promise<string | undefined>;
};

type Grip = {
  start: (stop: TripStopView, top: number, touchY: number, pageY: number) => void;
  move: (pageY: number) => void;
  end: (pageY?: number) => void;
};

type Drag = {
  stop: TripStopView;
  top: number;
  offset: number;
  scrollAtStart: number;
  initialY: number;
  dy: number;
};

function CalendarCard({
  stop,
  top,
  height,
  lane = 0,
  lanes = 1,
  selected,
  disabled,
  onSelect,
  grip,
}: {
  stop: TripStopView;
  top: number;
  height: number;
  lane?: number;
  lanes?: number;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  grip: Grip;
}) {
  const time = stop.startTime ? formatMinutes(minutesOfDay(stop.startTime)) : 'Unscheduled';

  return (
    <View style={[styles.cardRow, { top, height }]} pointerEvents="box-none">
      <View
        style={[
          styles.activity,
          stop.isFixed && styles.fixed,
          selected && styles.selected,
          { left: `${(lane * 100) / lanes}%`, width: `${100 / lanes}%` },
        ]}
      >
        <Pressable
          accessible
          accessibilityRole={disabled ? 'text' : 'button'}
          accessibilityLabel={`${activityName(stop)}, ${time}, ${formatDuration(stop.visitMinutes)}${stop.isFixed ? ', fixed' : ''}`}
          accessibilityHint={disabled ? undefined : 'Select, then tap a calendar time'}
          accessibilityState={disabled ? undefined : { selected }}
          disabled={disabled}
          onPress={onSelect}
          style={styles.cardTextArea}
        >
          <Text numberOfLines={1} style={styles.activityName}>
            {activityName(stop)}
          </Text>
          {height >= 44 && (
            <Text numberOfLines={1} style={styles.activityTime}>
              {stop.isFixed ? 'Fixed · ' : ''}
              {time}
            </Text>
          )}
        </Pressable>
        {!disabled && (
          <View
            testID={`drag-${stop.id}`}
            accessible={false}
            style={styles.grip}
            onStartShouldSetResponder={() => true}
            onResponderGrant={({ nativeEvent }) =>
              grip.start(stop, top, nativeEvent.locationY, nativeEvent.pageY)
            }
            onResponderMove={({ nativeEvent }) => grip.move(nativeEvent.pageY)}
            onResponderRelease={({ nativeEvent }) => grip.end(nativeEvent.pageY)}
            onResponderTerminate={() => grip.end()}
            onResponderTerminationRequest={() => false}
          >
            <Text pointerEvents="none" style={styles.gripText}>
              ⠿
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function DayCalendar({
  stops,
  dailyWindow,
  disabled,
  canEdit,
  onDragging,
  onSchedule,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    stop: TripStopView;
    time: number;
    valid: boolean;
  } | null>(null);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const viewport = useRef(0);
  const dragging = useRef<Drag | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const events = timedActivities(stops);
  const untimed = stops.filter((stop) => !stop.startTime);
  const { start, end } = calendarBounds(dailyWindow, events);
  const trackTop = untimed.length ? 32 + untimed.length * UNSCHEDULED_ROW_HEIGHT : 0;
  const trackHeight = (end - start) * PX_PER_MINUTE;
  const totalHeight = trackTop + trackHeight + 24;
  const selectedStop = stops.find((stop) => stop.id === selected);
  const gripDisabled = disabled || !canEdit;

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  function slotError(stop: TripStopView, time: number) {
    if (time < start || time + stop.visitMinutes > end)
      return 'Choose a time with room for the full activity.';
    const check = validateActivityOverlap(
      stops,
      { ...stop, startTime: timeFromMinutes(time) },
      true,
    );
    return check.ok ? '' : check.error;
  }

  async function schedule(stop: TripStopView, time: number) {
    const problem = slotError(stop, time);
    setError(problem);
    if (problem) return;
    const failure = await onSchedule(stop, timeFromMinutes(time));
    if (failure) setError(failure);
    else setSelected(null);
  }

  function projectedTime(drag: Drag) {
    const top = drag.top + drag.dy + scrollY.current - drag.scrollAtStart;
    const minutes = start + (top - trackTop) / PX_PER_MINUTE;
    return Math.round(minutes / 15) * 15;
  }

  function updatePreview(drag: Drag) {
    const time = projectedTime(drag);
    setPreview(
      time >= start && time < end
        ? { stop: drag.stop, time, valid: !slotError(drag.stop, time) }
        : null,
    );
  }

  const grip: Grip = {
    start(stop, top, touchY, pageY) {
      dragging.current = {
        stop,
        top,
        offset: touchY,
        scrollAtStart: scrollY.current,
        initialY: pageY,
        dy: 0,
      };
      setSelected(stop.id);
      setDragActive(true);
      onDragging(true);
      setError('');
      timer.current = setInterval(() => {
        const drag = dragging.current;
        if (!drag || viewport.current === 0 || Math.abs(drag.dy) < 6) return;
        const pointer = drag.top + drag.offset - drag.scrollAtStart + drag.dy;
        const delta =
          pointer < SCROLL_EDGE ? -12 : pointer > viewport.current - SCROLL_EDGE ? 12 : 0;
        const next = Math.max(0, Math.min(totalHeight - viewport.current, scrollY.current + delta));
        if (delta && next !== scrollY.current) {
          scrollY.current = next;
          scroll.current?.scrollTo({ y: next, animated: false });
          updatePreview(drag);
        }
      }, 32);
    },
    move(pageY) {
      const drag = dragging.current;
      if (!drag) return;
      drag.dy = pageY - drag.initialY;
      updatePreview(drag);
    },
    end(pageY) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      const drag = dragging.current;
      dragging.current = null;
      setPreview(null);
      setDragActive(false);
      onDragging(false);
      if (drag && pageY !== undefined) {
        drag.dy = pageY - drag.initialY;
        if (Math.abs(drag.dy) >= 6) void schedule(drag.stop, projectedTime(drag));
      }
    },
  };

  // Give activities with overlapping times separate columns so all handles stay usable.
  const laneEnds: number[] = [];
  const positioned = events.map((event) => {
    const top = trackTop + (event.start - start) * PX_PER_MINUTE;
    const height = Math.max(CARD_MIN_HEIGHT, (event.end - event.start) * PX_PER_MINUTE - 3);
    const freeLane = laneEnds.findIndex((bottom) => bottom <= top);
    const lane = freeLane < 0 ? laneEnds.length : freeLane;
    laneEnds[lane] = top + height;
    return { ...event, top, height, lane };
  });

  function choose(stop: TripStopView) {
    setError('');
    setSelected((current) => (current === stop.id ? null : stop.id));
  }

  return (
    <View style={styles.container}>
      {canEdit && (
        <Text style={controls.muted} accessibilityLiveRegion="polite">
          {selectedStop
            ? `Choose a time for ${activityName(selectedStop)}.`
            : 'Drag an activity by its handle, or select it and tap a time.'}
        </Text>
      )}
      {error !== '' && (
        <Text accessibilityRole="alert" style={controls.error}>
          {error}
        </Text>
      )}
      <ScrollView
        ref={scroll}
        nestedScrollEnabled
        scrollEnabled={!dragActive}
        scrollEventThrottle={16}
        onScroll={(event) => {
          scrollY.current = event.nativeEvent.contentOffset.y;
        }}
        onLayout={(event) => {
          viewport.current = event.nativeEvent.layout.height;
        }}
        style={[styles.scroll, { height: Math.min(520, totalHeight) }]}
      >
        <View style={{ height: totalHeight }}>
          {untimed.length > 0 && <Text style={styles.unscheduledLabel}>Unscheduled</Text>}
          {untimed.map((stop, index) => (
            <CalendarCard
              key={stop.id}
              stop={stop}
              top={30 + index * UNSCHEDULED_ROW_HEIGHT}
              height={48}
              selected={selected === stop.id}
              disabled={gripDisabled || stop.isFixed}
              onSelect={() => choose(stop)}
              grip={grip}
            />
          ))}
          {Array.from({ length: Math.ceil((end - start) / HALF_HOUR) }, (_, index) => {
            const time = start + index * HALF_HOUR;
            return (
              <Pressable
                key={time}
                accessibilityRole="button"
                accessibilityLabel={`Time slot ${formatMinutes(time)}`}
                disabled={gripDisabled || !selectedStop}
                onPress={() => {
                  if (selectedStop) void schedule(selectedStop, time);
                }}
                style={[styles.slot, { top: trackTop + index * SLOT_HEIGHT }]}
              >
                <Text style={styles.slotTime}>{formatMinutes(time)}</Text>
              </Pressable>
            );
          })}
          <Text style={[styles.lastTime, { top: trackTop + trackHeight }]}>
            {formatMinutes(end)}
          </Text>
          {positioned.map(({ stop, lane, top, height }) => (
            <CalendarCard
              key={stop.id}
              stop={stop}
              top={top}
              height={height}
              lane={lane}
              lanes={laneEnds.length}
              selected={selected === stop.id}
              disabled={gripDisabled || stop.isFixed}
              onSelect={() => choose(stop)}
              grip={grip}
            />
          ))}
          {preview && (
            <View
              pointerEvents="none"
              style={[
                styles.dropPreview,
                !preview.valid && styles.unavailable,
                {
                  top: trackTop + (preview.time - start) * PX_PER_MINUTE,
                  minHeight: Math.max(
                    CARD_MIN_HEIGHT,
                    Math.min(end - preview.time, preview.stop.visitMinutes) * PX_PER_MINUTE - 3,
                  ),
                },
              ]}
            >
              <Text numberOfLines={1} style={styles.activityName}>
                {activityName(preview.stop)}
              </Text>
              <Text numberOfLines={1} style={styles.activityTime}>
                {preview.valid
                  ? formatTimeRange(timeFromMinutes(preview.time), preview.stop.visitMinutes)
                  : 'Time unavailable'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  scroll: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 10,
  },
  unscheduledLabel: { color: theme.ink, fontWeight: '700', padding: 8 },
  slot: {
    position: 'absolute',
    width: '100%',
    height: SLOT_HEIGHT,
    borderTopWidth: 1,
    borderColor: theme.line,
  },
  slotTime: { color: theme.muted, fontSize: 12, paddingHorizontal: 7, paddingVertical: 7 },
  lastTime: {
    position: 'absolute',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: theme.line,
    paddingHorizontal: 7,
    color: theme.muted,
    fontSize: 12,
  },
  cardRow: { position: 'absolute', left: LABEL_WIDTH, right: 4 },
  activity: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    flexDirection: 'row',
    backgroundColor: theme.butter,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 7,
    overflow: 'hidden',
  },
  fixed: { backgroundColor: theme.paper, borderColor: theme.accent },
  selected: { borderColor: theme.ink, borderWidth: 2 },
  cardTextArea: { flex: 1, minWidth: 0, justifyContent: 'center', paddingHorizontal: 7 },
  activityName: { color: theme.ink, fontWeight: '700', fontSize: 13 },
  activityTime: { color: theme.muted, fontSize: 11 },
  grip: {
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderColor: theme.line,
  },
  gripText: { color: theme.ink, fontSize: 19, lineHeight: 22 },
  dropPreview: {
    position: 'absolute',
    left: LABEL_WIDTH,
    right: 4,
    padding: 4,
    backgroundColor: theme.card,
    borderWidth: 2,
    borderRadius: 7,
    borderStyle: 'dashed',
    borderColor: theme.ink,
  },
  unavailable: { borderColor: theme.accent },
});
