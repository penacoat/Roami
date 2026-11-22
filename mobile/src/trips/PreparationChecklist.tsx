import type { PreparationTask } from '@roami/shared';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { ApiError, callApi } from '../api';
import { validBookingUrl } from '../logic/preparation';
import { itineraryStyles as styles } from './itineraryStyles';
import { dateKey, formatDate } from './tripDraft';

const emptyForm = { title: '', link: '', due: '' };

export function PreparationChecklist({
  tripId,
  stopId,
  revision,
}: {
  tripId: string;
  stopId: string;
  revision: number;
}) {
  const [tasks, setTasks] = useState<PreparationTask[] | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<PreparationTask | undefined>();
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    let active = true;
    callApi('listPreparation', { tripId, stopId })
      .then(({ tasks }) => {
        if (active) {
          setTasks(tasks);
          setStatus('');
        }
      })
      .catch(() => {
        if (active) setStatus('Could not load the checklist.');
      });
    return () => {
      active = false;
    };
  }, [tripId, stopId, revision, retry]);

  async function write(op: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setStatus('');
    try {
      await op();
    } catch (error) {
      setStatus(
        error instanceof ApiError ? error.message : 'Could not save the checklist. Try again.',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function save(values: {
    title: string;
    bookingUrl: string | null;
    deadline: string | null;
    completed: boolean;
    taskId?: string;
    reviewSchedule?: boolean;
  }) {
    const { task } = await callApi('savePreparation', { tripId, stopId, ...values });
    setTasks((current) => [...(current ?? []).filter((item) => item.id !== task.id), task]);
  }

  async function openBooking(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      setStatus('Could not open this booking link.');
    }
  }

  const ordered = [...(tasks ?? [])].sort(
    (a, b) =>
      Number(Boolean(a.completed)) - Number(Boolean(b.completed)) ||
      (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') ||
      a.id.localeCompare(b.id),
  );

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>
        Preparation checklist
      </Text>
      {status !== '' && (
        <Text accessibilityRole="alert" style={styles.error}>
          {status}
        </Text>
      )}
      {tasks === null ? (
        status ? (
          <Pressable
            accessibilityRole="button"
            style={styles.button}
            onPress={() => {
              setStatus('');
              setRetry((value) => value + 1);
            }}
          >
            <Text style={styles.buttonText}>Retry checklist</Text>
          </Pressable>
        ) : (
          <ActivityIndicator accessibilityLabel="Loading checklist" />
        )
      ) : (
        <>
          {ordered.map((task) => (
            <View key={task.id} style={styles.daySection}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={task.title}
                accessibilityState={{ checked: !!task.completed, disabled: pending }}
                disabled={pending}
                style={styles.button}
                onPress={() =>
                  void write(() => save({ ...task, taskId: task.id, completed: !task.completed }))
                }
              >
                <Text style={styles.buttonText}>
                  {task.completed ? '✓' : '○'} {task.title}
                </Text>
              </Pressable>
              {task.deadline && (
                <Text style={styles.muted}>
                  Due {formatDate(task.deadline)}
                  {!task.completed && task.deadline < dateKey(new Date()) ? ' · overdue' : ''}
                </Text>
              )}
              {task.needsReview && (
                <Text style={styles.error}>Activity changed. Check this booking or task.</Text>
              )}
              <View style={styles.wrap}>
                {task.bookingUrl && validBookingUrl(task.bookingUrl) && (
                  <Pressable
                    accessibilityRole="link"
                    style={styles.button}
                    onPress={() => void openBooking(task.bookingUrl!)}
                  >
                    <Text style={styles.buttonText}>Open booking</Text>
                  </Pressable>
                )}
                {task.needsReview && (
                  <Pressable
                    accessibilityRole="button"
                    style={styles.button}
                    disabled={pending}
                    onPress={() =>
                      void write(() =>
                        save({
                          ...task,
                          taskId: task.id,
                          completed: !!task.completed,
                          reviewSchedule: true,
                        }),
                      )
                    }
                  >
                    <Text style={styles.buttonText}>Mark reviewed</Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit checklist item ${task.title}`}
                  style={styles.button}
                  disabled={pending}
                  onPress={() => {
                    setEditing(task);
                    setForm({
                      title: task.title,
                      link: task.bookingUrl ?? '',
                      due: task.deadline ?? '',
                    });
                  }}
                >
                  <Text style={styles.buttonText}>Edit</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove checklist item ${task.title}`}
                  style={styles.button}
                  disabled={pending}
                  onPress={() =>
                    void write(async () => {
                      await callApi('removePreparation', { tripId, stopId, taskId: task.id });
                      setTasks((current) => current?.filter((item) => item.id !== task.id) ?? []);
                      if (editing?.id === task.id) {
                        setEditing(undefined);
                        setForm(emptyForm);
                      }
                    })
                  }
                >
                  <Text style={styles.buttonText}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <TextInput
            accessibilityLabel="Checklist item name"
            placeholder="e.g. Book tickets"
            value={form.title}
            maxLength={200}
            editable={!pending}
            style={styles.input}
            onChangeText={(title) => setForm((current) => ({ ...current, title }))}
          />
          <TextInput
            accessibilityLabel="Booking link"
            placeholder="Booking link (optional)"
            value={form.link}
            autoCapitalize="none"
            keyboardType="url"
            editable={!pending}
            style={styles.input}
            onChangeText={(link) => setForm((current) => ({ ...current, link }))}
          />
          <TextInput
            accessibilityLabel="Due date"
            placeholder="Due date · YYYY-MM-DD (optional)"
            value={form.due}
            maxLength={10}
            editable={!pending}
            style={styles.input}
            onChangeText={(due) => setForm((current) => ({ ...current, due }))}
          />
          <View style={styles.wrap}>
            <Pressable
              accessibilityRole="button"
              disabled={pending}
              style={styles.button}
              onPress={() =>
                void write(async () => {
                  await save({
                    title: form.title,
                    bookingUrl: form.link.trim() || null,
                    deadline: form.due.trim() || null,
                    taskId: editing?.id,
                    completed: editing?.completed ?? false,
                  });
                  setForm(emptyForm);
                  setEditing(undefined);
                })
              }
            >
              <Text style={styles.buttonText}>
                {editing ? 'Save checklist item' : 'Add checklist item'}
              </Text>
            </Pressable>
            {editing && (
              <Pressable
                accessibilityRole="button"
                disabled={pending}
                style={styles.button}
                onPress={() => {
                  setEditing(undefined);
                  setForm(emptyForm);
                }}
              >
                <Text style={styles.buttonText}>Cancel edit</Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </View>
  );
}
