import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { tutorialService, quizService, type Tutorial, type Quiz, type QuizAnswer } from '../services/api';
import { BookOpen, Send, Loader2, Trophy, Clock, Trash2, CheckCircle, XCircle, FolderOpen } from 'lucide-react';

export const TutorialViewer: React.FC = () => {
    const [request, setRequest] = useState('');
    const [topic, setTopic] = useState('');
    const [projectPath, setProjectPath] = useState('');
    const [loading, setLoading] = useState(false);
    const [tutorial, setTutorial] = useState<Tutorial | null>(null);
    const [tutorials, setTutorials] = useState<Tutorial[]>([]);
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [quizLoading, setQuizLoading] = useState(false);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [submission, setSubmission] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [showPathDropdown, setShowPathDropdown] = useState(false);

    // Частые пути (можно кастомизировать)
    const commonPaths = [
        '',  // Пустой = использовать ../
        '/home/roman/projects/trainer/backend',
        '/home/roman/projects/trainer',
        '~/projects/trainer/backend',
        '../backend',
        '..',
    ];

    // Загружаем сохраненные пути
    const [recentPaths, setRecentPaths] = useState<string[]>(() => {
        const saved = localStorage.getItem('recentPaths');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        loadTutorials();
        // Загружаем последний использованный путь
        const savedPath = localStorage.getItem('projectPath');
        if (savedPath) {
            setProjectPath(savedPath);
        }
    }, []);

    const loadTutorials = async () => {
        try {
            const data = await tutorialService.list();
            setTutorials(data);
        } catch (err) {
            console.error('Failed to load tutorials:', err);
        }
    };

    // Выбор папки через File System Access API (Chrome, Edge)
    const handleSelectFolder = async () => {
        // Вместо сложного API, просто показываем/скрываем dropdown
        setShowPathDropdown(!showPathDropdown);
    };

    const selectPath = (path: string) => {
        setProjectPath(path);
        setShowPathDropdown(false);
        if (path) {
            localStorage.setItem('projectPath', path);
            // Добавляем в recent paths если его там нет
            if (!recentPaths.includes(path) && path !== '') {
                const updated = [path, ...recentPaths].slice(0, 5); // Храним последние 5
                setRecentPaths(updated);
                localStorage.setItem('recentPaths', JSON.stringify(updated));
            }
        }
    };

    const handleGenerate = async () => {
        if (!request.trim()) return;

        setLoading(true);
        setError(null);
        setTutorial(null);
        setQuiz(null);
        setSubmission(null);

        try {
            const codeContext = "// Code context from editor";
            const topicName = topic.trim() || 'General Programming';
            const data = await tutorialService.generate(request, topicName, codeContext, projectPath);
            setTutorial(data);
            await loadTutorials();

            // Сохраняем путь для следующего раза
            if (projectPath) {
                localStorage.setItem('projectPath', projectPath);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to generate tutorial');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateQuiz = async (difficulty: 'basic' | 'intermediate' | 'advanced' | 'expert') => {
        if (!tutorial) return;

        setQuizLoading(true);
        setError(null);
        setSubmission(null);
        setAnswers({});

        try {
            const data = await quizService.generate(tutorial.id, difficulty);
            setQuiz(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to generate quiz');
        } finally {
            setQuizLoading(false);
        }
    };

    const handleSubmitQuiz = async () => {
        if (!quiz) return;

        setQuizLoading(true);
        setError(null);

        try {
            const quizAnswers: QuizAnswer[] = Object.entries(answers).map(([qid, answer]) => ({
                question_id: parseInt(qid),
                answer,
            }));

            const result = await quizService.submit(quiz.id, quizAnswers);
            setSubmission(result);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to submit quiz');
        } finally {
            setQuizLoading(false);
        }
    };

    const handleDeleteTutorial = async (id: number) => {
        try {
            await tutorialService.delete(id);
            await loadTutorials();
            if (tutorial?.id === id) {
                setTutorial(null);
                setQuiz(null);
                setSubmission(null);
            }
        } catch (err) {
            console.error('Failed to delete tutorial:', err);
        }
    };

    const getMasteryColor = (score: number) => {
        if (score >= 0.8) return 'text-green-400';
        if (score >= 0.6) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Generator */}
            <div className="glass p-6 rounded-2xl space-y-4">
                <div className="flex gap-3">
                    <input
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        placeholder="Topic (e.g., Dependency Injection)"
                    />
                    <div className="flex gap-2 flex-1 relative">
                        <input
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                            value={projectPath}
                            onChange={e => setProjectPath(e.target.value)}
                            placeholder="Project path (optional) - click 📁 for common paths"
                        />
                        <button
                            onClick={handleSelectFolder}
                            className="bg-slate-800 hover:bg-slate-700 px-4 rounded-lg transition-all"
                            title="Show common paths"
                        >
                            <FolderOpen size={20} />
                        </button>

                        {/* Dropdown with common paths */}
                        {showPathDropdown && (
                            <div className="absolute top-full mt-2 right-0 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
                                <div className="p-2">
                                    <p className="text-xs text-slate-400 px-3 py-2 font-semibold">Common Paths</p>
                                    {commonPaths.map((path, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => selectPath(path)}
                                            className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded text-sm font-mono transition-all"
                                        >
                                            {path === '' ? '(empty - use parent directory)' : path}
                                        </button>
                                    ))}

                                    {recentPaths.length > 0 && (
                                        <>
                                            <div className="border-t border-slate-700 my-2"></div>
                                            <p className="text-xs text-slate-400 px-3 py-2 font-semibold">Recent</p>
                                            {recentPaths.map((path, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => selectPath(path)}
                                                    className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded text-sm font-mono transition-all"
                                                >
                                                    {path}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {projectPath && (
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>📁 {projectPath}</span>
                        <button
                            onClick={() => {
                                setProjectPath('');
                                localStorage.removeItem('projectPath');
                            }}
                            className="text-red-400 hover:text-red-300"
                        >
                            Clear
                        </button>
                    </div>
                )}

                <div className="flex gap-4">
                    <input
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        value={request}
                        onChange={e => setRequest(e.target.value)}
                        placeholder="What do you want to learn?"
                        onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                    />
                    <button
                        disabled={loading || !request.trim()}
                        onClick={handleGenerate}
                        className="bg-primary px-6 rounded-lg font-bold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                        Generate
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                        {error}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Tutorial History */}
                <div className="lg:col-span-1 glass rounded-2xl p-6 max-h-[600px] overflow-y-auto">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                        <Clock size={20} className="text-purple-400" />
                        Recent Tutorials
                    </h3>
                    <div className="space-y-2">
                        {tutorials.length === 0 ? (
                            <p className="text-slate-500 text-sm">No tutorials yet</p>
                        ) : (
                            tutorials.map(t => (
                                <div
                                    key={t.id}
                                    className={`p-3 rounded-lg cursor-pointer transition-all group ${tutorial?.id === t.id ? 'bg-purple-500/20 border border-purple-500' : 'hover:bg-slate-800'
                                        }`}
                                    onClick={() => setTutorial(t)}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate">{t.title}</p>
                                            <p className="text-xs text-slate-500 mt-1">{t.topic}</p>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteTutorial(t.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {tutorial && (
                        <>
                            {/* Tutorial Content */}
                            <div className="glass p-8 rounded-3xl">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3 text-purple-400">
                                        <BookOpen />
                                        <span className="text-sm font-semibold tracking-wider uppercase">
                                            {tutorial.topic}
                                        </span>
                                    </div>

                                    {!quiz && !submission && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleGenerateQuiz('basic')}
                                                disabled={quizLoading}
                                                className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30 transition-all disabled:opacity-50"
                                            >
                                                Easy Quiz
                                            </button>
                                            <button
                                                onClick={() => handleGenerateQuiz('intermediate')}
                                                disabled={quizLoading}
                                                className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm hover:bg-yellow-500/30 transition-all disabled:opacity-50"
                                            >
                                                Medium Quiz
                                            </button>
                                            <button
                                                onClick={() => handleGenerateQuiz('advanced')}
                                                disabled={quizLoading}
                                                className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-all disabled:opacity-50"
                                            >
                                                Hard Quiz
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <article className="prose prose-invert max-w-none prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800">
                                    <ReactMarkdown>{tutorial.content}</ReactMarkdown>
                                </article>
                            </div>

                            {/* Quiz */}
                            {quiz && !submission && (
                                <div className="glass p-8 rounded-3xl">
                                    <div className="flex items-center gap-3 mb-6 text-purple-400">
                                        <Trophy />
                                        <span className="text-sm font-semibold tracking-wider uppercase">
                                            Quiz: {quiz.title}
                                        </span>
                                    </div>

                                    <div className="space-y-6">
                                        {quiz.questions.map((q, idx) => (
                                            <div key={q.id} className="bg-slate-900/50 p-6 rounded-xl">
                                                <p className="font-semibold mb-4">
                                                    {idx + 1}. {q.question} ({q.points} pts)
                                                </p>

                                                {q.type === 'multiple_choice' && q.options && (
                                                    <div className="space-y-2">
                                                        {q.options.map((opt) => (
                                                            <label key={opt} className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-all">
                                                                <input
                                                                    type="radio"
                                                                    name={`q${q.id}`}
                                                                    value={opt}
                                                                    checked={answers[q.id] === opt}
                                                                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                                                                    className="text-purple-500"
                                                                />
                                                                <span>{opt}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}

                                                {q.type === 'true_false' && (
                                                    <div className="flex gap-4">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                name={`q${q.id}`}
                                                                value="true"
                                                                checked={answers[q.id] === 'true'}
                                                                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                                                            />
                                                            True
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                name={`q${q.id}`}
                                                                value="false"
                                                                checked={answers[q.id] === 'false'}
                                                                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                                                            />
                                                            False
                                                        </label>
                                                    </div>
                                                )}

                                                {(q.type === 'code_completion' || q.type === 'free_text') && (
                                                    <textarea
                                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 font-mono text-sm"
                                                        value={answers[q.id] || ''}
                                                        onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                                                        rows={4}
                                                        placeholder="Your answer..."
                                                    />
                                                )}
                                            </div>
                                        ))}

                                        <button
                                            onClick={handleSubmitQuiz}
                                            disabled={quizLoading || Object.keys(answers).length === 0}
                                            className="w-full bg-primary hover:opacity-90 font-bold py-4 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {quizLoading ? <Loader2 className="animate-spin" /> : <CheckCircle />}
                                            Submit Quiz
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Submission Result */}
                            {submission && (
                                <div className="glass p-8 rounded-3xl">
                                    <div className="text-center mb-6">
                                        <div className={`text-6xl font-bold mb-2 ${getMasteryColor(submission.score)}`}>
                                            {Math.round(submission.score * 100)}%
                                        </div>
                                        <p className="text-2xl font-semibold">
                                            {submission.passed ? (
                                                <span className="text-green-400 flex items-center justify-center gap-2">
                                                    <CheckCircle /> Passed!
                                                </span>
                                            ) : (
                                                <span className="text-red-400 flex items-center justify-center gap-2">
                                                    <XCircle /> Keep Learning
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    <div className="bg-slate-900/50 p-6 rounded-xl">
                                        <h4 className="font-bold mb-4">Feedback:</h4>
                                        <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">
                                            {submission.feedback}
                                        </pre>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setQuiz(null);
                                            setSubmission(null);
                                            setAnswers({});
                                        }}
                                        className="w-full mt-6 bg-slate-800 hover:bg-slate-700 font-bold py-3 rounded-lg transition-all"
                                    >
                                        Try Another Quiz
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};