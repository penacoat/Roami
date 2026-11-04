import React, { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RecommendationView } from '@roami/shared';
import { getApiMode } from '../../api';
import { PLACE_PHOTOS } from './placePhotos';

interface Props {
  recommendation: RecommendationView;
  onOpenPlace: (placeId: string) => void;
}

//colors athena used
const PAPER = '#F3EEE2';
const CARD = '#FCFAF4';
const INK = '#283A70';
const TEXT = '#27334E';
const MUTED = '#505A72';
const LINE = '#DFD7C5';
const ACCENT = '#A83E28';
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

//to turn dates into a written out format
function formatDate(dateString: string): string {
  const month = Number(dateString.substring(5, 7));
  const day = Number(dateString.substring(8, 10));
  const year = Number(dateString.substring(0, 4));
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

//note caption - first sentence for now but should be two seperate inputs
function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](\s|$)/);
  return match ? match[0].trim() : text;
}

export function PostcardRecommendation({ recommendation, onOpenPlace }: Props) {
  const [showBack, setShowBack] = useState(false);

  const name = recommendation.author?.name ?? 'A fellow traveler';
  const date = formatDate(recommendation.visitDate ?? recommendation.createdAt);
  const photo = PLACE_PHOTOS[recommendation.place.id];
  const sample = getApiMode() === 'fixtures' || Boolean(process.env.EXPO_PUBLIC_EMULATOR_HOST);

  return (
    <View style={styles.postLayout}>
      {/* header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <View style={styles.avatarRing}>
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.username}>Postcard from {name}</Text>
          <Text style={styles.meta}>
            {sample ? 'Sample postcard · ' : ''}
            {date}
          </Text>
        </View>
        <View style={styles.smallStamp}>
          <Text style={styles.smallStampText}>SEA{'\n'}WA</Text>
        </View>
      </View>

      {/* the postcard */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${showBack ? 'Show photo for' : 'Read postcard for'} ${recommendation.place.name} by ${name}`}
        onPress={() => setShowBack(!showBack)}
        style={styles.postcard}
      >
        {showBack ? (
          <View style={styles.back}>
            {Array.from({ length: 7 }, (_, index) => (
              <View key={index} style={[styles.ruledLine, { top: 44 + index * 32 }]} />
            ))}
            <View style={styles.backLeft}>
              <Text style={styles.note} numberOfLines={7}>
                “{recommendation.description}”
              </Text>
              <View>
                <Text style={styles.signature}>— {name}</Text>
                <View style={styles.flipButton}>
                  <Text style={styles.flipButtonText}>↻ Photo</Text>
                </View>
              </View>
            </View>
            <View style={styles.backDivider} />
            <View style={styles.backRight}>
              <View style={styles.stamp}>
                <Text style={styles.stampText}>SEA</Text>
              </View>
              <View>
                <Text style={styles.addressName}>{recommendation.place.name}</Text>
                <Text style={styles.address}>Seattle</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.front}>
            <View style={styles.photoArea}>
              {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : null}
              {photo ? <View style={styles.photoShade} /> : null}
              {photo ? <Text style={styles.photoLabel}>Illustrative photo</Text> : null}
              <Text style={styles.frontPicture} numberOfLines={2}>
                {recommendation.place.name}
              </Text>
              <View style={[styles.flipButton, styles.flipCorner]}>
                <Text style={styles.flipButtonText}>Flip ↻</Text>
              </View>
            </View>
            <View style={styles.captionStrip}>
              <Text style={styles.caption} numberOfLines={2}>
                {firstSentence(recommendation.description)}
              </Text>
              <Text style={styles.captionName}>— {name}</Text>
            </View>
          </View>
        )}
      </Pressable>

      {/* footer */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`See place: ${recommendation.place.name}, recommended by ${name}`}
        onPress={() => onOpenPlace(recommendation.place.id)}
        style={styles.footer}
      >
        <Text style={styles.placeName}>{recommendation.place.name}</Text>
        <Text style={styles.seePlace}>See place ›</Text>
      </Pressable>
      <Text style={styles.category}>{recommendation.place.category}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photoLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    fontSize: 10,
    color: CARD,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  postLayout: {
    backgroundColor: PAPER,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },

  //title
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: CARD,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: CARD,
    fontWeight: '700',
    fontSize: 17,
  },
  headerText: {
    marginLeft: 10,
    flex: 1,
  },
  username: {
    color: TEXT,
    fontFamily: SERIF,
    fontSize: 16,
  },
  meta: {
    color: MUTED,
    fontSize: 13,
  },

  //stamps
  smallStamp: {
    borderWidth: 1,
    borderColor: ACCENT,
    borderStyle: 'dashed',
    paddingHorizontal: 5,
    paddingVertical: 2,
    transform: [{ rotate: '4deg' }],
  },
  smallStampText: {
    color: ACCENT,
    fontSize: 9,
    textAlign: 'center',
    fontFamily: SERIF,
  },

  //postcard
  postcard: {
    height: 300,
    overflow: 'hidden',
  },
  front: {
    flex: 1,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    padding: 8,
  },
  photoArea: {
    flex: 1,
    backgroundColor: INK,
    justifyContent: 'flex-end',
    padding: 18,
    overflow: 'hidden',
  },
  photo: {
    ...StyleSheet.absoluteFill,
  },
  photoShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  captionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 4,
  },
  caption: {
    flex: 1,
    color: TEXT,
    fontSize: 14,
    marginRight: 10,
  },
  captionName: {
    color: ACCENT,
    fontSize: 16,
    fontStyle: 'italic',
    fontFamily: SERIF,
  },
  frontPicture: {
    color: CARD,
    fontSize: 36,
    fontFamily: SERIF,
    marginBottom: 4,
    paddingRight: 80,
  },
  flipButton: {
    alignSelf: 'flex-start',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 10,
  },
  flipButtonText: {
    color: INK,
    fontSize: 14,
    fontStyle: 'italic',
    fontFamily: SERIF,
  },
  flipCorner: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    marginTop: 0,
  },

  //back of postcard
  back: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    padding: 18,
  },
  ruledLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: LINE,
  },
  note: {
    color: INK,
    fontSize: 18,
    fontFamily: SERIF,
    fontStyle: 'italic',
    lineHeight: 32,
  },

  //stamp!!
  stamp: {
    alignSelf: 'flex-end',
    borderWidth: 2,
    borderColor: INK,
    borderStyle: 'dashed',
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  stampText: {
    color: INK,
    fontSize: 14,
    fontFamily: SERIF,
  },
  addressName: {
    color: INK,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: SERIF,
    lineHeight: 32,
  },
  address: {
    color: INK,
    fontSize: 15,
    fontFamily: SERIF,
    lineHeight: 32,
  },

  //footer
  footer: {
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 4,
  },
  placeName: {
    flex: 1,
    marginRight: 10,
    color: TEXT,
    fontSize: 24,
    fontFamily: SERIF,
  },
  seePlace: {
    color: INK,
    fontSize: 15,
    fontWeight: '700',
  },
  category: {
    color: MUTED,
    fontSize: 14,
    marginTop: 4,
    textTransform: 'capitalize',
  },

  //back of card
  signature: {
    color: INK,
    fontSize: 18,
    fontFamily: SERIF,
    fontStyle: 'italic',
  },
  backLeft: {
    flex: 1.4,
    justifyContent: 'space-between',
    paddingRight: 12,
  },
  backDivider: {
    width: 1,
    backgroundColor: LINE,
  },
  backRight: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
});
