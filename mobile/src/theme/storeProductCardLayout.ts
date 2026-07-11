/**
 * גובה קבוע לאזור מחיר + כותרת + משנה (בלי padding של הכרטיס).
 * מונע כרטיסים בגבהים שונים כשהכותרת תופסת שורה אחת או שתיים.
 */
/** כרטיסי קרוסלה (מארזים / מומלצים / חדש) — fontSize 12/14 */
export const STORE_RAIL_CARD_BODY_HEIGHT = 72;

/** כרטיסי גריד (קטגוריה / מועדפים) — fontSize 13/16 */
export const STORE_GRID_CARD_BODY_HEIGHT = 76;

/** @deprecated Use STORE_RAIL_CARD_BODY_HEIGHT */
export const STORE_BUNDLE_CARD_BODY_MIN_HEIGHT = STORE_RAIL_CARD_BODY_HEIGHT;
