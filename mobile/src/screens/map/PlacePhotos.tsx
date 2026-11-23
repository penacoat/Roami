import type { PlacePhoto } from '@roami/shared';
import React, { useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette, type } from '../../design/tokens';

function Photo({
  photo,
  name,
  index,
  width,
}: {
  photo: PlacePhoto;
  name: string;
  index: number;
  width: number;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View
      style={{
        width,
        height: 170,
        backgroundColor: palette.line,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {failed ? (
        <Text style={styles.caption}>Photo unavailable</Text>
      ) : (
        <Image
          source={{ uri: photo.url }}
          accessibilityLabel={`${photo.illustrative ? 'Illustrative image' : name + ' photo'} ${index + 1}`}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}

/** Only photos returned by the place API; no guessed venue images. */
export function PlacePhotos({ photos = [], name }: { photos?: PlacePhoto[]; name: string }) {
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [width, setWidth] = useState(320);
  const [index, setIndex] = useState(0);
  const valid = photos
    .filter((photo) => {
      try {
        const url = new URL(photo.url);
        return url.protocol === 'https:' && !url.username && !url.password;
      } catch {
        return false;
      }
    })
    .slice(0, 12);
  if (!valid.length) return null;
  const current = Math.min(index, valid.length - 1);
  function move(next: number) {
    setIndex(next);
    scroll.current?.scrollTo({ x: next * width, animated: true });
  }
  return (
    <View
      onLayout={({ nativeEvent }) => {
        if (nativeEvent.layout.width > 0) setWidth(nativeEvent.layout.width);
      }}
      style={styles.gallery}
    >
      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={({ nativeEvent }) =>
          setIndex(Math.round(nativeEvent.contentOffset.x / width))
        }
      >
        {valid.map((photo, i) => (
          <Photo key={photo.url} photo={photo} name={name} index={i} width={width} />
        ))}
      </ScrollView>
      <View style={styles.controls}>
        <Text style={[styles.caption, { flex: 1 }]}>
          {valid[current].illustrative ? 'Illustrative photo' : (valid[current].attribution ?? '')}
          {valid.length > 1 ? ` · ${current + 1} / ${valid.length}` : ''}
        </Text>
        {valid.length > 1 && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous place photo"
              disabled={current === 0}
              onPress={() => move(current - 1)}
              style={styles.arrow}
            >
              <Text style={styles.caption}>←</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next place photo"
              disabled={current === valid.length - 1}
              onPress={() => move(current + 1)}
              style={styles.arrow}
            >
              <Text style={styles.caption}>→</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  gallery: { borderRadius: 12, overflow: 'hidden' },
  controls: { flexDirection: 'row', alignItems: 'center' },
  caption: { ...type.caption, color: palette.muted, paddingVertical: 6 },
  arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
