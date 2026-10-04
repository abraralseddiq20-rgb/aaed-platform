// app/community/PostCard.js
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/app/layout';
import { toggleLike, getComments, addComment, deletePost, updatePost } from '@/lib/supabase-client';
import { HeartIcon, CommentIcon, ShareIcon, EditIcon, TrashIcon, GlobeIcon } from './Icons';
import Comment from './Comment';
import ShareMenu from './ShareMenu';

export default function PostCard({ post, user, profile, likedPosts, onLike, onDelete, onUpdate, onRepost }) {
  const { lang, t } = useLanguage();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content);
  const [showOriginal, setShowOriginal] = useState(false);

  const isOwner = user?.id === post.author_id;
  const isLiked = likedPosts?.has(post.id);

  const getDisplayContent = () => {
    if (showOriginal) return post.content;
    if (post.language === lang) return post.content;
    return post.translations?.[lang] || post.content;
  };

  const hasTranslation = post.language !== lang && post.translations?.[lang];

  useEffect(() => {
    if (showComments && comments.length === 0) {
      loadComments();
    }
  }, [showComments]);

  const loadComments = async () => {
    try {
      const data = await getComments(post.id);
      setComments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLike = async () => {
    if (!user) return;
    try {
      const result = await toggleLike(post.id, user.id);
      onLike(post.id, result.liked);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !user) return;
    try {
      const c = await addComment(post.id, user.id, commentText.trim(), lang);
      c.author = { id: user.id, name: 'أنت', avatar_initial: 'U' };
      setComments([...comments, c]);
      setCommentText('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteComment = (commentId) => {
    setComments(comments.filter((c) => c.id !== commentId && c.parent_comment_id !== commentId));
  };

  const handleUpdateComment = (updated) => {
    setComments(comments.map((c) => c.id === updated.id ? { ...c, content: updated.content } : c));
  };

  const handleDeletePost = async () => {
    if (!confirm(t.community.confirm_delete)) return;
    try {
      await deletePost(post.id, user.id);
      onDelete(post.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePost = async () => {
    if (!editText.trim()) return;
    try {
      const updated = await updatePost(post.id, user.id, { content: editText.trim() });
      onUpdate({ ...post, content: updated.content });
      setEditing(false);
    } catch (err) {
      console.error(err);
    }
  };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    const ta = t.community.time_ago || {};
    if (mins < 1) return ta.now || 'now';
    if (mins < 60) return `${mins}${ta.min || 'm'}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}${ta.hour || 'h'}`;
    return `${Math.floor(hours / 24)}${ta.day || 'd'}`;
  };

  const rootComments = comments.filter((c) => !c.parent_comment_id);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-lg">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold flex-shrink-0">
          {post.author?.avatar_initial || 'U'}
        </div>
        <div className="flex-1">
          <Link
            href={`/profile/${post.author_id}`}
            className="font-bold text-slate-800 text-sm hover:text-teal-600 transition"
          >
            {post.author?.name || 'User'}
          </Link>
          <div className="text-xs text-slate-500 flex gap-2 flex-wrap">
            {post.author?.country && <span>{post.author.country}</span>}
            <span>·</span>
            <span>{timeAgo(post.created_at)}</span>
            {post.reposted_from_id && (
              <>
                <span>·</span>
                <span>{t.community.repost}</span>
              </>
            )}
          </div>
        </div>
        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-xs">
          {t.community.categories[post.category] || post.category}
        </span>
        {isOwner && !editing && (
          <div className="flex gap-2 text-slate-400">
            <button onClick={() => setEditing(true)} className="hover:text-teal-600 transition" title={t.community.edit}>
              <EditIcon size={16} />
            </button>
            <button onClick={handleDeletePost} className="hover:text-red-500 transition" title={t.community.delete}>
              <TrashIcon size={16} />
            </button>
          </div>
        )}
      </div>

      {!editing ? (
        <div className="mb-2">
          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
            {getDisplayContent()}
          </p>
          {hasTranslation && (
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className="text-xs text-teal-600 hover:underline mt-1 flex items-center gap-1"
            >
              <GlobeIcon size={12} />
              <span>{showOriginal ? t.community.show_translation : t.community.show_original}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="mb-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="w-full p-2 border rounded-lg resize-none text-sm text-slate-800"
          />
          <div className="flex gap-2 mt-1">
            <button onClick={handleUpdatePost} className="text-xs bg-teal-600 text-white px-3 py-1 rounded font-bold">
              {t.community.save}
            </button>
            <button onClick={() => { setEditing(false); setEditText(post.content); }} className="text-xs bg-slate-200 px-3 py-1 rounded">
              {t.community.cancel}
            </button>
          </div>
        </div>
      )}

      {post.media_url && (
        <div className="mt-2 rounded-xl overflow-hidden">
          {post.media_type === 'image' ? (
            <img src={post.media_url} alt="Post" className="w-full max-h-96 object-cover" loading="lazy" />
          ) : post.media_type === 'video' ? (
            <video src={post.media_url} controls className="w-full max-h-96" />
          ) : null}
        </div>
      )}

      <div className="flex gap-4 pt-3 mt-3 border-t border-slate-100">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1 text-sm transition ${
            isLiked ? 'text-red-500 font-bold' : 'text-slate-500 hover:text-red-500'
          }`}
        >
          <HeartIcon filled={isLiked} size={18} />
          <span>{post.likes_count || 0}</span>
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-teal-600 transition"
        >
          <CommentIcon size={18} />
          <span>{post.comments_count || 0}</span>
        </button>
        <button
          onClick={() => setShowShare(true)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-teal-600 transition"
        >
          <ShareIcon size={18} />
          <span>{t.community.share}</span>
        </button>
      </div>

      {showComments && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          {rootComments.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-2">
              {t.community.no_comments}
            </p>
          ) : (
            <div>
              {rootComments.map((c) => (
                <Comment
                  key={c.id}
                  comment={c}
                  user={user}
                  onReply={(newReply) => setComments([...comments, newReply])}
                  onDelete={handleDeleteComment}
                  onUpdate={handleUpdateComment}
                  allComments={comments}
                />
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t.community.write_comment}
              className="flex-1 p-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-teal-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
            />
            <button
              onClick={handleAddComment}
              className="bg-teal-600 hover:bg-teal-700 text-white px-3 rounded-lg text-sm font-bold transition"
            >
              {t.community.send}
            </button>
          </div>
        </div>
      )}

      {showShare && (
        <ShareMenu
          post={post}
          user={user}
          onClose={() => setShowShare(false)}
          onRepost={(newPost) => {
            onRepost(newPost);
            setShowShare(false);
          }}
        />
      )}
    </div>
  );
}