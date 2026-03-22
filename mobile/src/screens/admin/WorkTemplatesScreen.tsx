import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { ensureWorkTemplates28, templateDay, type WorkTemplateLite } from '../../lib/workTemplates';
import type { WorkTemplatesStackParamList } from '../../navigation/workTemplatesTypes';

type Template = { id: string; day: number };
type TemplateForGrid = { id: string; day: number };

export function WorkTemplatesScreen({ navigation }: NativeStackScreenProps<WorkTemplatesStackParamList, 'WorkTemplatesHome'>) {
  const [templateCandidates, setTemplateCandidates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [templateCounts, setTemplateCounts] = useState<Record<string, number>>({});

  const ensureTemplates = async () => {
    const { templates: raw } = await ensureWorkTemplates28();
    const normalized = (raw ?? [])
      .map((t: WorkTemplateLite) => ({ id: t.id, day: templateDay(t) }))
      .filter((t): t is Template => typeof t.day === 'number' && t.day >= 1 && t.day <= 28)
      .sort((a, b) => a.day - b.day);

    setTemplateCandidates(normalized);
  };

  const fetchTemplateCounts = async (templateIds: string[]) => {
    if (!templateIds.length) return;
    const { data, error } = await supabase.from('template_stations').select('template_id').in('template_id', templateIds);
    if (error) return;
    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as any[]) {
      const tid = row.template_id as string | undefined;
      if (!tid) continue;
      counts[tid] = (counts[tid] ?? 0) + 1;
    }
    setTemplateCounts(counts);
  };

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await ensureTemplates();
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    fetchTemplateCounts(templateCandidates.map((t) => t.id)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateCandidates.length]);

  const templatesForGrid: TemplateForGrid[] = useMemo(() => {
    // Deduplicate by day (1..28). If multiple templates exist for same day, pick the one with most stations.
    // Tie-breaker: lowest id to keep stable.
    const best = new Map<number, TemplateForGrid>();
    for (const t of templateCandidates) {
      const current = best.get(t.day);
      if (!current) {
        best.set(t.day, { id: t.id, day: t.day });
        continue;
      }
      const cCount = templateCounts[current.id] ?? 0;
      const tCount = templateCounts[t.id] ?? 0;
      if (tCount > cCount) {
        best.set(t.day, { id: t.id, day: t.day });
      } else if (tCount === cCount && String(t.id) < String(current.id)) {
        best.set(t.day, { id: t.id, day: t.day });
      }
    }
    return Array.from(best.values()).sort((a, b) => a.day - b.day);
  }, [templateCandidates, templateCounts]);

  return (
    <Screen safeAreaEdges={['bottom']}>
        <FlatList
          style={{ flex: 1 }}
          data={templatesForGrid}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          refreshing={loading}
          onRefresh={refresh}
          renderItem={({ item }) => {
            const count = templateCounts[item.id] ?? 0;
            return (
              <Pressable
                style={{ flex: 1 }}
                onPress={() => navigation.navigate('WorkTemplateStations', { templateId: item.id, day: item.day })}
              >
                {({ pressed }) => (
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: 18,
                      padding: 14,
                      minHeight: 92,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                      shadowColor: '#0F172A',
                      shadowOpacity: 0.06,
                      shadowRadius: 14,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 2,
                    }}
                  >
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900' }}>{item.day}</Text>
                      <View
                        style={{
                          backgroundColor: 'rgba(37, 99, 235, 0.10)',
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                        }}
                      >
                        <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 12 }}>{count} תחנות</Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'right' }}>תבנית {item.day}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
    </Screen>
  );
}

