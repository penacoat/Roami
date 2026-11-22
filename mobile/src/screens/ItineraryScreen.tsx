import type { TripStopView, TripView, UpdateStopDetailsRequest } from '@roami/shared';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, callApi } from '../api';
import { SharePicker } from '../components/SharePicker';
import { VisitPlace } from '../components/PlaceJournal';
import { describeDayStops } from '../logic/stopDetails';
import { ItineraryMap } from '../trips/ItineraryMap';
import { PreparationChecklist } from '../trips/PreparationChecklist';
import { CostEditor, StopInsights } from '../trips/StopInsights';
import { StopChangePreview, type StopChange } from '../trips/StopChangePreview';
import { DayCalendar } from '../trips/DayCalendar';
import { formatDuration, timeBetweenActivities, timedActivities } from '../trips/daySchedule';
import { DayPlacePicker, FixedActivityForm } from '../trips/DayAdditions';
import { ItineraryOptions } from '../trips/ItineraryOptions';
import { MAX_STOPS_PER_DAY } from '../logic/trips';
import { dateKey, tripDays, formatDate } from '../trips/tripDraft';
import { itineraryDayLabel } from '../trips/itineraryDayLabel';
import { itineraryStyles as styles } from '../trips/itineraryStyles';
import {
  DEFAULT_END,
  DEFAULT_START,
  formatTimeRange,
  formatMinutes,
  rangeFromMinutes,
  stopRange,
} from '../trips/stopTime';
import { TimeRangePicker } from '../trips/TimeRangePicker';
import { TripMemories } from '../trips/TripMemories';
import { removeTripPhotos } from '../trips/tripPhotos';

export function ItineraryScreen({
  tripId,
  onBack,
  onExplore,
  onOpenPlace,
}: {
  tripId: string;
  onBack: () => void;
  onExplore: () => void;
  onOpenPlace: (placeId: string) => void;
}) {
  const [view, setView] = useState<TripView | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState(DEFAULT_START);
  const [editEnd, setEditEnd] = useState(DEFAULT_END);
  const [timeError, setTimeError] = useState('');
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState<{ day: number; kind: 'place' | 'fixed' } | null>(null);
  const [comparing, setComparing] = useState(false);
  const [day, setDay] = useState(1);
  const [mode, setMode] = useState<'list' | 'calendar' | 'map'>('list');
  const [proposal, setProposal] = useState<StopChange | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [photosBusy, setPhotosBusy] = useState(false);
  const busy = useRef(false);
  const loadKey = JSON.stringify([tripId, retry]);
  const loading = loadedKey !== loadKey;
  useEffect(() => {
    let active = true;
    callApi('getTrip', { tripId })
      .then(({ trip }) => {
        if (active) {
          setView(trip);
          setError('');
        }
      })
      .catch(() => {
        if (active) setError('Could not load this itinerary. Try again.');
      })
      .finally(() => {
        if (active) setLoadedKey(loadKey);
      });
    return () => {
      active = false;
    };
  }, [tripId, loadKey]);

  // Sends one stop change with the revision on screen. If someone else changed
  // the trip first, reload it so the user sees the current stops before retrying.
  async function change(
    run: (view: TripView) => Promise<{ trip: TripView }>,
    failureMessage: string,
    successMessage: string,
    inline = false,
  ) {
    if (!view || busy.current) return;
    busy.current = true;
    setPending(true);
    setNotice('');
    try {
      const result = await run(view);
      setView(result.trip);
      setConfirmingId(null);
      setMovingId(null);
      setEditingId(null);
      setAdding(null);
      setNotice(successMessage);
    } catch (failure) {
      setConfirmingId(null);
      setMovingId(null);
      if (
        failure &&
        typeof failure === 'object' &&
        'code' in failure &&
        failure.code === 'aborted'
      ) {
        setEditingId(null);
        setNotice('This itinerary changed. Review it and try again.');
        setRetry((value) => value + 1);
      } else {
        const message =
          failure instanceof ApiError && failure.code === 'invalid-argument'
            ? failure.message
            : failureMessage;
        if (inline) return message;
        setNotice(message);
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function stopName(stop: TripStopView) {
    return stop.place?.name ?? stop.title ?? 'this place';
  }

  function remove(stop: TripStopView) {
    const name = stopName(stop);
    return change(
      (current) =>
        callApi('removeStop', {
          tripId,
          expectedRevision: current.trip.revision,
          stopId: stop.id,
        }),
      `Could not remove ${name}. Try again.`,
      `Removed ${name}.`,
    );
  }

  function move(stop: TripStopView, day: number, order: number) {
    if (!view || stop.isFixed) return;
    setProposal({
      before: stop,
      after: { ...stop, day, order },
      revision: view.trip.revision,
      kind: 'move',
    });
  }

  // Why a stop can't go to a day, or null if it can.
  function dayProblem(stop: TripStopView, day: number): string | null {
    if (!view) return null;
    if (day === stop.day) return 'current day';
    const dayStops = view.stops.filter((other) => other.day === day);
    if (stop.placeId && dayStops.some((other) => other.placeId === stop.placeId)) {
      return 'already there';
    }
    if (dayStops.length >= MAX_STOPS_PER_DAY) return 'full';
    return null;
  }

  function openTimeEditor(stop: TripStopView) {
    setNotice('');
    setConfirmingId(null);
    setMovingId(null);
    setTimeError('');
    const range = stopRange(stop);
    setEditStart(range.start);
    setEditEnd(range.end);
    setEditingId(stop.id);
  }

  function saveTime(stop: TripStopView) {
    const range = rangeFromMinutes(editStart, editEnd);
    if (!range.ok) {
      setTimeError(range.error);
      return;
    }
    setTimeError('');
    proposeTime(stop, range.startTime, range.visitMinutes);
  }

  function proposeTime(
    stop: TripStopView,
    startTime: string | null,
    visitMinutes: number,
    requireOpenSlot = false,
  ) {
    if (!view) return;
    setProposal({
      before: stop,
      after: { ...stop, startTime, visitMinutes },
      revision: view.trip.revision,
      kind: 'time',
      requireOpenSlot,
    });
  }

  function clearTime(stop: TripStopView) {
    proposeTime(stop, null, stop.visitMinutes);
  }

  const dayCount = view ? tripDays(view.trip.startDate, view.trip.endDate) : 0;
  const stops = useMemo(() => view?.stops.filter((stop) => stop.day === day) ?? [], [view, day]);
  const events = timedActivities(stops);
  const gaps = timeBetweenActivities(events);
  const insights = new Map(describeDayStops(stops).map((entry) => [entry.stop.id, entry]));
  const canEdit = view?.canEdit !== false;

  async function scheduleInCalendar(stop: TripStopView, startTime: string) {
    proposeTime(stop, startTime, stop.visitMinutes, true);
    return undefined;
  }

  function applyProposal() {
    if (!proposal) return;
    setProposal(null);
    const { before, after, revision, kind, requireOpenSlot } = proposal;
    const name = stopName(before);
    const base = { tripId, expectedRevision: revision, stopId: before.id };
    if (kind === 'move') {
      void change(
        () => callApi('moveStop', { ...base, day: after.day, order: after.order }),
        `Could not move ${name}. Try again.`,
        before.day === after.day ? `Moved ${name}.` : `Moved ${name} to Day ${after.day}.`,
      );
      return;
    }
    const success =
      requireOpenSlot && after.startTime
        ? `Scheduled ${name} at ${formatTimeRange(after.startTime, after.visitMinutes)}.`
        : after.startTime
          ? `Set time for ${name}.`
          : `Cleared the time for ${name}.`;
    void change(
      () =>
        callApi('updateStopTime', {
          ...base,
          startTime: after.startTime,
          visitMinutes: after.visitMinutes,
          requireOpenSlot,
        }),
      `Could not save the time for ${name}. Try again.`,
      success,
    );
  }

  function updateDetails(
    stop: TripStopView,
    values: Pick<UpdateStopDetailsRequest, 'cost' | 'isRequired'>,
  ) {
    return change(
      (current) =>
        callApi('updateStopDetails', {
          tripId,
          expectedRevision: current.trip.revision,
          stopId: stop.id,
          ...values,
        }),
      'Could not update this activity. Try again.',
      values.isRequired === true
        ? `Marked ${stopName(stop)} as must-do.`
        : values.isRequired === false
          ? `Removed must-do from ${stopName(stop)}.`
          : 'Cost updated.',
      values.isRequired === undefined,
    );
  }

  async function deleteItinerary() {
    if (!view || !canEdit || busy.current || photosBusy) return;
    busy.current = true;
    setPending(true);
    setDeleteError('');
    try {
      await callApi('deleteTrip', { tripId, expectedRevision: view.trip.revision });
      if (Platform.OS !== 'web') {
        try {
          removeTripPhotos(view.trip.ownerId, tripId);
        } catch {
          // A failed local cleanup cannot undo the completed Firestore deletion.
        }
      }
      setDeleteOpen(false);
      onBack();
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'aborted') {
        setDeleteOpen(false);
        setNotice('This itinerary changed. Review it before deleting.');
        setRetry((value) => value + 1);
      } else {
        setDeleteError('Could not delete this itinerary. Try again.');
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function selectDay(value: number) {
    setDay(value);
    setComparing(false);
    setDetails(null);
    setAdding(null);
    setEditingId(null);
    setMovingId(null);
    setConfirmingId(null);
    setNotice('');
  }

  function controlStyle(disabled: boolean) {
    return [styles.button, disabled && styles.disabled];
  }

  function toggleAddition(day: number, kind: 'place' | 'fixed') {
    setAdding(adding?.day === day && adding.kind === kind ? null : { day, kind });
    setConfirmingId(null);
    setMovingId(null);
    setEditingId(null);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        scrollEnabled={!dragging}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.button}>
          <Text style={styles.buttonText}>← Itineraries</Text>
        </Pressable>
        {loading ? (
          <ActivityIndicator accessibilityLabel="Loading itinerary" />
        ) : error ? (
          <>
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.button}
              onPress={() => setRetry((value) => value + 1)}
            >
              <Text style={styles.buttonText}>Retry</Text>
            </Pressable>
          </>
        ) : view ? (
          <>
            <Text accessibilityRole="header" style={styles.title}>
              {view.trip.city}
            </Text>
            <Text style={styles.muted}>
              {formatDate(view.trip.startDate)} – {formatDate(view.trip.endDate)}
            </Text>
            {canEdit && (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: comparing, disabled: pending }}
                  disabled={pending}
                  onPress={() => setComparing((value) => !value)}
                  style={[styles.button, styles.primary]}
                >
                  <Text style={styles.primaryText}>
                    {comparing ? 'Close itinerary options' : 'Generate itinerary'}
                  </Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={onExplore} style={styles.button}>
                  <Text style={styles.buttonText}>Explore places to add</Text>
                </Pressable>
                {comparing && (
                  <ItineraryOptions
                    key={view.trip.revision}
                    view={view}
                    pending={pending}
                    onApply={(placeIds, strategy) =>
                      change(
                        (current) =>
                          callApi('applyItinerary', {
                            tripId,
                            expectedRevision: current.trip.revision,
                            placeIds,
                            strategy,
                          }).then((result) => {
                            setComparing(false);
                            return result;
                          }),
                        'Could not save this itinerary. Try again.',
                        'Itinerary updated.',
                        true,
                      )
                    }
                  />
                )}
              </>
            )}
            {notice ? (
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.muted}>
                {notice}
              </Text>
            ) : null}
            <View style={styles.wrap}>
              {Array.from({ length: dayCount }, (_, index) => index + 1).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={itineraryDayLabel(view.trip.startDate, value)}
                  accessibilityState={{ selected: day === value, disabled: pending || dragging }}
                  disabled={pending || dragging}
                  onPress={() => selectDay(value)}
                  style={[styles.button, day === value && styles.selected]}
                >
                  <Text style={styles.buttonText}>Day {value}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.daySection}>
              <Text accessibilityRole="header" style={styles.heading}>
                {itineraryDayLabel(view.trip.startDate, day)}
              </Text>
              <View style={styles.wrap}>
                {(['list', 'calendar', 'map'] as const).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: mode === value }}
                    disabled={pending || dragging}
                    onPress={() => setMode(value)}
                    style={[styles.button, mode === value && styles.selected]}
                  >
                    <Text style={styles.buttonText}>
                      {value === 'list' ? 'Day list' : value === 'map' ? 'Map' : 'Calendar'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {canEdit && (
                <>
                  <View style={styles.wrap}>
                    {(['place', 'fixed'] as const).map((kind) => {
                      const active = adding?.day === day && adding.kind === kind;
                      const disabled =
                        pending || (kind === 'fixed' && stops.length >= MAX_STOPS_PER_DAY);
                      const label = kind === 'place' ? 'Add place' : 'Add fixed activity';
                      return (
                        <Pressable
                          key={kind}
                          accessibilityRole="button"
                          accessibilityLabel={
                            active
                              ? `Close ${kind === 'place' ? 'place picker' : 'fixed activity form'} for Day ${day}`
                              : `${label} to Day ${day}`
                          }
                          accessibilityState={{ expanded: active, disabled }}
                          disabled={disabled}
                          onPress={() => toggleAddition(day, kind)}
                          style={[controlStyle(disabled), active && styles.selected]}
                        >
                          <Text style={styles.buttonText}>
                            {active
                              ? kind === 'place'
                                ? 'Close places'
                                : 'Close activity form'
                              : `+ ${label}`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {adding?.day === day && adding.kind === 'place' && (
                    <DayPlacePicker
                      view={view}
                      day={day}
                      onExplore={onExplore}
                      onChanged={setView}
                    />
                  )}
                  {adding?.day === day && adding.kind === 'fixed' && (
                    <FixedActivityForm
                      day={day}
                      hours={view.trip.dailyWindow}
                      pending={pending}
                      onSave={(activity) =>
                        change(
                          (current) =>
                            callApi('addFixedActivity', {
                              ...activity,
                              tripId,
                              expectedRevision: current.trip.revision,
                              day,
                            }),
                          'Could not save this fixed activity. Try again.',
                          `Added ${activity.title} to Day ${day}.`,
                          true,
                        )
                      }
                    />
                  )}
                </>
              )}
              {events.length > 1 && (
                <View style={styles.card}>
                  <Text accessibilityRole="header" style={styles.text}>
                    Time between activities
                  </Text>
                  {gaps.length ? (
                    gaps.map((gap) => (
                      <Text key={gap.start} style={styles.muted}>
                        {formatMinutes(gap.start)} – {formatMinutes(gap.end)} ·{' '}
                        {formatDuration(gap.end - gap.start)} free
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.muted}>No free time between timed activities.</Text>
                  )}
                </View>
              )}
              {mode === 'map' ? (
                <ItineraryMap
                  key={day}
                  stops={stops}
                  hours={view.trip.dailyWindow}
                  onList={() => setMode('list')}
                />
              ) : mode === 'calendar' ? (
                <DayCalendar
                  key={day}
                  stops={stops}
                  dailyWindow={view.trip.dailyWindow}
                  disabled={pending}
                  canEdit={canEdit}
                  onDragging={setDragging}
                  onSchedule={scheduleInCalendar}
                />
              ) : (
                <>
                  {stops.length === 0 && <Text style={styles.muted}>Nothing scheduled yet.</Text>}
                  {stops.length >= MAX_STOPS_PER_DAY && (
                    <Text style={styles.muted}>Day is full · {MAX_STOPS_PER_DAY} stops</Text>
                  )}
                  {stops.map((stop, index) => {
                    const name = stopName(stop);
                    const first = index === 0;
                    const last = index === stops.length - 1;
                    return (
                      <View key={stop.id} style={styles.card}>
                        {stop.place ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Open ${stop.place.name}`}
                            onPress={() => onOpenPlace(stop.place!.id)}
                          >
                            <Text style={styles.text}>
                              {stop.order}. {stop.place.name}
                            </Text>
                          </Pressable>
                        ) : (
                          <Text style={styles.text}>{stop.title ?? 'Place unavailable'}</Text>
                        )}
                        {stop.isFixed && <Text style={styles.fixedLabel}>Fixed activity</Text>}
                        {stop.isRequired && <Text style={styles.fixedLabel}>Must-do</Text>}
                        <StopInsights
                          entry={insights.get(stop.id)!}
                          hours={view.trip.dailyWindow}
                        />
                        {canEdit && (
                          <>
                            <View style={styles.wrap}>
                              {!stop.isFixed && (
                                <Pressable
                                  accessibilityRole="checkbox"
                                  accessibilityLabel={`Must-do ${name}`}
                                  accessibilityState={{
                                    checked: stop.isRequired,
                                    disabled: pending,
                                  }}
                                  disabled={pending}
                                  onPress={() =>
                                    void updateDetails(stop, { isRequired: !stop.isRequired })
                                  }
                                  style={[styles.button, stop.isRequired && styles.selected]}
                                >
                                  <Text style={styles.buttonText}>
                                    {stop.isRequired ? '✓ Must-do' : 'Mark must-do'}
                                  </Text>
                                </Pressable>
                              )}
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Preparation for ${name}`}
                                accessibilityState={{ expanded: details === stop.id }}
                                style={styles.button}
                                onPress={() =>
                                  setDetails((current) => (current === stop.id ? null : stop.id))
                                }
                              >
                                <Text style={styles.buttonText}>
                                  {details === stop.id ? 'Close preparation' : 'Preparation & cost'}
                                </Text>
                              </Pressable>
                            </View>
                            {details === stop.id && (
                              <>
                                <CostEditor
                                  key={stop.id}
                                  stop={stop}
                                  disabled={pending}
                                  onSave={(cost) => updateDetails(stop, { cost })}
                                />
                                <PreparationChecklist
                                  tripId={tripId}
                                  stopId={stop.id}
                                  revision={view.trip.revision}
                                />
                                {stop.place && <VisitPlace place={stop.place} />}
                              </>
                            )}
                          </>
                        )}

                        {canEdit ? (
                          <>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={
                                stop.startTime
                                  ? `Change time for ${name}, ${formatTimeRange(stop.startTime, stop.visitMinutes)}`
                                  : `Set time for ${name}`
                              }
                              accessibilityState={{ disabled: pending }}
                              disabled={pending}
                              onPress={() => openTimeEditor(stop)}
                              style={styles.timeChip}
                            >
                              <Text style={styles.timeText}>
                                {stop.startTime
                                  ? formatTimeRange(stop.startTime, stop.visitMinutes)
                                  : 'Set time'}{' '}
                              </Text>
                            </Pressable>
                            {editingId === stop.id ? (
                              <View style={{ gap: 8 }}>
                                <TimeRangePicker
                                  start={editStart}
                                  end={editEnd}
                                  subject={name}
                                  disabled={pending}
                                  onChange={(nextStart, nextEnd) => {
                                    setEditStart(nextStart);
                                    setEditEnd(nextEnd);
                                    setTimeError('');
                                  }}
                                />
                                {timeError ? (
                                  <Text accessibilityRole="alert" style={styles.error}>
                                    {timeError}
                                  </Text>
                                ) : null}
                                <View style={styles.wrap}>
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Save time for ${name}`}
                                    accessibilityState={{ disabled: pending, busy: pending }}
                                    disabled={pending}
                                    onPress={() => void saveTime(stop)}
                                    style={[
                                      styles.button,
                                      styles.primary,
                                      pending && styles.disabled,
                                    ]}
                                  >
                                    <Text style={styles.primaryText}>Save time</Text>
                                  </Pressable>
                                  {stop.startTime && !stop.isFixed && (
                                    <Pressable
                                      accessibilityRole="button"
                                      accessibilityLabel={`Clear time for ${name}`}
                                      disabled={pending}
                                      onPress={() => void clearTime(stop)}
                                      style={controlStyle(pending)}
                                    >
                                      <Text style={styles.buttonText}>Clear time</Text>
                                    </Pressable>
                                  )}
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Cancel editing time for ${name}`}
                                    disabled={pending}
                                    onPress={() => setEditingId(null)}
                                    style={controlStyle(pending)}
                                  >
                                    <Text style={styles.buttonText}>Cancel</Text>
                                  </Pressable>
                                </View>
                              </View>
                            ) : confirmingId === stop.id ? (
                              <View style={{ gap: 8 }}>
                                <Text style={styles.text}>Remove {name} from this itinerary?</Text>
                                <View style={styles.wrap}>
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Confirm removing ${name}`}
                                    accessibilityState={{ disabled: pending, busy: pending }}
                                    disabled={pending}
                                    onPress={() => void remove(stop)}
                                    style={[
                                      styles.button,
                                      styles.primary,
                                      pending && styles.disabled,
                                    ]}
                                  >
                                    <Text style={styles.primaryText}>Remove</Text>
                                  </Pressable>
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Keep ${name}`}
                                    disabled={pending}
                                    onPress={() => setConfirmingId(null)}
                                    style={controlStyle(pending)}
                                  >
                                    <Text style={styles.buttonText}>Keep</Text>
                                  </Pressable>
                                </View>
                              </View>
                            ) : movingId === stop.id ? (
                              <View style={{ gap: 8 }}>
                                <Text style={styles.text}>Move {name} to which day?</Text>
                                <View style={styles.wrap}>
                                  {Array.from({ length: dayCount }, (_, i) => i + 1).map(
                                    (target) => {
                                      const problem = dayProblem(stop, target);
                                      const off = pending || problem !== null;
                                      return (
                                        <Pressable
                                          key={target}
                                          accessibilityRole="button"
                                          accessibilityLabel={
                                            problem
                                              ? `Day ${target}, ${problem}`
                                              : `Move ${name} to Day ${target}`
                                          }
                                          accessibilityState={{ disabled: off }}
                                          disabled={off}
                                          onPress={() =>
                                            void move(
                                              stop,
                                              target,
                                              view.stops.filter((other) => other.day === target)
                                                .length + 1,
                                            )
                                          }
                                          style={controlStyle(off)}
                                        >
                                          <Text style={styles.buttonText}>Day {target}</Text>
                                        </Pressable>
                                      );
                                    },
                                  )}
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Cancel moving ${name}`}
                                    disabled={pending}
                                    onPress={() => setMovingId(null)}
                                    style={controlStyle(pending)}
                                  >
                                    <Text style={styles.buttonText}>Cancel</Text>
                                  </Pressable>
                                </View>
                              </View>
                            ) : (
                              <View style={styles.wrap}>
                                {!stop.isFixed && (
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Move ${name} earlier`}
                                    accessibilityState={{ disabled: pending || first }}
                                    disabled={pending || first}
                                    onPress={() => void move(stop, stop.day, stop.order - 1)}
                                    style={controlStyle(pending || first)}
                                  >
                                    <Text style={styles.buttonText}>↑ Earlier</Text>
                                  </Pressable>
                                )}
                                {!stop.isFixed && (
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Move ${name} later`}
                                    accessibilityState={{ disabled: pending || last }}
                                    disabled={pending || last}
                                    onPress={() => void move(stop, stop.day, stop.order + 1)}
                                    style={controlStyle(pending || last)}
                                  >
                                    <Text style={styles.buttonText}>↓ Later</Text>
                                  </Pressable>
                                )}
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={`Remove ${name}`}
                                  accessibilityState={{ disabled: pending }}
                                  disabled={pending}
                                  onPress={() => {
                                    setNotice('');
                                    setMovingId(null);
                                    setEditingId(null);
                                    setConfirmingId(stop.id);
                                  }}
                                  style={controlStyle(pending)}
                                >
                                  <Text style={styles.buttonText}>Remove</Text>
                                </Pressable>
                                {!stop.isFixed && dayCount > 1 && (
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Change day for ${name}`}
                                    accessibilityState={{ disabled: pending }}
                                    disabled={pending}
                                    onPress={() => {
                                      setNotice('');
                                      setConfirmingId(null);
                                      setEditingId(null);
                                      setMovingId(stop.id);
                                    }}
                                    style={controlStyle(pending)}
                                  >
                                    <Text style={styles.buttonText}>Change day</Text>
                                  </Pressable>
                                )}
                              </View>
                            )}
                          </>
                        ) : (
                          <Text style={styles.timeText}>
                            {stop.startTime
                              ? formatTimeRange(stop.startTime, stop.visitMinutes)
                              : 'Unscheduled'}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </>
              )}
            </View>
            {canEdit && view.stops.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: sharing }}
                style={[styles.button, { alignSelf: 'flex-start' }]}
                onPress={() => setSharing((value) => !value)}
              >
                <Text style={styles.buttonText}>
                  {sharing ? 'Close share preview' : 'Share itinerary'}
                </Text>
              </Pressable>
            )}
            {canEdit && sharing && (
              <SharePicker
                title={`${view.trip.city} itinerary`}
                items={view.stops.map((stop) => {
                  const label = `Day ${stop.day} · ${stopName(stop)}`;
                  return {
                    id: stop.id,
                    label,
                    text: `${label}${stop.startTime ? ` · ${formatTimeRange(stop.startTime, stop.visitMinutes)}` : ''}`,
                  };
                })}
              />
            )}
            {proposal && (
              <StopChangePreview
                change={proposal}
                hours={view.trip.dailyWindow}
                stops={view.stops}
                disabled={pending}
                onCancel={() => setProposal(null)}
                onApply={applyProposal}
              />
            )}
            {canEdit && Platform.OS !== 'web' && dateKey(new Date()) > view.trip.endDate && (
              <TripMemories
                tripId={tripId}
                ownerId={view.trip.ownerId}
                disabled={pending || dragging}
                onBusy={setPhotosBusy}
              />
            )}
            {canEdit && (
              <Pressable
                accessibilityRole="button"
                disabled={pending || dragging || photosBusy}
                onPress={() => {
                  setDeleteError('');
                  setDeleteOpen(true);
                }}
                style={[styles.button, styles.dangerOutline]}
              >
                <Text style={styles.dangerText}>Delete itinerary</Text>
              </Pressable>
            )}
            <Modal
              visible={deleteOpen}
              transparent
              animationType="fade"
              onRequestClose={() => {
                if (!busy.current) setDeleteOpen(false);
              }}
            >
              <View style={styles.confirmBackdrop}>
                <View accessibilityViewIsModal style={styles.confirmCard}>
                  <Text accessibilityRole="header" style={styles.heading}>
                    Delete {view.trip.city} itinerary?
                  </Text>
                  <Text style={styles.text}>
                    This removes the itinerary and its activities for everyone it was shared with.
                  </Text>
                  {deleteError && (
                    <Text accessibilityRole="alert" style={styles.error}>
                      {deleteError}
                    </Text>
                  )}
                  <View style={styles.wrap}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={pending}
                      style={styles.button}
                      onPress={() => setDeleteOpen(false)}
                    >
                      <Text style={styles.buttonText}>Keep itinerary</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Confirm delete itinerary"
                      accessibilityState={{ disabled: pending, busy: pending }}
                      disabled={pending}
                      style={[styles.button, styles.danger]}
                      onPress={() => void deleteItinerary()}
                    >
                      <Text style={styles.primaryText}>
                        {pending ? 'Deleting…' : 'Delete itinerary'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
