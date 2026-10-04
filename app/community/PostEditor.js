// app/community/PostEditor.js
'use client';

import { useState } from 'react';
import { useLanguage } from '@/app/layout';
import { createPost, uploadMedia } from '@/lib/supabase-client';
import { ImageIcon, VideoIcon, XIcon, GlobeIcon } from './Icons';

export default function PostEditor({ user, profile, onPost }) {
  const { lang, t } = useLanguage();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setError('File too large (max 50 MB)');
      return;
    }

    const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;
    if (!type) {
      setError('Unsupported file type');
      return;
    }

    setMediaFile(file);
    setMediaType(type);
    setError('');

    const reader = new FileReader();
    reader.onload = (ev) => setMediaPreview({ url: ev.target.result, type });
    reader.readAsDataURL(file);
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaType(null);
    setMediaPreview(null);
  };

  const handleSubmit = async () => {
    if (!content.trim() && !mediaFile) return;
    setPosting(true);
    setError('');

    try {
      let mediaUrl = null;
      if (mediaFile) {
        mediaUrl = await uploadMedia(mediaFile, user.id);
      }

      const post = await createPost(
        user.id,
        content.trim() || (mediaType === 'video' ? '[Video]' : '[Image]'),
        category,
        lang,
        mediaUrl,
        mediaType
      );

      post.author = {
        id: user.id,
        name: profile?.name || 'User',
        avatar_initial: profile?.avatar_initial || 'U',
        country: profile?.country || null,
      };

      onPost(post);
      setContent('');
      setCategory('general');
      removeMedia();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Post failed');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold flex-shrink-0">
          {profile?.avatar_initial || 'U'}
        </div>

        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t.community.post_placeholder}
            rows={3}
            className="w-full p-3 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-teal-500 resize-none"
          />

          {mediaPreview && (
            <div className="relative mt-2 rounded-xl overflow-hidden">
              {mediaPreview.type === 'image' ? (
                <img src={mediaPreview.url} alt="Preview" className="w-full max-h-64 object-cover" />
              ) : (
                <video src={mediaPreview.url} controls className="w-full max-h-64" />
              )}
              <button
                onClick={removeMedia}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center"
                title="Remove"
              >
                <XIcon size={16} />
              </button>
            </div>
          )}

          {error && (
            <div className="mt-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-xs">
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-2 items-center flex-wrap">
            <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition">
              <ImageIcon size={18} />
              <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </label>

            <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition">
              <VideoIcon size={18} />
              <input type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />
            </label>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex-1 p-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-teal-500"
            >
              <option value="general">{t.community.categories.general}</option>
              <option value="question">{t.community.categories.question}</option>
              <option value="experience">{t.community.categories.experience}</option>
              <option value="support">{t.community.categories.support}</option>
              <option value="advice">{t.community.categories.advice}</option>
            </select>

            <button
              onClick={handleSubmit}
              disabled={(!content.trim() && !mediaFile) || posting}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg font-bold text-sm transition disabled:opacity-50"
            >
              {posting ? '...' : t.community.post_button}
            </button>
          </div>

          <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <GlobeIcon size={12} />
            <span>{t.community.translate_note}</span>
          </div>
        </div>
      </div>
    </div>
  );
}