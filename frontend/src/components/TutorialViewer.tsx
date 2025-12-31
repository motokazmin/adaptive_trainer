import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { tutorialService } from '../services/api';
import { BookOpen, Send, Loader2 } from 'lucide-react';

export const TutorialViewer: React.FC = () => {
    const [request, setRequest] = useState('');
    const [projectPath, setProjectPath] = useState('');
    const [loading, setLoading] = useState(false);
    const [tutorial, setTutorial] = useState<any>(null);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            // Mock code context for now, later can be fetched from active file
            const codeContext = "// Selected code context from editor";
            const data = await tutorialService.generate(request, codeContext, projectPath);
            setTutorial(data);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="flex flex-col gap-4">
                <div className="glass p-4 rounded-xl flex gap-3 items-center">
                    <span className="text-slate-400 text-sm font-mono shrink-0">Project Path:</span>
                    <input
                        className="flex-1 bg-transparent border-none focus:outline-none text-slate-300 placeholder-slate-600 font-mono text-sm"
                        value={projectPath}
                        onChange={e => setProjectPath(e.target.value)}
                        placeholder="/home/roman/projects/my-app (leave empty for default)"
                    />
                </div>

                <div className="glass p-6 rounded-2xl flex gap-4">
                    <input
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                        value={request}
                        onChange={e => setRequest(e.target.value)}
                        placeholder="What do you want to learn about your code?"
                        onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                    />
                    <button
                        disabled={loading || !request}
                        onClick={handleGenerate}
                        className="bg-primary px-6 rounded-lg font-bold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                        Generate
                    </button>
                </div>
            </div>

            {tutorial && (
                <div className="glass p-8 rounded-3xl animate-in fade-in slide-in-from-top-5 duration-500">
                    <div className="flex items-center gap-3 mb-6 text-purple-400">
                        <BookOpen />
                        <span className="text-sm font-semibold tracking-wider uppercase">New Tutorial</span>
                    </div>
                    <article className="prose prose-invert max-w-none prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800">
                        <ReactMarkdown>{tutorial.content}</ReactMarkdown>
                    </article>
                </div>
            )}
        </div>
    );
};
