import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { SavedPlaceView } from '@roami/shared';
import { callApi } from '../api';
import { colors } from '../screens/map/theme';
import { buttonOutline } from './buttonStyles';

// Matches MAX_NOTE_LENGTH in SaveService and validSave in firestore.rules.
export const MAX_NOTE_LENGTH = 2000;

interface Props {
  placeId: string;
  placeName: string;
  note: string;
  /** Called with the saved place after the note is stored. */
  onSaved: (saved: SavedPlaceView) => void;
}

/** A private note on a saved place: view it, add it, edit it, or clear it. Only its owner can read it. */
export function SavedNote({ placeId, placeName, note, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);

  function startEditing() {
    setDraft(note);
    setError('');
    setEditing(true);
  }

  async function save() {
    if (busy.current) return;
    const text = draft.trim();
    if (text === note) {
      setEditing(false);
      return;
    }
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      const { saved } = await callApi('updateSavedNote', { placeId, personalNote: text });
      onSaved(saved);
      setEditing(false);
    } catch {
      setError('Could not save your note. Please try again.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <View style={styles.box}>
        {note !== '' && (
          <>
            <Text style={styles.label}>Your private note</Text>
            <Text style={styles.note}>{note}</Text>
          </>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${note === '' ? 'Add note to' : 'Edit note for'} ${placeName}`}
          onPress={startEditing}
          style={styles.action}
        >
          <Text style={styles.link}>{note === '' ? 'Add a note' : 'Edit note'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.label}>Your private note (only you can see it)</Text>
      <TextInput
        accessibilityLabel={`Note for ${placeName}`}
        multiline
        maxLength={MAX_NOTE_LENGTH}
        value={draft}
        onChangeText={setDraft}
        editable={!saving}
        placeholder="Reservation tips, what to order, how to get there…"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <Text style={styles.count}>
        {draft.length}/{MAX_NOTE_LENGTH}
      </Text>
      {error !== '' && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Save note for ${placeName}`}
          disabled={saving}
          accessibilityState={{ disabled: saving, busy: saving }}
          onPress={() => void save()}
          style={[styles.action, styles.primary]}
        >
          <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save note'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Cancel note for ${placeName}`}
          disabled={saving}
          onPress={() => setEditing(false)}
          style={styles.action}
        >
          <Text style={styles.link}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 10 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  note: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  input: {
    ...buttonOutline,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 96,
    padding: 10,
    textAlignVertical: 'top',
  },
  count: { color: colors.muted, fontSize: 12, alignSelf: 'flex-end', marginTop: 4 },
  error: { color: colors.red, fontSize: 14, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10 },
  action: {
    ...buttonOutline,
    minHeight: 44,
    paddingHorizontal: 12,
    marginTop: 10,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  primary: { borderColor: colors.primary, backgroundColor: colors.primary },
  primaryText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
