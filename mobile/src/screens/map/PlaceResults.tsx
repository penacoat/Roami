import type { PlaceSummary } from '@roami/shared';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { PlacesState } from './usePlaces';
import { categoryName, label } from './mapUtils';
import { styles } from './mapStyles';
import { colors } from './theme';
const NO_PLACES: PlaceSummary[] = [];

type ActionProps = { text: string; label?: string; onPress: () => void };
function Filter({ text, label, selected, onPress }: ActionProps & { selected: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? text}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.activeChip]}
    >
      <Text style={[styles.chipText, selected && styles.activeText]}>{text}</Text>
    </Pressable>
  );
}
function Action({ text, label, onPress }: ActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? text}
      onPress={onPress}
      style={styles.textButton}
    >
      <Text accessible={false} style={label ? styles.zoom : styles.link}>
        {text}
      </Text>
    </Pressable>
  );
}

export function PlaceResults({
  city,
  data,
  onInteract,
  onExpand,
  onSelect,
}: {
  city: string;
  data: PlacesState;
  onInteract: () => void;
  onExpand: () => void;
  onSelect: (place: PlaceSummary, recommendationId?: string) => void;
}) {
  const {
    places,
    savedPlaces,
    query,
    setQuery,
    category,
    setCategory,
    savedOnly,
    setSavedOnly,
    loading,
    refreshing,
    error,
    searching,
    searchFailed,
    categories,
    matches,
    visible,
    refreshPlaces,
    pullToRefresh,
    retrySearch,
  } = data;
  const initialLoading = loading && !refreshing;
  const update = (change: () => void) => () => {
    onInteract();
    change();
  };
  const emptyMessage = searching
    ? 'Searching recommendations…'
    : places.length === 0
      ? `No places in the catalog for ${city}. Change city or refresh.`
      : savedOnly
        ? 'No saved places match these filters.'
        : 'No places match. Clear the search or change a category.';

  return (
    <FlatList
      testID="explore-places-list"
      data={initialLoading || error ? NO_PLACES : visible}
      refreshing={refreshing}
      onRefresh={pullToRefresh}
      alwaysBounceVertical
      keyExtractor={(place) => place.id}
      style={styles.grow}
      contentContainerStyle={styles.cards}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <View style={styles.searchRow}>
            <TextInput
              accessibilityLabel="Search places"
              placeholder="Search places or recommendations"
              placeholderTextColor={colors.muted}
              value={query}
              maxLength={200}
              onFocus={onExpand}
              onChangeText={(value) => {
                onInteract();
                setQuery(value);
              }}
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
              style={[styles.input, styles.grow]}
            />
            {query !== '' && (
              <Action text="×" label="Clear search" onPress={update(() => setQuery(''))} />
            )}
            <Action text="↻" label="Refresh places and saves" onPress={update(refreshPlaces)} />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chips}
          >
            <Filter
              text={`Saved · ${savedPlaces.size}`}
              selected={savedOnly}
              onPress={update(() => {
                setSavedOnly(!savedOnly);
                refreshPlaces();
                onExpand();
              })}
            />
            <Filter
              text="All categories"
              selected={category === null}
              onPress={update(() => setCategory(null))}
            />
            {categories.map((item) => (
              <Filter
                key={item}
                text={label(item)}
                label={`Filter category: ${label(item)}`}
                selected={category === item}
                onPress={update(() => {
                  setCategory(category === item ? null : item);
                  onExpand();
                })}
              />
            ))}
          </ScrollView>
          {searchFailed && (
            <View style={styles.notice}>
              <Text accessibilityRole="alert" style={styles.caption}>
                Recommendation search is unavailable. Showing name/category matches only.
              </Text>
              <Action text="Retry search" onPress={retrySearch} />
            </View>
          )}
          {initialLoading ? (
            <ActivityIndicator
              accessibilityLabel="Loading places"
              color={colors.primary}
              style={styles.notice}
            />
          ) : error ? (
            <View style={styles.notice}>
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
              <Action text="Retry places" onPress={refreshPlaces} />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        loading || error ? undefined : <Text style={styles.empty}>{emptyMessage}</Text>
      }
      renderItem={({ item: place }) => {
        const match = matches.get(place.id),
          reason = match?.reasons[0];
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${place.name}`}
            onPress={() => onSelect(place, match?.recommendation.id)}
            style={styles.card}
          >
            <View style={styles.grow}>
              <Text style={styles.cardCategory}>{label(categoryName(place.category))}</Text>
              <Text style={styles.cardTitle}>{place.name}</Text>
              {reason && (
                <Text style={styles.caption}>
                  {match?.matchLevel === 'broader' ? 'Related' : 'Matches'}: {reason.matched}
                </Text>
              )}
            </View>
            <Text style={styles.link}>{savedPlaces.has(place.id) ? 'Saved ✓' : '›'}</Text>
          </Pressable>
        );
      }}
    />
  );
}
