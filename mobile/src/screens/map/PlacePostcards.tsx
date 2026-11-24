import type { RecommendationView } from '@roami/shared';
import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bookmark } from '../../design/Bookmark';
import { palette, type } from '../../design/tokens';

/** A place owns the collection; each bookmark retains just that author's postcard. */
export function PlacePostcards({
  recommendations,
  saved,
  highlightedId,
  loading,
  error,
  pending,
  sample,
  onRetry,
  onSave,
  onRemove,
}: {
  recommendations: RecommendationView[];
  saved: RecommendationView[];
  highlightedId?: string;
  loading: boolean;
  error: string;
  pending: boolean;
  sample: boolean;
  onRetry: () => void;
  onSave: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [scope, setScope] = useState<'saved' | 'all'>(
    !highlightedId && saved.length ? 'saved' : 'all',
  );
  const [linkError, setLinkError] = useState('');
  const postcards = scope === 'saved' ? saved : recommendations;
  const ordered = [...postcards].sort(
    (a, b) => Number(b.id === highlightedId) - Number(a.id === highlightedId),
  );
  return (
    <View style={styles.board}>
      <View style={styles.tabs}>
        {(['saved', 'all'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: scope === value }}
            onPress={() => setScope(value)}
            style={[styles.tab, scope === value && styles.active]}
          >
            <Text style={styles.action}>
              {value === 'saved' ? `Saved postcards (${saved.length})` : 'All postcards'}
            </Text>
          </Pressable>
        ))}
      </View>
      {loading && (
        <ActivityIndicator accessibilityLabel="Loading recommendations" color={palette.primary} />
      )}
      {error !== '' && (
        <View>
          <Text accessibilityRole="alert" style={styles.body}>
            {error}
          </Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.link}>
            <Text style={styles.action}>Retry recommendations</Text>
          </Pressable>
        </View>
      )}
      {highlightedId &&
        !loading &&
        !error &&
        !recommendations.some((item) => item.id === highlightedId) && (
          <Text accessibilityRole="alert" style={styles.body}>
            The original recommendation is no longer available. You can still save this place.
          </Text>
        )}
      {!loading && !error && ordered.length === 0 && (
        <Text style={styles.muted}>
          {scope === 'saved'
            ? 'Bookmark a postcard to keep it with this place.'
            : 'No recommendations yet.'}
        </Text>
      )}
      {ordered.map((postcard) => {
        const bookmarked = saved.some((item) => item.id === postcard.id);
        const author = postcard.author?.name ?? 'a traveler';
        return (
          <View
            key={postcard.id}
            style={[styles.postcard, postcard.id === highlightedId && styles.highlighted]}
          >
            {postcard.id === highlightedId && (
              <Text accessibilityRole="header" style={styles.author}>
                Selected recommendation
              </Text>
            )}
            <View style={styles.authorRow}>
              <Text style={[styles.author, { flex: 1 }]}>
                {sample ? 'Sample recommendation ·' : 'Postcard from'} {author}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${bookmarked ? 'Unsave' : 'Save'} recommendation by ${author}`}
                accessibilityHint={
                  bookmarked
                    ? 'Remove this postcard while keeping the place saved.'
                    : 'Keep this postcard with the place in Saved.'
                }
                accessibilityState={{
                  selected: bookmarked,
                  disabled: pending || (postcard.status === 'unavailable' && !bookmarked),
                }}
                disabled={pending || (postcard.status === 'unavailable' && !bookmarked)}
                onPress={() => (bookmarked ? onRemove(postcard.id) : onSave(postcard.id))}
                style={styles.bookmark}
              >
                <Bookmark saved={bookmarked} />
              </Pressable>
            </View>
            {postcard.status === 'unavailable' ? (
              <Text style={styles.muted}>This recommendation is no longer available.</Text>
            ) : (
              <>
                <Text style={styles.body}>{postcard.description}</Text>
                {postcard.tags.length > 0 && (
                  <Text style={styles.muted}>{postcard.tags.join(' · ')}</Text>
                )}
                {postcard.sourceLinks.filter(isWebLink).map((url) => (
                  <Pressable
                    key={url}
                    accessibilityRole="link"
                    accessibilityLabel={`Open source: ${new URL(url).hostname.replace(/^www\./, '')}`}
                    style={styles.link}
                    onPress={() => {
                      setLinkError('');
                      void Linking.openURL(url).catch(() =>
                        setLinkError('Could not open the link. Try again.'),
                      );
                    }}
                  >
                    <Text style={styles.action}>
                      {new URL(url).hostname.replace(/^www\./, '')} ↗
                    </Text>
                  </Pressable>
                ))}
              </>
            )}
          </View>
        );
      })}
      {linkError !== '' && (
        <Text accessibilityRole="alert" style={styles.body}>
          {linkError}
        </Text>
      )}
    </View>
  );
}

export function isWebLink(value: string) {
  try {
    const url = new URL(value);
    return (
      ['https:', 'http:'].includes(url.protocol) &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
const styles = StyleSheet.create({
  board: { gap: 12, marginTop: 8 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: palette.line },
  tab: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  active: { borderBottomColor: palette.primary },
  action: { ...type.action, fontSize: 13, color: palette.primary },
  postcard: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  highlighted: { borderColor: palette.primary },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    paddingBottom: 4,
  },
  author: { ...type.action, fontSize: 13, color: palette.ink },
  bookmark: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  body: { ...type.body, color: palette.ink },
  muted: { ...type.caption, color: palette.muted },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
