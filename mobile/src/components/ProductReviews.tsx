import { storeAccent } from '../theme/storeAccent';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { fetchProductReviews, productReviewsKey, submitProductReview, validateReview, type ProductReview } from '../lib/productReviews';
import { useAuth } from '../state/AuthContext';
import { radii } from '../theme/radii';
import { useReducedMotion } from 'react-native-reanimated';

function Stars({ rating, onChange, disabled }: { rating: number; onChange?: (rating: number) => void; disabled?: boolean }) {
  return <View style={s.stars} accessible={!onChange} accessibilityLabel={`${rating.toFixed(1)} מתוך 5 כוכבים`}>
    {[1, 2, 3, 4, 5].map(value => {
      const icon = <Ionicons name={rating >= value ? 'star' : rating >= value - 0.5 ? 'star-half' : 'star-outline'} size={onChange ? 30 : 14} color={rating >= value - 0.5 ? storeAccent.ink : '#C7C9CC'} />;
      return onChange ? <Pressable key={value} disabled={disabled} onPress={() => onChange(value)} style={s.starButton} accessibilityRole="button" accessibilityLabel={`${value} כוכבים`} accessibilityState={{ selected: rating === value, disabled }}>{icon}</Pressable> : <View key={value}>{icon}</View>;
    })}
  </View>;
}

function ReviewCard({ review, onPhoto }: { review: ProductReview; onPhoto: (url: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const date = new Date(review.created_at);
  return <View style={s.review}>
    <View style={s.row}>
      <View style={s.avatar}>
        {review.avatar_url && !avatarFailed ? <Image source={{ uri: review.avatar_url }} style={s.avatarImage} onError={() => setAvatarFailed(true)} /> : <Text style={s.initial}>{review.customer_name.trim().charAt(0)}</Text>}
      </View>
      <View style={s.grow}>
        <Text style={s.name}>{review.customer_name}</Text>
        {review.city ? <Text style={s.meta}>{review.city}</Text> : null}
      </View>
      <View style={s.reviewRating}><Stars rating={review.rating} />{!Number.isNaN(date.getTime()) ? <Text style={s.date}>{date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })}</Text> : null}</View>
    </View>
    <Text style={s.reviewText} numberOfLines={expanded ? undefined : 4} onTextLayout={event => { if (!expanded) setOverflows(event.nativeEvent.lines.length >= 4); }}>{review.review_text}</Text>
    {overflows ? <Pressable accessibilityRole="button" onPress={() => setExpanded(value => !value)} style={s.textButton}><Text style={s.link}>{expanded ? 'הצג פחות' : 'קרא עוד'}</Text></Pressable> : null}
    {review.image_url ? <Pressable onPress={() => onPhoto(review.image_url!)} accessibilityRole="button" accessibilityLabel={`הגדלת התמונה של ${review.customer_name}`} style={s.reviewPhoto}><Image source={{ uri: review.image_url }} style={s.photo} resizeMode="cover" /></Pressable> : null}
  </View>;
}

function ReviewForm({ handle, title, onClose, onSent }: { handle: string; title: string; onClose: () => void; onSent: () => void }) {
  const { user } = useAuth();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(user?.name ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const pickLocked = useRef(false);
  const input = { product_handle: handle, product_title: title, customer_name: name, city, rating, review_text: body, image_url: photo };
  const disabled = busy || picking;

  async function pickPhoto() {
    if (pickLocked.current || locked.current) return;
    pickLocked.current = true;
    setPicking(true);
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: false });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const resize = asset.width >= asset.height ? { width: Math.min(900, asset.width) } : { height: Math.min(900, asset.height) };
      const image = await ImageManipulator.manipulateAsync(asset.uri, [{ resize }], { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (!image.base64) throw new Error('Missing image');
      const url = `data:image/jpeg;base64,${image.base64}`;
      if (url.length > 2_000_000) { setError('התמונה גדולה מדי, נסו תמונה אחרת'); return; }
      setPhoto(url);
    } catch {
      setError('לא הצלחנו לפתוח את התמונה. בדקו את ההרשאה לתמונות ונסו שוב.');
    } finally {
      pickLocked.current = false;
      setPicking(false);
    }
  }

  async function send() {
    if (locked.current || pickLocked.current) return;
    const validation = validateReview(input);
    if (validation) { setError(validation); return; }
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      await submitProductReview(input);
      onSent();
    } catch {
      setError('לא התקבל אישור שהביקורת נשמרה. הטקסט שלכם נשמר כאן; בדקו את החיבור ואת רשימת הביקורות לפני שליחה נוספת.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return <Modal visible animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={() => { if (!disabled) onClose(); }}>
    <KeyboardAvoidingView style={[s.form, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.formHeader}>
        <Pressable disabled={disabled} onPress={onClose} accessibilityRole="button" accessibilityLabel="סגירת כתיבת ביקורת" style={[s.close, disabled && s.disabled]}><Ionicons name="close" size={22} color="#202124" /></Pressable>
        <Text style={s.heading}>איך היה המוצר?</Text>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.formBody}>
        <Text style={s.productTitle}>{title}</Text>
        <Text style={s.label}>הדירוג שלכם</Text>
        <View style={s.ratingPicker}><Stars rating={rating} onChange={setRating} disabled={disabled} /></View>
        <Text style={s.label}>שם</Text>
        <TextInput accessibilityLabel="השם שיופיע בביקורת" editable={!disabled} value={name} onChangeText={setName} maxLength={100} placeholder="השם שיופיע בביקורת" placeholderTextColor="#929498" style={s.input} autoComplete="name" />
        <Text style={s.label}>עיר · לא חובה</Text>
        <TextInput accessibilityLabel="עיר, לא חובה" editable={!disabled} value={city} onChangeText={setCity} maxLength={100} placeholder="מאיפה אתם?" placeholderTextColor="#929498" style={s.input} />
        <Text style={s.label}>הביקורת שלכם</Text>
        <TextInput accessibilityLabel="תוכן הביקורת" editable={!disabled} value={body} onChangeText={setBody} maxLength={4000} multiline textAlignVertical="top" placeholder="מה אהבתם? איך הייתה החוויה עם המוצר?" placeholderTextColor="#929498" style={[s.input, s.bodyInput]} />
        <Text style={s.meta}>לפחות 8 תווים</Text>
        <Pressable onPress={pickPhoto} disabled={disabled} accessibilityRole="button" style={s.photoPicker}>
          {photo ? <Image source={{ uri: photo }} style={s.photoPreview} /> : <View style={s.photoPlaceholder}>{picking ? <ActivityIndicator color="#202124" /> : <Ionicons name="camera-outline" size={23} color="#676A6E" />}</View>}
          <View style={s.grow}><Text style={s.name}>{photo ? 'החלפת תמונה' : 'יש לכם תמונה של המוצר?'}</Text><Text style={s.meta}>אפשר לצרף לביקורת · לא חובה</Text></View>
          <Ionicons name="add" size={20} color="#676A6E" />
        </Pressable>
        {photo ? <Pressable disabled={disabled} onPress={() => setPhoto(null)} accessibilityRole="button" style={s.textButton}><Text style={s.link}>הסרת התמונה</Text></Pressable> : null}
        {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{error}</Text> : null}
      </ScrollView>
      <View style={[s.formFooter, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <Text style={s.disclosure}>השם, העיר, הביקורת והתמונה יוצגו לצד המוצר.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="שליחת ביקורת" disabled={disabled || !!validateReview(input)} onPress={send} style={[s.submit, (disabled || !!validateReview(input)) && s.disabled]}>
          {busy ? <ActivityIndicator color={storeAccent.onPrimary} /> : <Text style={s.submitText}>שליחת ביקורת</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

export function ProductReviews({ handle, title }: { handle: string; title: string }) {
  const client = useQueryClient();
  const insets = useSafeAreaInsets();
  const query = useQuery({ queryKey: productReviewsKey(handle), queryFn: ({ signal }) => fetchProductReviews(handle, signal), staleTime: 60_000, retry: 1 });
  const [formOpen, setFormOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [limit, setLimit] = useState(3);
  const [sent, setSent] = useState(false);
  const reviews = query.data ?? [];
  const average = reviews.length ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0;

  return <View style={s.section}>
    <View style={s.row}>
      <Text style={[s.heading, s.grow]}>מה אומרים על המוצר</Text>
      <Pressable accessibilityRole="button" onPress={() => { setSent(false); setFormOpen(true); }} style={s.writeButton}><Ionicons name="create-outline" size={16} color="#202124" /><Text style={s.link}>כתיבת ביקורת</Text></Pressable>
    </View>
    {sent ? <Text accessibilityLiveRegion="polite" style={s.success}>תודה ששיתפתם! הביקורת נשלחה בהצלחה.</Text> : null}
    {query.isPending ? <View style={s.loading}><ActivityIndicator color="#85888C" /><Text style={s.meta}>טוענים את הביקורות…</Text></View> : null}
    {query.isError ? <View style={s.notice}><Text style={s.muted}>לא הצלחנו לעדכן את הביקורות כרגע.</Text><Pressable accessibilityRole="button" disabled={query.isFetching} onPress={() => { void query.refetch(); }} style={s.textButton}><Text style={s.link}>{query.isFetching ? 'טוענים…' : 'ניסיון נוסף'}</Text></Pressable><Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(`https://www.ocd-online.co.il/product/${encodeURIComponent(handle)}`).catch(() => {}); }} style={s.textButton}><Text style={s.link}>למוצר באתר</Text></Pressable></View> : null}
    {!query.isPending && !query.isError && !reviews.length ? <View style={s.notice}><Ionicons name="chatbubble-ellipses-outline" size={24} color="#85888C" /><Text style={s.name}>החוויה שלכם יכולה לעזור לאחרים</Text><Text style={s.muted}>עדיין אין ביקורות. תהיו הראשונים לשתף.</Text></View> : null}
    {reviews.length > 0 ? <>
      <View style={s.summary}>
        <Text style={s.score}>{average.toFixed(1)}</Text>
        <View style={s.summaryDetails}><Stars rating={average} /><Text style={s.meta}>מבוסס על {reviews.length} ביקורות</Text></View>
        <View style={s.summaryIcon}><Ionicons name="chatbubbles-outline" size={24} color="#85888C" /></View>
      </View>
      {reviews.slice(0, limit).map(review => <ReviewCard key={review.id} review={review} onPhoto={setPhoto} />)}
      {limit < reviews.length ? <Pressable accessibilityRole="button" onPress={() => setLimit(value => value + 5)} style={s.more}><Text style={s.link}>עוד ביקורות ({reviews.length - limit})</Text><Ionicons name="chevron-down" size={15} color="#676A6E" /></Pressable> : null}
    </> : null}
    {formOpen ? <ReviewForm handle={handle} title={title} onClose={() => setFormOpen(false)} onSent={() => { setFormOpen(false); setSent(true); void client.invalidateQueries({ queryKey: productReviewsKey(handle) }); }} /> : null}
    <Modal visible={!!photo} transparent animationType="fade" onRequestClose={() => setPhoto(null)}>
      <View style={s.lightbox}>
        {photo ? <Image source={{ uri: photo }} style={s.fullPhoto} resizeMode="contain" /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="סגירת תמונת ביקורת" onPress={() => setPhoto(null)} style={[s.photoClose, { top: insets.top + 12 }]}><Ionicons name="close" size={24} color="#FFFFFF" /></Pressable>
      </View>
    </Modal>
  </View>;
}

const rtl = { textAlign: 'right' as const, writingDirection: 'rtl' as const };
const s = StyleSheet.create({
  section: { marginHorizontal: 20, marginTop: 28, paddingTop: 24, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7E8EA', gap: 18 },
  row: { flexDirection: 'row-reverse', direction: 'ltr', alignItems: 'center', gap: 10 },
  grow: { flex: 1 },
  heading: { ...rtl, fontSize: 17, fontWeight: '600', color: '#202124' },
  writeButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E7E8EA', borderRadius: radii.compact },
  link: { ...rtl, color: storeAccent.ink, fontSize: 12, fontWeight: '600' },
  stars: { flexDirection: 'row', direction: 'ltr', gap: 2 },
  summary: { flexDirection: 'row-reverse', direction: 'ltr', gap: 14, alignItems: 'center', padding: 18, backgroundColor: '#F6F6F6', borderRadius: radii.surface },
  score: { fontSize: 34, fontWeight: '600', color: '#202124', fontVariant: ['tabular-nums'] },
  summaryDetails: { gap: 6, alignItems: 'flex-end', flex: 1 },
  summaryIcon: { paddingLeft: 4 },
  meta: { ...rtl, fontSize: 12, lineHeight: 18, color: '#85888C' },
  review: { paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7E8EA', gap: 12 },
  avatar: { width: 36, height: 36, borderRadius: radii.pill, backgroundColor: '#F3F3F3', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  initial: { color: '#676A6E', fontWeight: '600', fontSize: 14 },
  name: { ...rtl, fontWeight: '600', fontSize: 14, lineHeight: 21, color: '#202124' },
  reviewRating: { gap: 5, alignItems: 'flex-start' },
  date: { fontSize: 10, color: '#929498' },
  reviewText: { ...rtl, fontSize: 14, lineHeight: 23, color: '#55585C' },
  textButton: { alignSelf: 'flex-end', minHeight: 36, justifyContent: 'center' },
  reviewPhoto: { alignSelf: 'flex-end', width: 88, height: 88, borderRadius: radii.compact, overflow: 'hidden', backgroundColor: '#F6F6F6' },
  photo: { width: '100%', height: '100%' },
  more: { flexDirection: 'row-reverse', gap: 8, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F6F6', borderRadius: radii.surface },
  loading: { paddingVertical: 18, gap: 12, alignItems: 'center' },
  notice: { backgroundColor: '#F7F7F7', borderRadius: radii.surface, padding: 18, gap: 8, alignItems: 'flex-end' },
  muted: { ...rtl, color: '#85888C', fontSize: 13, lineHeight: 21 },
  success: { ...rtl, padding: 14, borderRadius: radii.compact, backgroundColor: storeAccent.soft, color: storeAccent.ink, fontSize: 13, lineHeight: 21 },
  form: { flex: 1, backgroundColor: '#FFFFFF' },
  formHeader: { flexDirection: 'row', direction: 'ltr', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  close: { width: 44, height: 44, borderRadius: radii.pill, backgroundColor: '#F6F6F6', alignItems: 'center', justifyContent: 'center' },
  formBody: { paddingHorizontal: 22, paddingBottom: 24 },
  productTitle: { ...rtl, color: '#85888C', fontSize: 14, lineHeight: 22, marginBottom: 20 },
  label: { ...rtl, color: '#55585C', fontSize: 13, fontWeight: '500', marginBottom: 8, marginTop: 16 },
  ratingPicker: { alignItems: 'flex-end' },
  starButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { ...rtl, fontSize: 16, color: '#202124', backgroundColor: '#F6F6F6', borderRadius: radii.surface, paddingHorizontal: 16, paddingVertical: 14, minHeight: 52 },
  bodyInput: { height: 132, lineHeight: 24 },
  photoPicker: { marginTop: 18, padding: 12, borderWidth: 1, borderColor: '#E7E8EA', borderRadius: radii.surface, flexDirection: 'row-reverse', direction: 'ltr', alignItems: 'center', gap: 12 },
  photoPreview: { width: 52, height: 52, borderRadius: radii.compact },
  photoPlaceholder: { width: 52, height: 52, borderRadius: radii.compact, backgroundColor: '#F6F6F6', alignItems: 'center', justifyContent: 'center' },
  error: { ...rtl, color: '#AE3655', fontSize: 13, lineHeight: 21, marginTop: 14 },
  formFooter: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7E8EA', gap: 10 },
  disclosure: { ...rtl, fontSize: 11, color: '#85888C', textAlign: 'center' },
  submit: { backgroundColor: storeAccent.primary, minHeight: 52, borderRadius: radii.surface, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: storeAccent.onPrimary, fontWeight: '600', fontSize: 15 },
  disabled: { opacity: 0.4 },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' },
  fullPhoto: { width: '100%', height: '80%' },
  photoClose: { position: 'absolute', right: 16, width: 44, height: 44, borderRadius: radii.pill, backgroundColor: '#363638', alignItems: 'center', justifyContent: 'center' },
});
