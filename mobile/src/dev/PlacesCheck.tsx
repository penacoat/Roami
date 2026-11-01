import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError, callApi, getApiMode } from '../api';

// Temporary proof-of-life for the data layer. Frontend: replace with real screens.
export function PlacesCheck() {
  const [text, setText] = useState('');

  async function load() {
    setText('Loading...');
    try {
      const { places } = await callApi('listPlaces', { city: 'Seattle' });
      setText(`${places.length} places:\n${places.map((p) => `- ${p.name}`).join('\n')}`);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'unknown';
      const message = error instanceof Error ? error.message : String(error);
      setText(`Error (${code}): ${message}`);
    }
  }

  return (
    <View style={styles.box}>
      <Text style={styles.mode}>API mode: {getApiMode()}</Text>
      <Pressable style={styles.button} onPress={load}>
        <Text style={styles.buttonText}>Load places</Text>
      </Pressable>
      <ScrollView style={styles.scroll}>
        <Text style={styles.result}>{text}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', maxHeight: 360, padding: 16 },
  mode: { fontSize: 14, color: '#555', marginBottom: 8, textAlign: 'center' },
  button: { backgroundColor: '#1a73e8', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  scroll: { flexGrow: 0 },
  result: { fontSize: 14 },
});
