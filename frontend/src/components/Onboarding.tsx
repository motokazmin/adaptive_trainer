import React, { useState } from 'react';
import { profileService } from '../services/api';
import { User, Target, Briefcase } from 'lucide-react';

interface OnboardingProps {
    onComplete: (profile: any) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [profile, setProfile] = useState({
        name: '',
        background: '',
        goals: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const updated = await profileService.update(profile);
        onComplete(updated);
    };

    return (
        <div className="max-w-md mx-auto mt-20 p-8 glass rounded-2xl animate-in fade-in slide-in-from-bottom-5 duration-700">
            <h1 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                Welcome to Coding Tutor
            </h1>
            <p className="text-slate-400 mb-8 text-center">Let's personalize your learning experience.</p>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2 text-slate-300">
                        <User size={16} /> Name
                    </label>
                    <input
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                        value={profile.name}
                        onChange={e => setProfile({ ...profile, name: e.target.value })}
                        placeholder="Your name"
                        required
                    />
                </div>

                <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2 text-slate-300">
                        <Briefcase size={16} /> Coding Background
                    </label>
                    <textarea
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                        value={profile.background}
                        onChange={e => setProfile({ ...profile, background: e.target.value })}
                        placeholder="e.g., Junior React dev, know basic Go..."
                        rows={3}
                    />
                </div>

                <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2 text-slate-300">
                        <Target size={16} /> Learning Goals
                    </label>
                    <textarea
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                        value={profile.goals}
                        onChange={e => setProfile({ ...profile, goals: e.target.value })}
                        placeholder="What do you want to achieve?"
                        rows={3}
                    />
                </div>

                <button
                    type="submit"
                    className="w-full bg-primary hover:opacity-90 text-white font-bold py-3 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    Start Learning
                </button>
            </form>
        </div>
    );
};
