import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

export const api = axios.create({
    baseURL: API_BASE_URL,
});

// ==================== Types ====================

export interface Profile {
    id: number;
    name: string;
    background: string;
    goals: string;
    created_at: string;
    updated_at: string;
}

export interface Tutorial {
    id: number;
    title: string;
    content: string;
    topic: string;
    difficulty?: string;
    created_at: string;
    updated_at: string;
}

export interface Progress {
    id: number;
    topic: string;
    mastery_score: number;
    last_reviewed: string;
    next_review: string;
    interval_days: number;
    created_at: string;
    updated_at: string;
}

export interface ProgressStats {
    total_topics: number;
    mastered_topics: number;
    intermediate_topics: number;
    beginner_topics: number;
    topics_needing_review: number;
    average_mastery: number;
}

export interface QuizQuestion {
    id: number;
    question: string;
    type: 'multiple_choice' | 'true_false' | 'code_completion' | 'free_text';
    options?: string[];
    points: number;
}

export interface Quiz {
    id: number;
    tutorial_id: number;
    topic: string;
    title: string;
    difficulty: string;
    questions: QuizQuestion[];
    created_at: string;
}

export interface QuizAnswer {
    question_id: number;
    answer: string;
    is_correct?: boolean;
}

export interface QuizSubmission {
    id: number;
    quiz_id: number;
    score: number;
    max_score: number;
    passed: boolean;
    feedback: string;
    created_at: string;
    answers?: QuizAnswer[];
}

export interface ProjectAnalysis {
    structure: string;
    main_packages: string[];
    dependencies: Record<string, string>;
    total_lines?: number;
    file_count?: number;
}

// ==================== API Services ====================

export const profileService = {
    get: async (): Promise<Profile> => {
        const res = await api.get('/profile');
        return res.data;
    },

    update: async (profile: Partial<Profile>): Promise<Profile> => {
        const res = await api.post('/profile', profile);
        return res.data;
    },
};

export const tutorialService = {
    list: async (): Promise<Tutorial[]> => {
        const res = await api.get('/tutorials');
        return res.data;
    },

    generate: async (
        user_request: string,
        topic: string,
        code_context?: string,
        project_path?: string
    ): Promise<Tutorial> => {
        const res = await api.post('/tutorials/generate', {
            user_request,
            topic,
            code_context: code_context || '',
            project_path: project_path || '',
        });
        return res.data;
    },

    get: async (id: number): Promise<Tutorial> => {
        const res = await api.get(`/tutorials/${id}`);
        return res.data;
    },

    delete: async (id: number): Promise<void> => {
        await api.delete(`/tutorials/${id}`);
    },
};

export const quizService = {
    generate: async (
        tutorial_id: number,
        difficulty: 'basic' | 'intermediate' | 'advanced' | 'expert'
    ): Promise<Quiz> => {
        const res = await api.post('/quizzes/generate', {
            tutorial_id,
            difficulty,
        });
        return res.data;
    },

    get: async (id: number): Promise<Quiz> => {
        const res = await api.get(`/quizzes/${id}`);
        return res.data;
    },

    submit: async (id: number, answers: QuizAnswer[]): Promise<QuizSubmission> => {
        const res = await api.post(`/quizzes/${id}/submit`, { answers });
        return res.data;
    },

    getByTutorial: async (tutorialId: number): Promise<Quiz[]> => {
        const res = await api.get(`/quizzes/tutorial/${tutorialId}`);
        return res.data;
    },
};

export const progressService = {
    getAll: async (): Promise<Progress[]> => {
        const res = await api.get('/progress');
        return res.data;
    },

    getStats: async (): Promise<ProgressStats> => {
        const res = await api.get('/progress/stats');
        return res.data;
    },

    getWeak: async (): Promise<Progress[]> => {
        const res = await api.get('/progress/weak');
        return res.data;
    },

    getReview: async (): Promise<Progress[]> => {
        const res = await api.get('/progress/review');
        return res.data;
    },

    getLearningPath: async (): Promise<{ path: string[] }> => {
        const res = await api.get('/progress/path');
        return res.data;
    },

    reset: async (topic: string): Promise<void> => {
        await api.delete(`/progress/${encodeURIComponent(topic)}`);
    },
};

export const projectService = {
    analyze: async (project_path: string): Promise<ProjectAnalysis> => {
        const res = await api.post('/project/analyze', { project_path });
        return res.data;
    },
};

// ==================== Error Handler ====================

api.interceptors.response.use(
    response => response,
    error => {
        if (error.response) {
            console.error('API Error:', error.response.data);
            // Можно добавить toast notification здесь
        } else if (error.request) {
            console.error('Network Error:', error.message);
        }
        return Promise.reject(error);
    }
);