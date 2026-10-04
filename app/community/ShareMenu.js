// app/community/ShareMenu.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/app/layout';
import { repost } from '@/lib/supabase-client';
import { LinkIcon, RepostIcon, MessageIcon, CheckIcon } from './Icons';

export default function ShareMenu({ post, user, onClose, onRepost }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [showRepost, setShowRepost] = useState(false);
  const [repostNote, setRepostNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/community?post=${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRepost = async () => {
    if (!user) return;
    setProcessing(true);
    try {
      const newPost = await repost(post.id, user.id, repostNote.trim());
      newPost.author = { id: user.id, name: 'أنت', avatar_initial: 'U' };
      onRepost(newPost);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDM = () => {
    router.push(`/messages/${post.author_id}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="text-center font-bold text-lg mb-4">مشاركة</div>

        {!showRepost ? (
          <div className="space-y-2">
            <button
              onClick={handleCopyLink}
              className="w-full bg-slate-100 hover:bg-slate-200 p-3 rounded-xl text-right flex items-center gap-3 transition"
            >
              {copied ? <CheckIcon size={22} className="text-green-600" /> : <LinkIcon size={22} />}
              <span className="font-medium">{copied ? 'تم النسخ!' : 'نسخ الرابط'}</span>
            </button>

            <button
              onClick={() => setShowRepost(true)}
              className="w-full bg-slate-100 hover:bg-slate-200 p-3 rounded-xl text-right flex items-center gap-3 transition"
            >
              <RepostIcon size={22} />
              <span className="font-medium">إعادة نشر</span>
            </button>

            {post.author_id !== user?.id && (
              <button
                onClick={handleDM}
                className="w-full bg-slate-100 hover:bg-slate-200 p-3 rounded-xl text-right flex items-center gap-3 transition"
              >
                <MessageIcon size={22} />
                <span className="font-medium">إرسال في رسالة</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full bg-slate-200 hover:bg-slate-300 p-3 rounded-xl font-bold transition mt-2"
            >
              إلغاء
            </button>
          </div>
        ) : (
          <div>
            <textarea
              value={repostNote}
              onChange={(e) => setRepostNote(e.target.value)}
              placeholder="أضف تعليقاً (اختياري)..."
              rows={3}
              className="w-full p-3 border rounded-xl resize-none text-sm"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setShowRepost(false)}
                className="flex-1 bg-slate-200 p-2 rounded-lg font-bold"
              >
                رجوع
              </button>
              <button
                onClick={handleRepost}
                disabled={processing}
                className="flex-1 bg-teal-600 text-white p-2 rounded-lg font-bold disabled:opacity-50"
              >
                {processing ? '...' : 'نشر'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}