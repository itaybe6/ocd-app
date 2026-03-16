import React, { useState } from 'react';
import Toast from 'react-native-toast-message';
import { Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { useAuth } from '../../state/AuthContext';

export function CustomerSupportScreen() {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    try {
      setSubmitting(true);
      const { error } = await supabase.from('support_tickets').insert({
        customer_name: user?.name ?? 'Customer',
        phone: user?.phone ?? '',
        description: description.trim(),
        is_new: true,
      });
      if (error) throw error;
      setDescription('');
      Toast.show({ type: 'success', text1: 'הפנייה נשלחה' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'שליחה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: 10 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>תמיכה טכנית</Text>
        <Text style={{ color: colors.muted, textAlign: 'right' }}>
          שלח פנייה לצוות. היא תופיע אצל מנהל במסך “שירות לקוחות” עם badge (is_new=true).
        </Text>
        <Input
          label="תיאור הבעיה"
          value={description}
          onChangeText={setDescription}
          placeholder="תאר את הבעיה…"
          multiline
          style={{ minHeight: 120, textAlignVertical: 'top' as any }}
        />
        <Button title={submitting ? 'שולח…' : 'שלח פנייה'} disabled={!description.trim() || submitting} onPress={submit} />
      </View>
    </Screen>
  );
}

