import { useState, useEffect } from 'react';
import { Onboarding } from './components/Onboarding';
import { TutorialViewer } from './components/TutorialViewer';
import { Dashboard } from './components/Dashboard';
import { ToastProvider } from './components/Toast';
import { profileService, type Profile } from './services/api';
import { GraduationCap, LayoutDashboard, BookOpen, Settings, LogOut } from 'lucide-react';

function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'learn' | 'dashboard' | 'settings'>('learn');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await profileService.get();
      setProfile(data);
    } catch (err) {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setProfile(null);
    setActiveTab('learn');
  };

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
    return (
      <ToastProvider>
        <Onboarding onComplete={setProfile} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background text-foreground flex">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border p-6 flex flex-col gap-8">
          <div className="flex items-center gap-3 px-2">
            <GraduationCap className="text-primary" size={32} />
            <span className="font-bold text-xl tracking-tight">AI Tutor</span>
          </div>

          <nav className="flex flex-col gap-2">
            <button
              onClick={() => setActiveTab('learn')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'learn'
                  ? 'bg-primary/20 text-primary font-semibold'
                  : 'hover:bg-slate-800 text-slate-400'
                }`}
            >
              <BookOpen size={20} /> Learn
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'dashboard'
                  ? 'bg-primary/20 text-primary font-semibold'
                  : 'hover:bg-slate-800 text-slate-400'
                }`}
            >
              <LayoutDashboard size={20} /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'settings'
                  ? 'bg-primary/20 text-primary font-semibold'
                  : 'hover:bg-slate-800 text-slate-400'
                }`}
            >
              <Settings size={20} /> Settings
            </button>
          </nav>

          <div className="mt-auto space-y-4">
            <div className="p-4 glass rounded-xl">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Student</p>
              <p className="font-semibold">{profile.name}</p>
              {profile.background && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{profile.background}</p>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent">
          <header className="p-8 pb-6">
            <h1 className="text-4xl font-bold">
              {activeTab === 'learn' && 'Personalized Learning'}
              {activeTab === 'dashboard' && 'Progress Dashboard'}
              {activeTab === 'settings' && 'Settings'}
            </h1>
            <p className="text-slate-400 mt-2">
              {activeTab === 'learn' && 'Learn from your code with AI-powered tutorials and quizzes'}
              {activeTab === 'dashboard' && 'Track your mastery and review schedule'}
              {activeTab === 'settings' && 'Manage your profile and preferences'}
            </p>
          </header>

          <div className="p-8 pt-0">
            {activeTab === 'learn' && <TutorialViewer />}
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'settings' && (
              <div className="glass p-8 rounded-3xl max-w-2xl">
                <h2 className="text-2xl font-bold mb-6">Profile Settings</h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-300">Name</label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-300">Background</label>
                    <textarea
                      value={profile.background}
                      onChange={(e) => setProfile({ ...profile, background: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows={4}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-300">Goals</label>
                    <textarea
                      value={profile.goals}
                      onChange={(e) => setProfile({ ...profile, goals: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows={4}
                    />
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        await profileService.update(profile);
                        alert('Profile updated successfully!');
                      } catch (err) {
                        alert('Failed to update profile');
                      }
                    }}
                    className="w-full bg-primary hover:opacity-90 font-bold py-3 rounded-lg transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;