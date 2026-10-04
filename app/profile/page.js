// app/profile/[id]/page.js
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/app/layout';
import { supabase } from '@/lib/supabase-client';
import PostCard from '@/app/community/PostCard';

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [likedPosts, setLikedPosts] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const isRTL = lang === 'ar' || lang === 'ur';
  const profileId = params?.id;

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);

        const { data: prof } = await supabase
          .from('profiles').select('*').eq('id', profileId).single();
        setProfile(prof);

        const { data: userPosts } = await supabase
          .from('posts')
          .select(`*, author:profiles!posts_author_id_fkey(id, name, avatar_initial, country)`)
          .eq('author_id', profileId)
          .eq('is_hidden', false)
          .order('created_at', { ascending: false });
        setPosts(userPosts || []);

        if (user) {
          const { data: likes } = await supabase
            .from('likes').select('post_id').eq('user_id', user.id);
          if (likes) setLikedPosts(new Set(likes.map((l) => l.post_id)));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (profileId) loadData();
  }, [profileId]);

  if (loading) {
    return (
      <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center">
        <div className="text-white text-xl">{t.profile.loading}</div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md">
          <div className="text-5xl mb-4">👤</div>
          <h1 className="text-xl font-bold text-slate-800 mb-4">{t.community.profile_not_found}</h1>
          <button
            onClick={() => router.back()}
            className="text-teal-600 hover:underline"
          >
            ← {t.community.back}
          </button>
        </div>
      </main>
    );
  }

  const isOwner = currentUser?.id === profileId;

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex flex-col">
      <header className="bg-teal-900 text-white p-4 flex items-center justify-between shadow-lg">
        <button onClick={() => router.back()} className="text-2xl">→</button>
        <div className="text-xl font-bold">{t.profile.title}</div>
        <div className="flex gap-1">
          {['ar', 'en', 'fr', 'ur', 'id'].map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-2 py-1 rounded text-xs font-bold transition ${
                lang === l ? 'bg-amber-400 text-slate-900' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-4">

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-20 h-20 rounded-full bg-teal-600 text-white flex items-center justify-center text-3xl font-bold flex-shrink-0">
                {profile.avatar_initial || profile.name?.[0] || 'U'}
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-2xl text-slate-800">{profile.name}</h2>
                {profile.country && (
                  <p className="text-sm text-slate-500">📍 {profile.country}</p>
                )}
                <span className="inline-block mt-2 bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-xs font-medium">
                  {t.profile.roles[profile.role] || t.profile.roles.user}
                </span>
              </div>
              {isOwner && (
                <Link
                  href="/profile"
                  className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-bold"
                >
                  {t.profile.edit}
                </Link>
              )}
            </div>
            {profile.bio && (
              <div className="pt-3 border-t border-slate-200">
                <div className="text-sm text-slate-700 leading-relaxed">{profile.bio}</div>
              </div>
            )}
          </div>

          <div className="text-white text-center text-sm">
            {posts.length} {t.community.user_posts}
          </div>

          {posts.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-500">
              {t.community.no_posts}
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                user={currentUser}
                profile={profile}
                likedPosts={likedPosts}
                onLike={() => {}}
                onDelete={() => {}}
                onUpdate={() => {}}
                onRepost={() => {}}
              />
            ))
          )}

        </div>
      </div>
    </main>
  );
}