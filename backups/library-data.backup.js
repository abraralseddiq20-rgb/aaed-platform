// lib/library-data.js
// ثوابت المكتبة — المستويات والتصنيفات واللغات

export const LEVELS = [
  { id: 'seeker',   name_ar: 'الباحث',       is_available: true },
  { id: 'returner', name_ar: 'العائد',       is_available: true },
  { id: 'learner',  name_ar: 'المتعلّم',     is_available: true },
  { id: 'scholar',  name_ar: 'المعلم الشرعي', is_available: true },
];

export const CATEGORIES = [
  { id: 'basics',      name_ar: 'أساسيات' },
  { id: 'aqeeda',      name_ar: 'عقيدة' },
  { id: 'fiqh',        name_ar: 'فقه' },
  { id: 'seerah',      name_ar: 'سيرة' },
  { id: 'quran',       name_ar: 'قرآن' },
  { id: 'hadith',      name_ar: 'حديث' },
  { id: 'dawah',       name_ar: 'دعوة' },
  { id: 'terminology', name_ar: 'مصطلحات' },
];

export const CONTENT_TYPES = [
  { id: 'lesson', name_ar: 'دروس' },
  { id: 'book',   name_ar: 'كتب' },
  { id: 'audio',  name_ar: 'صوتيات' },
  { id: 'video',  name_ar: 'مرئيات' },
];

export const LANGS = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ur', label: 'اردو' },
  { code: 'id', label: 'Indonesia' },
];