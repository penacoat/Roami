import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { buttonOutline } from '../buttonStyles';
import { callApi } from '../../api';
import { fonts, palette, type } from '../../design/tokens';

interface Props {
  placeId: string;
  placeName: string;
  onSent: () => void;
}

// lets you write the postcard recommendation for a place
export function WritePostcard({ placeId, placeName, onSent }: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  async function send() {
    if (note.trim() === '') {
      setMessage('Please write a note before sending :)');
      return;
    }

    // tagging postcard categories
    const tagList = [];
    for (const tag of tags.split(',')) {
      if (tag.trim() !== '') {
        tagList.push(tag.trim());
      }
    }

    setSending(true);
    try {
      await callApi('createRecommendation', {
        placeId: placeId,
        description: note.trim(),
        tags: tagList,
      });
      setNote('');
      setTags('');
      setOpen(false);
      setMessage('Postcard sent! You can find it in Postcards.');
      onSent();
    } catch {
      setMessage('Could not send your postcard. Try again.');
    }
    setSending(false);
  }

  // button
  if (!open) {
    return (
      <View>
        <Pressable onPress={() => setOpen(true)} style={styles.button}>
          <Text style={styles.buttonText}>✎ Write a postcard</Text>
        </Pressable>
        <Text style={styles.message}>{message}</Text>
      </View>
    );
  }

  // open the form to write a postcard
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Postcard about {placeName}</Text>
      <TextInput
        accessibilityLabel="Your note"
        placeholder="What should a friend know about this place?"
        value={note}
        onChangeText={setNote}
        multiline
        style={[styles.input, styles.noteInput]}
      />
      <TextInput
        accessibilityLabel="Tags"
        placeholder="Tags, separated by commas (e.g. coffee, cozy)"
        value={tags}
        onChangeText={setTags}
        style={styles.input}
      />
      <Text style={styles.message}>{message}</Text>
      <View style={styles.row}>
        <Pressable onPress={send} disabled={sending} style={[styles.button, styles.sendButton]}>
          <Text style={[styles.buttonText, styles.sendText]}>
            {sending ? 'Sending…' : 'Send postcard'}
          </Text>
        </Pressable>
        <Pressable onPress={() => setOpen(false)} style={styles.button}>
          <Text style={styles.buttonText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
    gap: 8,
  },
  title: {
    color: palette.primary,
    fontFamily: fonts.serif,
    fontSize: 18,
  },
  input: {
    ...type.body,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    padding: 10,
  },
  noteInput: {
    minHeight: 100,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    ...buttonOutline,
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  buttonText: {
    ...type.action,
    color: palette.primary,
  },
  sendButton: {
    backgroundColor: palette.primary,
  },
  sendText: {
    color: palette.card,
  },
  message: {
    ...type.caption,
    color: palette.ink,
  },
});
