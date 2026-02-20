'use client';

import { useState, useEffect } from 'react';

interface Comment {
    id: string;
    content: string;
    author_leaning: string;
    created_at: string;
}

export default function CommentSection({ variantId, sessionId, dict }: { variantId: string, sessionId: string, dict: Record<string, any> }) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [interactions, setInteractions] = useState<Record<string, 'like' | 'dislike'>>({});
    const [counters, setCounters] = useState<Record<string, { likes: number, dislikes: number }>>({});

    useEffect(() => {
        fetchComments();
    }, [variantId]);

    const fetchComments = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/comments?variant_id=${variantId}`);
            if (res.ok) {
                const { data } = await res.json();
                setComments(data || []);

                // Fetch counters for all comments
                if (data) {
                    data.forEach((c: Comment) => fetchCounters(c.id));
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCounters = async (commentId: string) => {
        try {
            const res = await fetch(`/api/comments/counters?comment_id=${commentId}`);
            if (res.ok) {
                const data = await res.json();
                setCounters(prev => ({ ...prev, [commentId]: data }));
            }
        } catch (err) {
            console.error("Failed to fetch comment counters", err);
        }
    };

    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            const res = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    variant_id: variantId,
                    content: newComment
                })
            });

            if (res.ok) {
                setNewComment('');
                fetchComments(); // Reload to get the new comment
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleInteract = async (commentId: string, type: 'like' | 'dislike') => {
        const currentInter = interactions[commentId];
        const newInter = currentInter === type ? 'remove_like_dislike' : type;

        try {
            await fetch('/api/comments/interact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    comment_id: commentId,
                    interaction_type: newInter
                })
            });

            setInteractions(prev => {
                const next = { ...prev };
                if (newInter === 'remove_like_dislike') delete next[commentId];
                else next[commentId] = type;
                return next;
            });

            // Re-fetch aggregate counters to reflect the new state immediately
            fetchCounters(commentId);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="mt-8 border-t border-gray-100 dark:border-gray-800 pt-6">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{dict.card.comments}</h4>

            <form onSubmit={handlePostComment} className="mb-6">
                <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={dict.card.writeComment}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20"
                />
                <div className="flex justify-end mt-2">
                    <button
                        type="submit"
                        disabled={!newComment.trim()}
                        className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {dict.card.submitComment}
                    </button>
                </div>
            </form>

            <div className="space-y-4">
                {loading ? (
                    <p className="text-gray-500 text-sm">{dict.card.loadingComments}</p>
                ) : comments.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">{dict.card.noComments}</p>
                ) : (
                    comments.map(comment => (
                        <div key={comment.id} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                    {dict.card.anonymous} • {new Date(comment.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <p className="text-gray-800 dark:text-gray-200 text-sm mb-3">
                                {comment.content}
                            </p>

                            <div className="flex gap-4 border-t border-gray-200 dark:border-gray-700 pt-3">
                                <button
                                    onClick={() => handleInteract(comment.id, 'like')}
                                    className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${interactions[comment.id] === 'like' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 hover:text-green-600 dark:hover:text-green-400'}`}
                                >
                                    <svg className="w-3.5 h-3.5" fill={interactions[comment.id] === 'like' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                                    <span>{dict.card.support}</span>
                                    {counters[comment.id]?.likes > 0 && <span className="opacity-70 ml-0.5">({counters[comment.id].likes})</span>}
                                </button>
                                <button
                                    onClick={() => handleInteract(comment.id, 'dislike')}
                                    className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${interactions[comment.id] === 'dislike' ? 'text-red-600 dark:text-red-400' : 'text-gray-500 hover:text-red-600 dark:hover:text-red-400'}`}
                                >
                                    <svg className="w-3.5 h-3.5" fill={interactions[comment.id] === 'dislike' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>
                                    <span>{dict.card.differ || "Difiero"}</span>
                                    {counters[comment.id]?.dislikes > 0 && <span className="opacity-70 ml-0.5">({counters[comment.id].dislikes})</span>}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
