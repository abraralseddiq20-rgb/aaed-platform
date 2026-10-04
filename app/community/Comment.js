// app/community/Comment.js
'use client';

import { useState } from 'react';
import { useLanguage } from '@/app/layout';
import { toggleCommentLike, addComment, deleteComment, updateComment } from '@/lib/supabase-client';
import { HeartIcon, CommentIcon, EditIcon, TrashIcon } from './Icons';

export default function Comment({ comment, user, onReply, onDelete, onUpdate, isReply = false, allComments = [] }) {
  const { lang, t } = useLanguage();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(comment.likes_count || 0);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [sending, setSending] = useState(false);

  const isOwner = user?.id === comment.author_id;

  const getDisplayContent = () => {
    if (comment.language === lang) return comment.content;
    return comment.translations?.[lang] || comment.content;
  };

  const handleLike = async () => {
    if (!user) return;
    try {
      const result = await toggleCommentLike(comment.id, user.id);
      setLiked(result.liked);
      setLikesCount(result.liked ? likesCount + 1 : Math.max(0, likesCount - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !user) return;
    setSending(true);
    try {
      const newReply = await addComment(comment.post_id, user.id, replyText.trim(), lang, comment.id);
      newReply.author = { id: user.id, name: 'أنت', avatar_initial: 'U' };
      onReply(newReply);
      setReplyText('');
      setShowReply(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleUpdate = async () => {
    if (!editText.trim()) return;
    try {
      const updated = await updateComment(comment.id, user.id, editText.trim());
      onUpdate(updated);
      setEditing(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('حذف التعليق؟')) return;
    try {
      await deleteComment(comment.id, user.id);
      onDelete(comment.id);
    } catch (err) {
      console.error(err);
    }
  };

  const replies = allComments.filter((c) => c.parent_comment_id === comment.id);

  return (
    <div style={isReply ? { paddingRight: '2rem', paddingTop: '0.5rem' } : { paddingTop: '0.75rem' }}>
      <div className="flex gap-2">
        <div className="w-7 h-7 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
          {comment.author?.avatar_initial || 'U'}
        </div>
        <div className="flex-1">
          {!editing ? (
            <div className="bg-slate-50 rounded-lg p-2">
              <div className="text-xs font-bold text-slate-700">
                {comment.author?.name || 'User'}
              </div>
              <div className="text-xs text-slate-600 mt-1">{getDisplayContent()}</div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg p-2">
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full p-1 border rounded text-xs"
                onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
              />
              <div className="flex gap-1 mt-1">
                <button onClick={handleUpdate} className="text-xs text-teal-600 font-bold">حفظ</button>
                <button onClick={() => setEditing(false)} className="text-xs text-slate-500">إلغاء</button>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-1 items-center text-xs text-slate-500">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 transition ${liked ? 'text-red-500 font-bold' : 'hover:text-red-500'}`}
            >
              <HeartIcon filled={liked} size={14} />
              <span>{likesCount}</span>
            </button>
            <button
              onClick={() => setShowReply(!showReply)}
              className="flex items-center gap-1 hover:text-teal-600 transition"
            >
              <CommentIcon size={14} />
              <span>{t.community.reply || 'رد'}</span>
            </button>
            {isOwner && !editing && (
              <>
                <button onClick={() => setEditing(true)} className="hover:text-teal-600 transition">
                  <EditIcon size={14} />
                </button>
                <button onClick={handleDelete} className="hover:text-red-500 transition">
                  <TrashIcon size={14} />
                </button>
              </>
            )}
          </div>

          {showReply && (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={t.community.write_comment}
                className="flex-1 p-1 border rounded text-xs"
                onKeyDown={(e) => e.key === 'Enter' && handleReply()}
              />
              <button
                onClick={handleReply}
                disabled={sending}
                className="text-xs bg-teal-600 text-white px-2 rounded"
              >
                {sending ? '...' : t.community.send}
              </button>
            </div>
          )}

          {replies.map((r) => (
            <Comment
              key={r.id}
              comment={r}
              user={user}
              onReply={onReply}
              onDelete={onDelete}
              onUpdate={onUpdate}
              isReply={true}
              allComments={allComments}
            />
          ))}
        </div>
      </div>
    </div>
  );
}