import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, FlatList } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { ModalSheet } from '../../components/ModalSheet';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';

type Ticket = {
  id: string;
  customer_name: string;
  phone: string;
  description: string;
  is_new: boolean;
  created_at?: string;
};

export function SupportScreen() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t) => {
      return (
        t.customer_name?.toLowerCase().includes(q) ||
        t.phone?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    });
  }, [tickets, query]);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, customer_name, phone, description, is_new, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const list = (data ?? []) as Ticket[];
      setTickets(list);

      const newIds = list.filter((t) => t.is_new).map((t) => t.id);
      if (newIds.length) {
        const { error: updError } = await supabase.from('support_tickets').update({ is_new: false }).in('id', newIds);
        if (!updError) {
          setTickets((prev) => prev.map((t) => (newIds.includes(t.id) ? { ...t, is_new: false } : t)));
        }
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינת פניות נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    const channel = supabase
      .channel('support_tickets_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets' },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTickets();
    }, [fetchTickets])
  );

  const deleteTicket = async (id: string) => {
    try {
      const { error } = await supabase.from('support_tickets').delete().eq('id', id);
      if (error) throw error;
      setTickets((prev) => prev.filter((t) => t.id !== id));
      Toast.show({ type: 'success', text1: 'נמחק' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'מחיקה נכשלה', text2: e?.message ?? 'Unknown error' });
    }
  };

  return (
    <Screen>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button title={loading ? 'טוען…' : 'רענון'} fullWidth={false} onPress={fetchTickets} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>שירות לקוחות</Text>
        </View>

        <Input value={query} onChangeText={setQuery} label="חיפוש (שם/טלפון/תיאור)" placeholder="חפש…" />
      </View>

      <FlatList
        style={{ marginTop: 12 }}
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelected(item)}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                {item.is_new ? (
                  <View style={{ backgroundColor: colors.danger, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>חדש</Text>
                  </View>
                ) : (
                  <View />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>{item.customer_name}</Text>
                  <Text style={{ color: colors.muted, marginTop: 2, textAlign: 'right' }}>{item.phone}</Text>
                </View>
              </View>
              <Text style={{ color: colors.muted, marginTop: 8, textAlign: 'right' }} numberOfLines={2}>
                {item.description}
              </Text>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={{ marginTop: 20 }}>
            <Text style={{ color: colors.muted, textAlign: 'right' }}>אין פניות.</Text>
          </View>
        }
      />

      <ModalSheet visible={!!selected} onClose={() => setSelected(null)}>
        {!!selected && (
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>
              {selected.customer_name}
            </Text>
            <Text style={{ color: colors.muted, textAlign: 'right' }}>{selected.phone}</Text>
            <Card>
              <Text style={{ color: colors.text, textAlign: 'right', lineHeight: 20 }}>{selected.description}</Text>
            </Card>
            <Button title="מחק פנייה" variant="danger" onPress={() => deleteTicket(selected.id)} />
            <Button title="סגור" variant="secondary" onPress={() => setSelected(null)} />
          </View>
        )}
      </ModalSheet>
    </Screen>
  );
}

