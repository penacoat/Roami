import type { PlaceJournalResponse, PlaceSummary } from '@roami/shared';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { ApiError, callApi } from '../api';
import { itineraryStyles as styles } from '../trips/itineraryStyles';
import { dateKey, formatDate } from '../trips/tripDraft';
import { SharePicker } from './SharePicker';

export function VisitPlace({ place }: { place: PlaceSummary }) {
  const [expanded, setExpanded] = useState(false);
  const [date, setDate] = useState(() => dateKey(new Date()));
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const busy = useRef(false);

  async function mark() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setNotice('');
    try {
      await callApi('markVisited', { placeId: place.id, visitDate: date.trim() });
      setExpanded(false);
      setNotice(`Visit recorded for ${formatDate(date.trim())}.`);
    } catch (error) {
      setNotice(
        error instanceof ApiError ? error.message : 'Could not record this visit. Try again.',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.button}
        disabled={pending}
        onPress={() => {
          setExpanded((value) => !value);
          setNotice('');
        }}
      >
        <Text style={styles.buttonText}>{expanded ? 'Cancel visit' : 'Mark visited'}</Text>
      </Pressable>
      {expanded && (
        <>
          <TextInput
            accessibilityLabel="Visit date"
            value={date}
            maxLength={10}
            editable={!pending}
            style={styles.input}
            placeholder="YYYY-MM-DD"
            onChangeText={setDate}
          />
          <Pressable
            accessibilityRole="button"
            style={styles.button}
            disabled={pending}
            onPress={() => void mark()}
          >
            <Text style={styles.buttonText}>Save visit</Text>
          </Pressable>
        </>
      )}
      {notice && (
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {notice}
        </Text>
      )}
    </View>
  );
}

export function PlaceJournal({ refreshKey = 0 }: { refreshKey?: number }) {
  const [journal, setJournal] = useState<PlaceJournalResponse | null>(null);
  const [category, setCategory] = useState('');
  const [sharing, setSharing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    let active = true;
    callApi('getPlaceJournal', {})
      .then((result) => {
        if (active) {
          setJournal(result);
          setError('');
        }
      })
      .catch(() => {
        if (active) setError('Could not load visits and rankings.');
      });
    return () => {
      active = false;
    };
  }, [refreshKey, retry]);

  const categories = [...new Set(journal?.visited.map(({ place }) => place.category) ?? [])].sort();
  const activeCategory = categories.includes(category) ? category : categories[0];
  const visits = journal?.visited.filter(({ place }) => place.category === activeCategory) ?? [];
  const placeIds =
    journal?.rankings.find((item) => item.category === activeCategory)?.placeIds ?? [];
  const ranked = placeIds.flatMap((id) => visits.filter(({ place }) => place.id === id));
  const unranked = visits.filter(({ place }) => !placeIds.includes(place.id));

  async function save(next: string[]) {
    if (busy.current || !activeCategory) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      setJournal(await callApi('saveRanking', { category: activeCategory, placeIds: next }));
    } catch (failure) {
      setError(
        failure instanceof ApiError ? failure.message : 'Could not save the ranking. Try again.',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function reposition(index: number, target: number) {
    const ids = [...ranked.map(({ place }) => place.id)];
    const [placeId] = ids.splice(index, 1);
    ids.splice(target, 0, placeId);
    void save(ids);
  }

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>
        Visits & rankings
      </Text>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {!journal ? (
        error ? (
          <Pressable
            accessibilityRole="button"
            style={styles.button}
            onPress={() => {
              setError('');
              setRetry((value) => value + 1);
            }}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        ) : (
          <ActivityIndicator accessibilityLabel="Loading visits" />
        )
      ) : categories.length === 0 ? (
        <Text style={styles.muted}>
          Mark a place visited from its details or your itinerary to rank it here.
        </Text>
      ) : (
        <>
          <View style={styles.wrap}>
            {categories.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: activeCategory === value }}
                style={[styles.button, activeCategory === value && styles.selected]}
                disabled={pending}
                onPress={() => {
                  setCategory(value);
                  setSharing(false);
                }}
              >
                <Text style={styles.buttonText}>{value}</Text>
              </Pressable>
            ))}
          </View>
          {ranked.map(({ place, visitDate }, index) => (
            <View key={place.id} style={styles.daySection}>
              <Text style={styles.text}>
                {index + 1}. {place.name}
              </Text>
              <Text style={styles.muted}>Visited {formatDate(visitDate)}</Text>
              <View style={styles.wrap}>
                {index > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${place.name} up in ranking`}
                    style={styles.button}
                    disabled={pending}
                    onPress={() => reposition(index, index - 1)}
                  >
                    <Text style={styles.buttonText}>Move up</Text>
                  </Pressable>
                )}
                {index < ranked.length - 1 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${place.name} down in ranking`}
                    style={styles.button}
                    disabled={pending}
                    onPress={() => reposition(index, index + 1)}
                  >
                    <Text style={styles.buttonText}>Move down</Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${place.name} from ranking`}
                  style={styles.button}
                  disabled={pending}
                  onPress={() =>
                    void save(
                      ranked
                        .filter((item) => item.place.id !== place.id)
                        .map((item) => item.place.id),
                    )
                  }
                >
                  <Text style={styles.buttonText}>Remove rank</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {unranked.map(({ place, visitDate }) => (
            <Pressable
              key={place.id}
              accessibilityRole="button"
              accessibilityLabel={`Rank ${place.name}`}
              style={styles.button}
              disabled={pending}
              onPress={() => void save([...ranked.map((item) => item.place.id), place.id])}
            >
              <Text style={styles.buttonText}>Rank {place.name}</Text>
              <Text style={styles.muted}>Visited {formatDate(visitDate)}</Text>
            </Pressable>
          ))}
          {ranked.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: sharing }}
              style={styles.button}
              onPress={() => setSharing((value) => !value)}
            >
              <Text style={styles.buttonText}>
                {sharing ? 'Close share preview' : 'Share ranking'}
              </Text>
            </Pressable>
          )}
          {sharing && (
            <SharePicker
              key={activeCategory}
              title={`My ${activeCategory} ranking`}
              items={ranked.map(({ place }, index) => ({
                id: place.id,
                label: place.name,
                text: `${index + 1}. ${place.name}`,
              }))}
            />
          )}
        </>
      )}
    </View>
  );
}
