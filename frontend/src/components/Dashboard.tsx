import React, { useState, useEffect } from 'react';
import { progressService, type Progress, type ProgressStats } from '../services/api';
import {
    TrendingUp,
    Target,
    Clock,
    Award,
    BarChart3,
    Flame,
    Brain,
    Zap
} from 'lucide-react';

export const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<ProgressStats | null>(null);
    const [progress, setProgress] = useState<Progress[]>([]);
    const [weakTopics, setWeakTopics] = useState<Progress[]>([]);
    const [reviewTopics, setReviewTopics] = useState<Progress[]>([]);
    const [learningPath, setLearningPath] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        setLoading(true);
        try {
            const [statsData, progressData, weakData, reviewData, pathData] = await Promise.all([
                progressService.getStats(),
                progressService.getAll(),
                progressService.getWeak(),
                progressService.getReview(),
                progressService.getLearningPath(),
            ]);

            setStats(statsData);
            setProgress(progressData);
            setWeakTopics(weakData);
            setReviewTopics(reviewData);
            setLearningPath(pathData.path);
        } catch (err) {
            console.error('Failed to load dashboard:', err);
        } finally {
            setLoading(false);
        }
    };

    const getMasteryColor = (score: number) => {
        if (score >= 0.8) return 'text-green-400 bg-green-500/20';
        if (score >= 0.6) return 'text-yellow-400 bg-yellow-500/20';
        if (score >= 0.3) return 'text-orange-400 bg-orange-500/20';
        return 'text-red-400 bg-red-500/20';
    };

    const getMasteryLabel = (score: number) => {
        if (score >= 0.8) return 'Expert';
        if (score >= 0.6) return 'Advanced';
        if (score >= 0.3) return 'Intermediate';
        return 'Beginner';
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-pulse text-slate-400">Loading dashboard...</div>
            </div>
        );
    }

    if (!stats || progress.length === 0) {
        return (
            <div className="glass p-12 rounded-3xl text-center">
                <Brain size={64} className="mx-auto mb-4 text-slate-600" />
                <h3 className="text-2xl font-bold mb-2">No Progress Yet</h3>
                <p className="text-slate-400">
                    Complete a few tutorials and quizzes to see your progress here!
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2">
                        <BarChart3 className="text-purple-400" size={24} />
                        <span className="text-slate-400 text-sm">Total Topics</span>
                    </div>
                    <p className="text-3xl font-bold">{stats.total_topics}</p>
                </div>

                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2">
                        <Award className="text-green-400" size={24} />
                        <span className="text-slate-400 text-sm">Mastered</span>
                    </div>
                    <p className="text-3xl font-bold text-green-400">{stats.mastered_topics}</p>
                </div>

                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="text-yellow-400" size={24} />
                        <span className="text-slate-400 text-sm">Avg. Mastery</span>
                    </div>
                    <p className="text-3xl font-bold text-yellow-400">
                        {Math.round(stats.average_mastery * 100)}%
                    </p>
                </div>

                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2">
                        <Clock className="text-orange-400" size={24} />
                        <span className="text-slate-400 text-sm">Need Review</span>
                    </div>
                    <p className="text-3xl font-bold text-orange-400">{stats.topics_needing_review}</p>
                </div>
            </div>

            {/* Learning Path */}
            {learningPath.length > 0 && (
                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-4">
                        <Target className="text-purple-400" size={24} />
                        <h3 className="text-xl font-bold">Recommended Learning Path</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {learningPath.map((topic, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-purple-500/20 px-4 py-2 rounded-lg">
                                <span className="text-purple-400 font-bold">{idx + 1}</span>
                                <span>{topic}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-slate-400 text-sm mt-4">
                        These topics need your attention based on review schedule and mastery level.
                    </p>
                </div>
            )}

            {/* Topics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* All Progress */}
                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-4">
                        <Flame className="text-orange-400" size={24} />
                        <h3 className="text-xl font-bold">All Topics</h3>
                    </div>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {progress.map(p => (
                            <div key={p.id} className="bg-slate-900/50 p-4 rounded-xl">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold">{p.topic}</span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getMasteryColor(p.mastery_score)}`}>
                                        {getMasteryLabel(p.mastery_score)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-slate-400">
                                    <span>{Math.round(p.mastery_score * 100)}% mastery</span>
                                    <span>Next review in {p.interval_days} days</span>
                                </div>
                                <div className="mt-2 bg-slate-800 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                                        style={{ width: `${p.mastery_score * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Weak Topics + Review */}
                <div className="space-y-6">
                    {/* Topics Needing Review */}
                    {reviewTopics.length > 0 && (
                        <div className="glass p-6 rounded-2xl">
                            <div className="flex items-center gap-3 mb-4">
                                <Clock className="text-orange-400" size={24} />
                                <h3 className="text-xl font-bold">Time to Review</h3>
                            </div>
                            <div className="space-y-2">
                                {reviewTopics.map(p => (
                                    <div key={p.id} className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold">{p.topic}</span>
                                            <span className="text-xs text-slate-400">
                                                {formatDate(p.last_reviewed)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Mastery: {Math.round(p.mastery_score * 100)}%
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Weak Topics */}
                    {weakTopics.length > 0 && (
                        <div className="glass p-6 rounded-2xl">
                            <div className="flex items-center gap-3 mb-4">
                                <Zap className="text-red-400" size={24} />
                                <h3 className="text-xl font-bold">Need Practice</h3>
                            </div>
                            <div className="space-y-2">
                                {weakTopics.map(p => (
                                    <div key={p.id} className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold">{p.topic}</span>
                                            <span className="text-red-400 text-sm font-bold">
                                                {Math.round(p.mastery_score * 100)}%
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Focus on this to improve your mastery
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Mastery Distribution */}
            <div className="glass p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <BarChart3 className="text-purple-400" size={24} />
                    <h3 className="text-xl font-bold">Skill Distribution</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-green-500/10 rounded-xl">
                        <p className="text-3xl font-bold text-green-400">{stats.mastered_topics}</p>
                        <p className="text-slate-400 text-sm mt-1">Expert</p>
                        <p className="text-xs text-slate-500 mt-1">80%+ mastery</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-500/10 rounded-xl">
                        <p className="text-3xl font-bold text-yellow-400">{stats.intermediate_topics}</p>
                        <p className="text-slate-400 text-sm mt-1">Advanced</p>
                        <p className="text-xs text-slate-500 mt-1">50-80% mastery</p>
                    </div>
                    <div className="text-center p-4 bg-orange-500/10 rounded-xl">
                        <p className="text-3xl font-bold text-orange-400">{stats.beginner_topics}</p>
                        <p className="text-slate-400 text-sm mt-1">Learning</p>
                        <p className="text-xs text-slate-500 mt-1">0-50% mastery</p>
                    </div>
                    <div className="text-center p-4 bg-purple-500/10 rounded-xl">
                        <p className="text-3xl font-bold text-purple-400">{stats.total_topics}</p>
                        <p className="text-slate-400 text-sm mt-1">Total</p>
                        <p className="text-xs text-slate-500 mt-1">All topics</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
