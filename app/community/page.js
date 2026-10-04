// app/community/page.js
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/app/layout';
import { supabase, getPosts, getUserLikes } from '@/lib/supabase-client';
import PostEditor from './PostEditor';
import PostCard from './PostCard';

export default function CommunityPage() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [likedPosts, setLikedPosts] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const isRTL = lang === 'ar' || lang === 'ur';

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }
        setUser(user);

        const { data: prof } = await supabase
          .from('profiles').select('*').eq('id', user.id).single();
        setProfile(prof);

        const [postsData, likesData] = await Promise.all([
          getPosts(30),
          getUserLikes(user.id),
        ]);
        setPosts(postsData);
        setLikedPosts(likesData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  const handleNewPost = (post) => setPosts([post, ...posts]);
  const handleDeletePost = (postId) => setPosts(posts.filter((p) => p.id !== postId));
  const handleUpdatePost = (updated) => setPosts(posts.map((p) => p.id === updated.id ? updated : p));
  const handleRepost = (newPost) => setPosts([newPost, ...posts]);

  const handleLike = (postId, liked) => {
    const newLiked = new Set(likedPosts);
    if (liked) newLiked.add(postId);
    else newLiked.delete(postId);
    setLikedPosts(newLiked);
    setPosts(posts.map((p) =>
      p.id === postId
        ? { ...p, likes_count: liked ? (p.likes_count || 0) + 1 : Math.max(0, (p.likes_count || 0) - 1) }
        : p
    ));
  };

  const filteredPosts = categoryFilter === 'all'
    ? posts
    : posts.filter((p) => p.category === categoryFilter);

  if (loading) {
    return (
      <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center">
        <div className="text-white text-xl">{t.community.loading}</div>
      </main>
    );
  }

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex flex-col">
      <header className="bg-teal-900 text-white p-4 flex items-center justify-between shadow-lg">
        <Link href="/" className="text-2xl">→</Link>
        <div className="text-xl font-bold">
          {t.community.title} <span className="text-amber-400">| Community</span>
        </div>
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
          <p className="text-white/80 text-center text-sm">{t.community.subtitle}</p>

          <PostEditor user={user} profile={profile} onPost={handleNewPost} />

          <div className="flex gap-2 overflow-x-auto pb-2">
            {['all', 'general', 'question', 'experience', 'support', 'advice'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  categoryFilter === cat
                    ? 'bg-amber-400 text-slate-900'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {t.community.categories[cat]}
              </button>
            ))}
          </div>

          {filteredPosts.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-500">
              {t.community.no_posts}
            </div>
          ) : (
            filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                user={user}
                profile={profile}
                likedPosts={likedPosts}
                onLike={handleLike}
                onDelete={handleDeletePost}
                onUpdate={handleUpdatePost}
                onRepost={handleRepost}
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}