import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Button } from '../../components/common/Button';
import { KoreanText as Text } from '../../components/common/KoreanText';
import { bookingIdOf, markAllRead, markRead, useNotificationStore } from '../../lib/notifications';
import type { Notification } from '../../lib/notifications';
import { useStore } from '../../lib/store';
import { tokens as t } from '../../theme/tokens';

export function NotificationsScreen() {
  const navigation = useNavigation<NavigationProp<{
    Bookings: { readonly bookingId: string; readonly focusAt: number };
  }>>();
  const userId = useStore((state) => state.user?.id);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const refresh = useNotificationStore((state) => state.refresh);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const focus = useRef<AbortController | null>(null);
  const mutation = useRef(false);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const rows = await refresh(controller.signal);
      if (controller.signal.aborted) return;
      setItems(rows);
      setError(null);
    } catch (cause: unknown) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error
          ? '알림을 불러오지 못했습니다. 연결을 확인하고 다시 시도해주세요.'
          : '알림을 확인할 수 없습니다. 다시 시도해주세요.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [refresh]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    focus.current = controller;
    setItems([]);
    setError(null);
    useNotificationStore.setState({ unreadCount: 0 });
    void load();
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, [load, userId]));

  const read = async (item?: Notification) => {
    if (mutation.current) return;
    const bookingId = item ? bookingIdOf(item) : null;
    if (item?.is_read) {
      if (bookingId) navigation.navigate('Bookings', { bookingId, focusAt: Date.now() });
      return;
    }
    const currentFocus = focus.current;
    mutation.current = true;
    setSaving(true);
    setError(null);
    try {
      if (item) await markRead(item.id);
      else await markAllRead();
      if (currentFocus?.signal.aborted) return;
      // Reload the authoritative newest 50, rather than decrementing a stale count.
      await load();
      if (bookingId && !currentFocus?.signal.aborted) {
        navigation.navigate('Bookings', { bookingId, focusAt: Date.now() });
      }
    } catch (cause: unknown) {
      if (!currentFocus?.signal.aborted) {
        setError(cause instanceof Error
          ? '읽음 처리 결과를 확인하지 못했습니다. 새로고침 후 다시 시도해주세요.'
          : '알림을 읽음 처리하지 못했습니다. 다시 시도해주세요.');
      }
    } finally {
      mutation.current = false;
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>알림</Text>
        <Text style={styles.subtitle}>최근 알림 50개 · 읽지 않은 알림 {unreadCount}개</Text>
        <Button
          title="모두 읽음" variant="secondary" onPress={() => void read()}
          loading={saving} disabled={loading || items.length === 0}
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={t.color.primary} />}
        ListHeaderComponent={error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Text style={styles.body}>{error}</Text>
            <Button title="새로고침" variant="secondary" onPress={() => void load()} disabled={loading || saving} />
          </View>
        ) : null}
        ListEmptyComponent={loading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={t.color.primary} />
            <Text style={styles.subtitle}>알림을 불러오고 있습니다.</Text>
          </View>
        ) : !error ? (
          <View style={styles.empty}><Text style={styles.body}>새 알림이 없습니다.</Text></View>
        ) : null}
        renderItem={({ item }) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${item.is_read ? '읽음' : '읽지 않음'}, ${item.title}, ${item.body}`}
            accessibilityHint={bookingIdOf(item) ? '누르면 관련 예약을 엽니다.' : item.is_read ? undefined : '누르면 읽음 처리합니다.'}
            disabled={saving || loading || (item.is_read && !bookingIdOf(item))}
            onPress={() => void read(item)}
            style={[styles.item, !item.is_read && styles.unread]}
          >
            <View style={styles.itemHeader}>
              <Text style={[styles.itemTitle, !item.is_read && styles.unreadTitle]}>{item.title}</Text>
              {!item.is_read ? <Text style={styles.badge}>읽지 않음</Text> : null}
            </View>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.subtitle}>
              {new Date(item.created_at).toLocaleString('ko-KR', {
                timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
                hour: 'numeric', minute: '2-digit',
              })}
            </Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.background },
  header: { padding: t.space.xl, gap: t.space.sm, backgroundColor: t.color.surface },
  title: { color: t.color.text, fontSize: t.font.title, fontWeight: '800' },
  subtitle: { color: t.color.mutedText, fontSize: t.font.secondary, lineHeight: 24 },
  list: { padding: t.space.lg, paddingBottom: t.space.section },
  item: { padding: t.space.lg, marginBottom: t.space.md, borderRadius: t.radius.card, backgroundColor: t.color.surface, gap: t.space.sm, minHeight: 48 },
  unread: { backgroundColor: t.color.primarySoft },
  itemHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space.sm },
  itemTitle: { color: t.color.text, fontSize: t.font.section, fontWeight: '600', flexShrink: 1 },
  unreadTitle: { fontWeight: '800' },
  badge: { color: t.color.primary, fontSize: t.font.secondary, fontWeight: '700' },
  body: { color: t.color.text, fontSize: t.font.body, lineHeight: 26 },
  error: { backgroundColor: t.color.dangerSoft, padding: t.space.lg, gap: t.space.md, marginBottom: t.space.lg },
  empty: { paddingVertical: t.space.section, alignItems: 'center', gap: t.space.md },
});
