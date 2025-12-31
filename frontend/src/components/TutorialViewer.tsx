import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { tutorialService, quizService, type Tutorial, type Quiz, type QuizAnswer } from '../services/api';
import { useToast } from './Toast';
import { styles, cn } from '../styles';
import { BookOpen, Send, Loader2, Trophy, Clock, Trash2, CheckCircle, XCircle, FolderOpen } from 'lucide-react';

export const TutorialViewer: React.FC = () => {
    const toast = useToast();

    // State
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

    // Частые пути
    const commonPaths = ['', '/home/roman/projects/trainer/backend', '/home/roman/projects/trainer', '~/projects/trainer/backend', '../backend', '..'];
    const [recentPaths, setRecentPaths] = useState<string[]>(() => {
        const saved = localStorage.getItem('recentPaths');
        return saved ? JSON.parse(saved) : [];
    });

    // Effects
    useEffect(() => {
        loadTutorials();
        const savedPath = localStorage.getItem('projectPath');
        if (savedPath) setProjectPath(savedPath);
        const savedTutorialId = localStorage.getItem('currentTutorialId');
        if (savedTutorialId) loadTutorialById(parseInt(savedTutorialId));
    }, []);

    // API handlers
    const loadTutorials = async () => {
        try {
            const data = await tutorialService.list();
            setTutorials(data);
        } catch (err) {
            console.error('Failed to load tutorials:', err);
        }
    };

    const loadTutorialById = async (id: number) => {
        try {
            const data = await tutorialService.get(id);
            setTutorial(data);
        } catch (err) {
            console.error('Failed to load tutorial:', err);
        }
    };

    const selectTutorial = (t: Tutorial) => {
        setTutorial(t);
        localStorage.setItem('currentTutorialId', t.id.toString());
    };

    const selectPath = (path: string) => {
        setProjectPath(path);
        setShowPathDropdown(false);
        if (path) {
            localStorage.setItem('projectPath', path);
            if (!recentPaths.includes(path) && path !== '') {
                const updated = [path, ...recentPaths].slice(0, 5);
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
            localStorage.setItem('currentTutorialId', data.id.toString());
            await loadTutorials();
            toast.success(`✓ Туториал создан: ${data.topic}`);
            if (projectPath) localStorage.setItem('projectPath', projectPath);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка генерации');
            toast.error('Ошибка генерации туториала');
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
            toast.success(`✓ Квиз создан: уровень ${difficulty}`);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка генерации квиза');
            toast.error('Ошибка генерации квиза');
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
            const scorePercent = Math.round(result.score * 100);
            if (result.passed) {
                toast.success(`🎉 Квиз пройден! Результат: ${scorePercent}%`);
            } else {
                toast.warning(`Продолжайте учиться! Результат: ${scorePercent}%`);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка отправки');
            toast.error('Ошибка отправки квиза');
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
            toast.success('Туториал удален');
        } catch (err) {
            console.error('Failed to delete tutorial:', err);
            toast.error('Ошибка удаления');
        }
    };

    const getMasteryColor = (score: number) => {
        if (score >= 0.8) return 'text-green-400';
        if (score >= 0.6) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className={styles.layout.content}>
            {/* Форма генерации */}
            <GeneratorForm
                topic={topic}
                setTopic={setTopic}
                projectPath={projectPath}
                setProjectPath={setProjectPath}
                request={request}
                setRequest={setRequest}
                loading={loading}
                error={error}
                showPathDropdown={showPathDropdown}
                setShowPathDropdown={setShowPathDropdown}
                commonPaths={commonPaths}
                recentPaths={recentPaths}
                selectPath={selectPath}
                handleGenerate={handleGenerate}
            />

            {/* Сетка: История + Контент */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <TutorialHistory
                    tutorials={tutorials}
                    currentId={tutorial?.id}
                    onSelect={selectTutorial}
                    onDelete={handleDeleteTutorial}
                />

                <div className="lg:col-span-2 space-y-6">
                    {tutorial && (
                        <>
                            <TutorialContent
                                tutorial={tutorial}
                                quiz={quiz}
                                submission={submission}
                                onGenerateQuiz={handleGenerateQuiz}
                                quizLoading={quizLoading}
                            />

                            {quiz && !submission && (
                                <QuizForm
                                    quiz={quiz}
                                    answers={answers}
                                    onAnswerChange={setAnswers}
                                    onSubmit={handleSubmitQuiz}
                                    loading={quizLoading}
                                />
                            )}

                            {submission && (
                                <QuizResult
                                    submission={submission}
                                    getMasteryColor={getMasteryColor}
                                    onReset={() => {
                                        setQuiz(null);
                                        setSubmission(null);
                                        setAnswers({});
                                    }}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// === Подкомпоненты ===

const GeneratorForm: React.FC<any> = ({
    topic, setTopic, projectPath, setProjectPath, request, setRequest,
    loading, error, showPathDropdown, setShowPathDropdown,
    commonPaths, recentPaths, selectPath, handleGenerate
}) => (
    <div className={styles.card}>
        <div className="space-y-4">
            <div className="flex gap-3">
                <input
                    className={styles.input}
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="Тема (например, Goroutines)"
                />

                <div className="flex gap-2 flex-1 relative">
                    <input
                        className={cn(styles.inputSmall, "flex-1")}
                        value={projectPath}
                        onChange={e => setProjectPath(e.target.value)}
                        placeholder="Путь к проекту"
                    />
                    <button
                        onClick={() => setShowPathDropdown(!showPathDropdown)}
                        className={styles.button.icon}
                    >
                        <FolderOpen size={20} />
                    </button>

                    {showPathDropdown && (
                        <PathDropdown
                            commonPaths={commonPaths}
                            recentPaths={recentPaths}
                            selectPath={selectPath}
                        />
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
                        Очистить
                    </button>
                </div>
            )}

            <div className="flex gap-4">
                <input
                    className={cn(styles.input, "flex-1")}
                    value={request}
                    onChange={e => setRequest(e.target.value)}
                    placeholder="Что вы хотите изучить?"
                    onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                />
                <button
                    disabled={loading || !request.trim()}
                    onClick={handleGenerate}
                    className={cn(styles.button.primary, "flex items-center gap-2")}
                >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                    Генерировать
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                    {error}
                </div>
            )}
        </div>
    </div>
);

const PathDropdown: React.FC<any> = ({ commonPaths, recentPaths, selectPath }) => (
    <div className="absolute top-full mt-2 right-0 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
        <div className="p-2">
            <p className={cn(styles.text.small, "px-3 py-2 font-semibold")}>Частые пути</p>
            {commonPaths.map((path: string, idx: number) => (
                <button
                    key={idx}
                    onClick={() => selectPath(path)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded text-sm font-mono transition-all"
                >
                    {path === '' ? '(пусто)' : path}
                </button>
            ))}

            {recentPaths.length > 0 && (
                <>
                    <div className="border-t border-slate-700 my-2" />
                    <p className={cn(styles.text.small, "px-3 py-2 font-semibold")}>Недавние</p>
                    {recentPaths.map((path: string, idx: number) => (
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
);

const TutorialHistory: React.FC<{
    tutorials: Tutorial[];
    currentId?: number;
    onSelect: (t: Tutorial) => void;
    onDelete: (id: number) => void;
}> = ({ tutorials, currentId, onSelect, onDelete }) => (
    <div className={cn(styles.card, "max-h-[600px] overflow-y-auto")}>
        <h3 className={cn(styles.heading.h3, "mb-4 flex items-center gap-2")}>
            <Clock size={20} className="text-purple-400" />
            Недавние туториалы
        </h3>
        <div className="space-y-2">
            {tutorials.length === 0 ? (
                <p className={styles.text.muted}>Пока нет туториалов</p>
            ) : (
                tutorials.map(t => (
                    <div
                        key={t.id}
                        className={cn(
                            styles.list.item,
                            currentId === t.id ? styles.list.active : styles.list.hover
                        )}
                        onClick={() => onSelect(t)}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">{t.title}</p>
                                <p className={cn(styles.text.small, "mt-1")}>{t.topic}</p>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(t.id);
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
);

const TutorialContent: React.FC<any> = ({ tutorial, quiz, submission, onGenerateQuiz, quizLoading }) => (
    <div className={styles.cardLarge}>
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3 text-purple-400">
                <BookOpen />
                <span className="text-sm font-semibold tracking-wider uppercase">{tutorial.topic}</span>
            </div>

            {!quiz && !submission && (
                <div className="flex gap-2">
                    {[
                        { diff: 'basic', label: 'Легкий', color: 'green' },
                        { diff: 'intermediate', label: 'Средний', color: 'yellow' },
                        { diff: 'advanced', label: 'Сложный', color: 'red' }
                    ].map(({ diff, label, color }) => (
                        <button
                            key={diff}
                            onClick={() => onGenerateQuiz(diff)}
                            disabled={quizLoading}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50",
                                `bg-${color}-500/20 text-${color}-400 hover:bg-${color}-500/30`
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}
        </div>

        <article className="prose prose-invert max-w-none prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800">
            <ReactMarkdown>{tutorial.content}</ReactMarkdown>
        </article>
    </div>
);

const QuizForm: React.FC<any> = ({ quiz, answers, onAnswerChange, onSubmit, loading }) => (
    <div className={styles.cardLarge}>
        <div className="flex items-center gap-3 mb-6 text-purple-400">
            <Trophy />
            <span className="text-sm font-semibold tracking-wider uppercase">Квиз: {quiz.title}</span>
        </div>

        <div className="space-y-6">
            {quiz.questions.map((q: any, idx: number) => (
                <div key={q.id} className={styles.quiz.question}>
                    <p className="font-semibold mb-4">{idx + 1}. {q.question} ({q.points} баллов)</p>

                    {q.type === 'multiple_choice' && q.options && (
                        <div className="space-y-2">
                            {q.options.map((opt: string) => (
                                <label key={opt} className={styles.quiz.option}>
                                    <input
                                        type="radio"
                                        name={`q${q.id}`}
                                        value={opt}
                                        checked={answers[q.id] === opt}
                                        onChange={(e) => onAnswerChange({ ...answers, [q.id]: e.target.value })}
                                    />
                                    <span>{opt}</span>
                                </label>
                            ))}
                        </div>
                    )}

                    {q.type === 'true_false' && (
                        <div className="flex gap-4">
                            {['true', 'false'].map((val) => (
                                <label key={val} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name={`q${q.id}`}
                                        value={val}
                                        checked={answers[q.id] === val}
                                        onChange={(e) => onAnswerChange({ ...answers, [q.id]: e.target.value })}
                                    />
                                    {val === 'true' ? 'Правда' : 'Ложь'}
                                </label>
                            ))}
                        </div>
                    )}

                    {(q.type === 'code_completion' || q.type === 'free_text') && (
                        <textarea
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 font-mono text-sm"
                            value={answers[q.id] || ''}
                            onChange={(e) => onAnswerChange({ ...answers, [q.id]: e.target.value })}
                            rows={4}
                            placeholder="Ваш ответ..."
                        />
                    )}
                </div>
            ))}

            <button
                onClick={onSubmit}
                disabled={loading || Object.keys(answers).length === 0}
                className={cn(styles.button.primary, "w-full py-4 flex items-center justify-center gap-2")}
            >
                {loading ? <Loader2 className="animate-spin" /> : <CheckCircle />}
                Отправить квиз
            </button>
        </div>
    </div>
);

const QuizResult: React.FC<any> = ({ submission, getMasteryColor, onReset }) => (
    <div className={styles.cardLarge}>
        <div className="text-center mb-6">
            <div className={cn("text-6xl font-bold mb-2", getMasteryColor(submission.score))}>
                {Math.round(submission.score * 100)}%
            </div>
            <p className="text-2xl font-semibold">
                {submission.passed ? (
                    <span className="text-green-400 flex items-center justify-center gap-2">
                        <CheckCircle /> Пройдено!
                    </span>
                ) : (
                    <span className="text-red-400 flex items-center justify-center gap-2">
                        <XCircle /> Продолжайте учиться
                    </span>
                )}
            </p>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-xl">
            <h4 className="font-bold mb-4">Обратная связь:</h4>
            <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">
                {submission.feedback}
            </pre>
        </div>

        <button
            onClick={onReset}
            className={cn(styles.button.secondary, "w-full mt-6")}
        >
            Попробовать другой квиз
        </button>
    </div>
);