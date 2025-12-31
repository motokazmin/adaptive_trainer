import { useState, useEffect } from 'react';
import { Onboarding } from './components/Onboarding';
import { TutorialViewer } from './components/TutorialViewer';
import { profileService } from './services/api';
import { GraduationCap, LayoutDashboard, BookOpen, Settings } from 'lucide-react';

function App() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('learn');

  useEffect(() => {
    profileService.get()
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-primary rounded-full mb-4"></div>
          <p className="text-slate-400">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <Onboarding onComplete={setProfile} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border p-6 flex flex-col gap-8">
        <div className="flex items-center gap-3 px-2">
          <GraduationCap className="text-primary" size={32} />
          <span className="font-bold text-xl tracking-tight">Trainer</span>
        </div>

        <nav className="flex flex-col gap-2">
          <button
            onClick={() => setActiveTab('learn')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'learn' ? 'bg-primary/20 text-primary font-semibold' : 'hover:bg-slate-800 text-slate-400'
              }`}
          >
            <BookOpen size={20} /> Learn
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-primary/20 text-primary font-semibold' : 'hover:bg-slate-800 text-slate-400'
              }`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 text-slate-400 transition-all mt-auto"
          >
            <Settings size={20} /> Settings
          </button>
        </nav>

        <div className="mt-auto p-4 glass rounded-xl">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Student</p>
          <p className="font-semibold">{profile.name}</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent">
        <header className="p-8 pb-0">
          <h1 className="text-4xl font-bold">
            {activeTab === 'learn' ? 'Personalized Learning' : 'Progress Dashboard'}
          </h1>
          <p className="text-slate-400 mt-2">
            {activeTab === 'learn'
              ? 'Tell Gemini what you want to understand about your code.'
              : 'Track your mastery and review history.'}
          </p>
        </header>

        <div className="p-8">
          {activeTab === 'learn' ? (
            <TutorialViewer />
          ) : (
            <div className="glass p-12 rounded-3xl text-center">
              <p className="text-slate-400">Dashboard functionality coming soon! Check back after few more tutorials.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
