-- =====================================================================
-- مشروع "عائد" — Schema لـ RAG بثلاثة مستويات
-- Supabase (PostgreSQL 15+) + pgvector
-- الـ embeddings: vector(768)  (استخدم outputDimensionality=768 في Gemini)
-- شغّله في SQL Editor دفعة واحدة. الجدول القديم documents لا يُمس.
-- =====================================================================

create extension if not exists vector;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- 0) فرض المصادر المعتمدة على مستوى قاعدة البيانات
--    أي رابط خارج القائمة يُرفض عند الإدخال (sunnah.com, tanzil.net, ... مرفوضة)
-- ---------------------------------------------------------------------
create domain approved_source_url as text
  check (
    value ~ '^https://(www\.)?(quranpedia\.net|dorar\.net|dawa\.center|islamic-content\.com)(/|$)'
  );

-- تحديث updated_at تلقائياً
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- المستوى 1: نصوص ثابتة
-- ---------------------------------------------------------------------

-- 1) القرآن (6,236 آية) — النص من quranpedia، التفسير من dorar.net/tafseer
create table quran (
  id              bigserial primary key,
  surah_number    int  not null check (surah_number between 1 and 114),
  surah_name      text not null,
  ayah_number     int  not null check (ayah_number >= 1),
  text_arabic     text not null,
  tafseer         text,                       -- تفسير مختصر
  translations    jsonb not null default '{}'::jsonb,   -- {"en":"..","fr":"..","ur":"..","id":".."}
  embedding       vector(768),
  source          text not null default 'quranpedia.net',
  source_url      approved_source_url not null,
  tafseer_source_url approved_source_url,
  fts             tsvector generated always as (
                    to_tsvector('arabic', text_arabic || ' ' || coalesce(tafseer, ''))
                  ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (surah_number, ayah_number),
  check (source_url like 'https://quranpedia.net%' or source_url like 'https://www.quranpedia.net%'),
  check (tafseer_source_url is null or tafseer_source_url like 'https://dorar.net/tafseer%'
         or tafseer_source_url like 'https://www.dorar.net/tafseer%')
);

-- 2) الحديث (500 حديث من الصحيحين) — dorar.net/hadith
create table hadith (
  id              bigserial primary key,
  book            text not null,              -- "صحيح البخاري" / "صحيح مسلم"
  number          int,
  chapter         text,
  narrator        text,                       -- الراوي (الصحابي)
  text            text not null,
  grade           text not null default 'صحيح',
  translations    jsonb not null default '{}'::jsonb,
  embedding       vector(768),
  source          text not null default 'dorar.net/hadith',
  source_url      approved_source_url not null,
  fts             tsvector generated always as (to_tsvector('arabic', text)) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (book, number),
  check (source_url like 'https://dorar.net/hadith%' or source_url like 'https://www.dorar.net/hadith%')
);

-- ---------------------------------------------------------------------
-- المستوى 2: نصوص متجددة (شبه ثابتة)
-- ---------------------------------------------------------------------

-- 3) العقيدة — dorar.net/aqeeda
create table aqeeda (
  id              bigserial primary key,
  topic           text not null,              -- عنوان المسألة
  category        text,                       -- التوحيد / الإيمان / ...
  content         text not null,
  translations    jsonb not null default '{}'::jsonb,
  embedding       vector(768),
  source          text not null default 'dorar.net/aqeeda',
  source_url      approved_source_url not null,
  fts             tsvector generated always as (to_tsvector('arabic', topic || ' ' || content)) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (source_url),
  check (source_url like 'https://dorar.net/aqeeda%' or source_url like 'https://www.dorar.net/aqeeda%')
);

-- 4) الفقه — dorar.net/feqhia
create table feqhi (
  id              bigserial primary key,
  topic           text not null,
  category        text,                       -- طهارة / صلاة / صيام / ...
  content         text not null,
  translations    jsonb not null default '{}'::jsonb,
  embedding       vector(768),
  source          text not null default 'dorar.net/feqhia',
  source_url      approved_source_url not null,
  fts             tsvector generated always as (to_tsvector('arabic', topic || ' ' || content)) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (source_url),
  check (source_url like 'https://dorar.net/feqhia%' or source_url like 'https://www.dorar.net/feqhia%')
);

-- 5) السيرة — dorar.net/history
create table seerah (
  id              bigserial primary key,
  title           text not null,
  period          text,                       -- مكية / مدنية
  year_hijri      int,
  content         text not null,
  translations    jsonb not null default '{}'::jsonb,
  embedding       vector(768),
  source          text not null default 'dorar.net/history',
  source_url      approved_source_url not null,
  fts             tsvector generated always as (to_tsvector('arabic', title || ' ' || content)) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (source_url),
  check (source_url like 'https://dorar.net/history%' or source_url like 'https://www.dorar.net/history%')
);

-- 6) المصطلحات — islamic-content.com/dictionary
create table terminology (
  id              bigserial primary key,
  term_ar         text not null,
  definition_ar   text,
  translations    jsonb not null default '{}'::jsonb,   -- {"en":{"term":"..","definition":".."}, "fr":{...}}
  embedding       vector(768),
  source          text not null default 'islamic-content.com/dictionary',
  source_url      approved_source_url not null,
  fts             tsvector generated always as (
                    to_tsvector('arabic', term_ar || ' ' || coalesce(definition_ar, ''))
                  ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (term_ar),
  check (source_url like 'https://islamic-content.com/dictionary%'
         or source_url like 'https://www.islamic-content.com/dictionary%')
);

-- 7) الشبهات والردود — dawa.center/file/7937
create table dawah (
  id              bigserial primary key,
  question        text not null,              -- نص الشبهة
  answer          text not null,              -- الرد
  category        text,
  translations    jsonb not null default '{}'::jsonb,
  embedding       vector(768),
  source          text not null default 'dawa.center/file/7937',
  source_url      approved_source_url not null,
  fts             tsvector generated always as (to_tsvector('arabic', question || ' ' || answer)) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (question),
  check (source_url like 'https://dawa.center%' or source_url like 'https://www.dawa.center%')
);

-- ---------------------------------------------------------------------
-- Triggers: updated_at
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['quran','hadith','aqeeda','feqhi','seerah','terminology','dawah']
  loop
    execute format(
      'create trigger trg_%1$s_updated before update on %1$s
       for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Indexes: HNSW للمتجهات + GIN للبحث النصي + بحث مباشر بالآية/الحديث
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['quran','hadith','aqeeda','feqhi','seerah','terminology','dawah']
  loop
    execute format('create index %1$s_embedding_idx on %1$s using hnsw (embedding vector_cosine_ops)', t);
    execute format('create index %1$s_fts_idx on %1$s using gin (fts)', t);
  end loop;
end $$;

create index quran_surah_ayah_idx on quran (surah_number, ayah_number);
create index terminology_term_trgm on terminology using gin (term_ar gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Row Level Security: القراءة عامة، الكتابة عبر service_role فقط
-- (service_role يتجاوز RLS تلقائياً، فلا نحتاج سياسات كتابة)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['quran','hadith','aqeeda','feqhi','seerah','terminology','dawah']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- دالة البحث الموحّدة (هجينة: متجهات 70% + نص 30%)
--   query_text      : نص السؤال (للبحث النصي)
--   query_embedding : متجه السؤال (768)
--   tables          : null = كل الجداول، أو مصفوفة مثل ['quran','hadith']
-- تُرجع أفضل match_count نتيجة عبر كل الجداول مع اسم الجدول والمصدر
-- ---------------------------------------------------------------------
create or replace function search_knowledge(
  query_embedding vector(768),
  query_text      text,
  match_count     int  default 8,
  tables          text[] default null,
  min_similarity  float default 0.30
)
returns table (
  source_table text,
  row_id       bigint,
  title        text,
  content      text,
  source_url   text,
  score        float
)
language sql stable
as $$
  with q as (select websearch_to_tsquery('arabic', coalesce(query_text, '')) as tsq),
  all_rows as (
    select 'quran'::text as source_table, id as row_id,
           surah_name || ' — آية ' || ayah_number as title,
           text_arabic || coalesce(E'\nالتفسير: ' || tafseer, '') as content,
           source_url::text as source_url, embedding, fts
    from quran where tables is null or 'quran' = any(tables)
    union all
    select 'hadith', id, book || ' #' || coalesce(number::text, ''), text,
           source_url::text, embedding, fts
    from hadith where tables is null or 'hadith' = any(tables)
    union all
    select 'aqeeda', id, topic, content, source_url::text, embedding, fts
    from aqeeda where tables is null or 'aqeeda' = any(tables)
    union all
    select 'feqhi', id, topic, content, source_url::text, embedding, fts
    from feqhi where tables is null or 'feqhi' = any(tables)
    union all
    select 'seerah', id, title, content, source_url::text, embedding, fts
    from seerah where tables is null or 'seerah' = any(tables)
    union all
    select 'terminology', id, term_ar, coalesce(definition_ar, ''), source_url::text, embedding, fts
    from terminology where tables is null or 'terminology' = any(tables)
    union all
    select 'dawah', id, question, answer, source_url::text, embedding, fts
    from dawah where tables is null or 'dawah' = any(tables)
  )
  select r.source_table, r.row_id, r.title, r.content, r.source_url,
         (0.7 * (1 - (r.embedding <=> query_embedding))
          + 0.3 * least(ts_rank_cd(r.fts, q.tsq), 1.0))::float as score
  from all_rows r, q
  where r.embedding is not null
    and (1 - (r.embedding <=> query_embedding)) >= min_similarity
  order by score desc
  limit match_count;
$$;

-- ---------------------------------------------------------------------
-- جدول تخزين مؤقت للمستوى 3 (Live): كاش لنتائج السكرابينغ لتخفيف الحمل
-- ---------------------------------------------------------------------
create table live_cache (
  id          bigserial primary key,
  query_hash  text not null unique,
  query_text  text not null,
  result      jsonb not null,
  source_url  approved_source_url not null,
  fetched_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days'
);
alter table live_cache enable row level security;  -- بدون سياسات: service_role فقط
create index live_cache_expires_idx on live_cache (expires_at);

-- مثال استدعاء من Supabase JS:
-- const { data } = await supabase.rpc('search_knowledge', {
--   query_embedding: embedding, query_text: question, match_count: 8, tables: ['hadith','aqeeda']
-- });