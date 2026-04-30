import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import type { DateData, MarkedDates } from 'react-native-calendars';
import { yyyyMmDd } from '../lib/time';
import { colors } from '../theme/colors';

const HE = 'he';

function monthStart(dateYmd: string): string {
  const [year, month] = dateYmd.slice(0, 10).split('-').map((x) => Number(x));
  if (!year || !month) return dateYmd;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function shiftMonth(dateYmd: string, delta: number): string {
  const [year, month] = monthStart(dateYmd).split('-').map((x) => Number(x));
  const d = new Date(year, month - 1 + delta, 1);
  return yyyyMmDd(d);
}

function clampVisibleMonth(dateYmd: string, minDate: string, maxDate: string): string {
  const target = monthStart(dateYmd);
  const min = monthStart(minDate);
  const max = monthStart(maxDate);
  if (target < min) return min;
  if (target > max) return max;
  return target;
}

function registerHebrewLocaleOnce() {
  if (LocaleConfig.locales[HE]) return;
  LocaleConfig.locales[HE] = {
    monthNames: [
      'ינואר',
      'פברואר',
      'מרץ',
      'אפריל',
      'מאי',
      'יוני',
      'יולי',
      'אוגוסט',
      'ספטמבר',
      'אוקטובר',
      'נובמבר',
      'דצמבר',
    ],
    monthNamesShort: ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יונ׳', 'יול׳', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'],
    dayNames: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
    dayNamesShort: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'],
    today: 'היום',
  };
}

export type HebrewMonthCalendarProps = {
  /** yyyy-MM-dd */
  selected: string;
  onSelect: (ymd: string) => void;
  /** ימים קדימה מהיום (כולל היום) */
  horizonDays?: number;
};

export function HebrewMonthCalendar({ selected, onSelect, horizonDays = 180 }: HebrewMonthCalendarProps) {
  const prevDefaultLocale = useRef<string | undefined>(undefined);

  useEffect(() => {
    registerHebrewLocaleOnce();
    prevDefaultLocale.current = LocaleConfig.defaultLocale;
    LocaleConfig.defaultLocale = HE;
    return () => {
      LocaleConfig.defaultLocale = prevDefaultLocale.current ?? '';
    };
  }, []);

  const { minDate, maxDate } = useMemo(() => {
    const today = new Date();
    const min = yyyyMmDd(today);
    const end = new Date(today);
    end.setDate(end.getDate() + horizonDays);
    return { minDate: min, maxDate: yyyyMmDd(end) };
  }, [horizonDays]);

  const current = selected || minDate;
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(current));

  useEffect(() => {
    setVisibleMonth(clampVisibleMonth(current, minDate, maxDate));
  }, [current, minDate, maxDate]);

  const markedDates: MarkedDates = useMemo(() => {
    const out: MarkedDates = {};
    if (selected) {
      out[selected] = {
        selected: true,
        selectedColor: colors.primary,
        selectedTextColor: '#FFFFFF',
      };
    }
    return out;
  }, [selected]);

  const theme = useMemo(
    () => ({
      backgroundColor: 'transparent',
      calendarBackground: 'transparent',
      textSectionTitleColor: colors.muted,
      selectedDayBackgroundColor: colors.primary,
      selectedDayTextColor: '#FFFFFF',
      todayTextColor: '#1D4ED8',
      todayBackgroundColor: 'rgba(37, 99, 235, 0.14)',
      dayTextColor: '#0F172A',
      textDisabledColor: '#94A3B8',
      textInactiveColor: '#CBD5E1',
      dotColor: colors.primary,
      selectedDotColor: '#FFFFFF',
      arrowColor: colors.primary,
      monthTextColor: colors.text,
      textDayFontWeight: '700' as const,
      textMonthFontWeight: '800' as const,
      textDayHeaderFontWeight: '800' as const,
      textDayFontSize: 17,
      textMonthFontSize: 20,
      textDayHeaderFontSize: 14,
      arrowStyle: { padding: 14 },
      'stylesheet.calendar.header': {
        week: {
          marginTop: 6,
          marginBottom: 4,
          flexDirection: 'row-reverse',
          justifyContent: 'space-between',
          alignItems: 'center',
          alignSelf: 'stretch',
          paddingHorizontal: 0,
        },
        dayHeader: {
          flex: 1,
          minWidth: 0,
          marginTop: 2,
          marginBottom: 10,
          textAlign: 'center',
          fontSize: 14,
          fontWeight: '800',
          color: colors.muted,
        },
        monthText: {
          fontSize: 20,
          fontWeight: '800',
          color: colors.text,
          marginVertical: 8,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 10,
          marginTop: 6,
          marginBottom: 2,
        },
      },
      'stylesheet.calendar.main': {
        container: {
          paddingLeft: 2,
          paddingRight: 2,
          backgroundColor: 'transparent',
        },
        week: {
          marginVertical: 6,
          flexDirection: 'row-reverse',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
      },
      'stylesheet.day.basic': {
        base: {
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
        },
        text: {
          fontSize: 17,
          fontWeight: '700',
        },
        selected: {
          borderRadius: 20,
        },
        today: {
          borderRadius: 20,
        },
      },
    }),
    []
  );

  return (
    <View style={styles.shell}>
      <Calendar
        key={visibleMonth}
        current={visibleMonth}
        minDate={minDate}
        maxDate={maxDate}
        markedDates={markedDates}
        onDayPress={(day: DateData) => onSelect(day.dateString)}
        onMonthChange={(month: DateData) => setVisibleMonth(monthStart(month.dateString))}
        onPressArrowLeft={() => setVisibleMonth((month) => clampVisibleMonth(shiftMonth(month, 1), minDate, maxDate))}
        onPressArrowRight={() => setVisibleMonth((month) => clampVisibleMonth(shiftMonth(month, -1), minDate, maxDate))}
        firstDay={0}
        enableSwipeMonths
        hideExtraDays
        theme={theme}
        style={styles.calendar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignSelf: 'stretch',
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.07,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 4 },
    }),
  },
  calendar: {
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 0,
  },
});
