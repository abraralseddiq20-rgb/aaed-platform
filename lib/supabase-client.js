// lib/supabase-client.js
'use client';

import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ═══ Auth ═══
export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email, password, options: { data: { name } },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', userId).single();
  if (error) return null;
  return data;
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles').update(updates).eq('id', userId).select().single();
  if (error) throw error;
  return data;
}

// ═══ Media ═══
export async function uploadMedia(file, userId) {
  if (!file) throw new Error('No file');
  if (file.size > 50 * 1024 * 1024) throw new Error('الملف كبير جداً (50 MB كحد أقصى)');
  const ext = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('media').upload(fileName, file, { cacheControl: '3600' });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('media').getPublicUrl(data.path);
  return urlData.publicUrl;
}

// ═══ Translate & Moderate ═══
export async function translateContent(text, from, to) {
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, from, to }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.translation;
  } catch { return null; }
}

export async function translateToAll(text, sourceLang) {
  const langs = ['ar', 'en', 'fr', 'ur', 'id'].filter((l) => l !== sourceLang);
  const translations = {};
  for (const lang of langs) {
    const t = await translateContent(text, sourceLang, lang);
    if (t) translations[lang] = t;
  }
  return translations;
}

export async function moderateContent(text) {
  try {
    const res = await fetch('/api/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return { safe: true };
    return await res.json();
  } catch { return { safe: true }; }
}

// ═══ Posts ═══
export async function getPosts(limit = 30) {
  const { data, error } = await supabase
    .from('posts')
    .select(`*, author:profiles!posts_author_id_fkey(id, name, avatar_initial, country)`)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function createPost(authorId, content, category = 'general', language = 'ar', mediaUrl = null, mediaType = null) {
  const mod = await moderateContent(content);
  if (!mod.safe) throw new Error(mod.reason || 'المحتوى مرفوض');

  const translations = await translateToAll(content, language);

  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: authorId, content, category, language,
      translations, media_url: mediaUrl, media_type: mediaType,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePost(postId, userId, updates) {
  const { data, error } = await supabase
    .from('posts').update(updates).eq('id', postId).eq('author_id', userId)
    .select().single();
  if (error) throw error;
  return data;
}

export async function deletePost(postId, userId) {
  const { error } = await supabase
    .from('posts').delete().eq('id', postId).eq('author_id', userId);
  if (error) throw error;
}

export async function repost(originalPostId, userId, note = '', userLanguage = 'ar') {
  const { data: original } = await supabase.from('posts').select('*').eq('id', originalPostId).single();
  if (!original) throw new Error('المنشور الأصلي غير موجود');
  let content, translations, language;
  if (note && note.trim()) {
    content = note.trim();
    language = userLanguage;
    translations = await translateToAll(content, language);
  } else {
    content = original.content;
    language = original.language;
    translations = original.translations;
  }
  const { data, error } = await supabase
    .from('posts').insert({
      author_id: userId, content, category: original.category,
      language, translations,
      media_url: original.media_url, media_type: original.media_type,
      reposted_from_id: originalPostId,
    }).select().single();
  if (error) throw error;
  return data;
}

// ═══ Likes ═══
export async function toggleLike(postId, userId) {
  const { data: existing } = await supabase.from('likes')
    .select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle();
  if (existing) {
    await supabase.from('likes').delete().eq('id', existing.id);
    return { liked: false };
  } else {
    await supabase.from('likes').insert({ post_id: postId, user_id: userId });
    return { liked: true };
  }
}

export async function getUserLikes(userId) {
  const { data } = await supabase.from('likes').select('post_id').eq('user_id', userId);
  return new Set((data || []).map((l) => l.post_id));
}

// ═══ Comments ═══
export async function getComments(postId) {
  const { data, error } = await supabase
    .from('comments')
    .select(`*, author:profiles!comments_author_id_fkey(id, name, avatar_initial)`)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addComment(postId, authorId, content, language = 'ar', parentId = null) {
  const translations = await translateToAll(content, language);
  const { data, error } = await supabase
    .from('comments').insert({
      post_id: postId, author_id: authorId, content, language,
      translations, parent_comment_id: parentId,
    }).select().single();
  if (error) throw error;
  return data;
}

export async function updateComment(commentId, userId, content) {
  const { data, error } = await supabase
    .from('comments').update({ content }).eq('id', commentId).eq('author_id', userId)
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteComment(commentId, userId) {
  const { error } = await supabase.from('comments').delete().eq('id', commentId).eq('author_id', userId);
  if (error) throw error;
}

export async function toggleCommentLike(commentId, userId) {
  const { data: existing } = await supabase.from('comment_likes')
    .select('id').eq('comment_id', commentId).eq('user_id', userId).maybeSingle();
  if (existing) {
    await supabase.from('comment_likes').delete().eq('id', existing.id);
    return { liked: false };
  } else {
    await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId });
    return { liked: true };
  }
}

// ═══ DM ═══
export async function getConversations(userId) {
  const { data, error } = await supabase
    .from('direct_messages')
    .select(`*, sender:profiles!direct_messages_sender_id_fkey(id, name, avatar_initial), receiver:profiles!direct_messages_receiver_id_fkey(id, name, avatar_initial)`)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const map = new Map();
  for (const msg of data || []) {
    const other = msg.sender_id === userId ? msg.receiver : msg.sender;
    if (!map.has(other.id)) {
      map.set(other.id, { user: other, lastMessage: msg, unread: 0 });
    }
    if (msg.receiver_id === userId && !msg.read_at) map.get(other.id).unread += 1;
  }
  return Array.from(map.values());
}

export async function getDirectMessages(userId, otherId) {
  const { data, error } = await supabase
    .from('direct_messages').select('*')
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function sendDirectMessage(senderId, receiverId, content) {
  const { data, error } = await supabase
    .from('direct_messages').insert({ sender_id: senderId, receiver_id: receiverId, content })
    .select().single();
  if (error) throw error;
  return data;
}

export async function markMessagesRead(userId, otherId) {
  await supabase.from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('sender_id', otherId).eq('receiver_id', userId).is('read_at', null);
}

// ═══ Reports ═══
export async function reportContent(reporterId, contentType, contentId, reason, details = '') {
  const { data, error } = await supabase
    .from('reports').insert({ reporter_id: reporterId, content_type: contentType, content_id: contentId, reason, details })
    .select().single();
  if (error) throw error;
  return data;
}

// ═══ Guides ═══
export async function getGuides(filters = {}) {
  let query = supabase.from('profiles').select('*').eq('role', 'guide');
  if (filters.language) query = query.contains('languages', [filters.language]);
  if (filters.specialty) query = query.eq('specialty', filters.specialty);
  const { data, error } = await query.order('rating', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createChatSession(userId, guideId, initialQuestion, language = 'ar') {
  const { data, error } = await supabase
    .from('chat_sessions').insert({ user_id: userId, guide_id: guideId, initial_question: initialQuestion, language, status: 'pending' })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getUserSessions(userId) {
  const { data, error } = await supabase
    .from('chat_sessions').select(`*, guide:profiles!chat_sessions_guide_id_fkey(id, name, avatar_initial, specialty)`)
    .eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getMessages(sessionId) {
  const { data, error } = await supabase
    .from('messages').select(`*, sender:profiles!messages_sender_id_fkey(id, name, avatar_initial, role)`)
    .eq('session_id', sessionId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function sendMessage(sessionId, senderId, content) {
  const { data, error } = await supabase
    .from('messages').insert({ session_id: sessionId, sender_id: senderId, content })
    .select().single();
  if (error) throw error;
  return data;
}

// ═══ Library ═══
export async function getLibraryContent(filters = {}) {
  let query = supabase.from('library_content').select('*');
  if (filters.level) query = query.eq('level', filters.level);
  if (filters.category) query = query.eq('category', filters.category);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ═══ Guide Dashboard ═══
export async function getGuideSessions(guideId) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select(`
      *,
      user:profiles!chat_sessions_user_id_fkey(id, name, avatar_initial, country)
    `)
    .eq('guide_id', guideId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateSessionStatus(sessionId, status) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .update({ status })
    .eq('id', sessionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}