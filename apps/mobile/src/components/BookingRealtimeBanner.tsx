import React, { useEffect } from 'react';
import { AppState, StyleSheet, TouchableOpacity, View } from 'react-native';
import { io } from 'socket.io-client';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { IS_DEMO } from '../lib/demo';
import { useBookingRealtime } from '../lib/bookingRealtimeStore';
import type { BookingStatus } from '../types';
import { tokens as t } from '../theme/tokens';
import { KoreanText as Text } from './common/KoreanText';

const messages: Readonly<Record<BookingStatus, string>> = {
  pending: '새 예약 요청이 접수되었습니다.',
  confirmed: '예약이 확정되었습니다.',
  completed: '세션이 완료되었습니다.',
  cancelled: '예약이 취소되었습니다.',
  no_show: '예약이 노쇼로 처리되었습니다.',
};

export function BookingRealtimeBanner() {
  const userId = useStore((state) => state.user?.id);
  const { connection, latest, dismiss } = useBookingRealtime();

  useEffect(() => {
    const state = useBookingRealtime.getState();
    if (!userId || IS_DEMO) {
      state.reset(null, 'disabled');
      return;
    }
    state.reset(userId, 'connecting');
    let active = true;
    let token: string | null = null;
    const socket = io(process.env.EXPO_PUBLIC_BFF_URL || 'http://localhost:3000', {
      autoConnect: false,
    });
    socket.on('connect', () => {
      if (active) state.setConnection(userId, 'connected');
    });
    socket.on('disconnect', () => {
      if (active) state.setConnection(userId, 'disconnected');
    });
    socket.on('connect_error', () => {
      if (active) state.setConnection(userId, 'disconnected');
    });
    socket.on('booking_updated', (event: unknown) => {
      if (active) state.receive(userId, event);
    });

    const applySession = (session: Session | null) => {
      if (!active) return;
      const nextToken = session?.user.id === userId ? session.access_token : null;
      if (nextToken === token && socket.connected) return;
      token = nextToken;
      socket.disconnect();
      if (token) {
        socket.auth = { token };
        socket.connect();
      } else {
        state.setConnection(userId, 'disconnected');
      }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });
    // Subscription above handles INITIAL_SESSION and token refresh without
    // calling Supabase again from inside its auth callback.
    const appSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        state.refresh(userId);
        void supabase.auth.getSession().then(({ data }) => applySession(data.session));
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
      appSubscription.remove();
      socket.removeAllListeners();
      socket.disconnect();
      state.reset(null, 'disabled');
    };
  }, [userId]);

  if (connection === 'disabled') return null;
  if (connection === 'connected' && !latest) return null;
  return (
    <View>
      {connection !== 'connected' ? (
        <View style={styles.connection} accessibilityLiveRegion="polite">
          <Text style={styles.connectionText}>
            {connection === 'connecting' ? '실시간 알림 연결 중' : '실시간 알림 연결이 끊겼습니다. 예약 탭에서 새로고침할 수 있습니다.'}
          </Text>
        </View>
      ) : null}
      {latest ? (
      <View style={styles.notice} accessibilityLiveRegion="polite">
        <Text style={styles.noticeText}>{messages[latest.status]}</Text>
        <TouchableOpacity onPress={dismiss} style={styles.dismiss} accessibilityRole="button" accessibilityLabel="예약 알림 닫기">
          <Text style={styles.dismissText}>닫기</Text>
        </TouchableOpacity>
      </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { backgroundColor: t.color.primarySoft, paddingHorizontal: t.space.lg, flexDirection: 'row', alignItems: 'center', gap: t.space.sm },
  noticeText: { flex: 1, color: t.color.primary, fontSize: t.font.secondary, lineHeight: 24 },
  dismiss: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  dismissText: { color: t.color.primary, fontSize: t.font.secondary, fontWeight: '700' },
  connection: { backgroundColor: t.color.warningSoft, padding: t.space.md },
  connectionText: { color: t.color.text, fontSize: t.font.secondary, lineHeight: 24 },
});
