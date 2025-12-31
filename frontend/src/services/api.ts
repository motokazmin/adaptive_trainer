import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

export const api = axios.create({
    baseURL: API_BASE_URL,
});

export const tutorialService = {
    list: () => api.get('/tutorials').then(res => res.data),
    generate: (user_request: string, code_context: string, project_path: string) =>
        api.post('/tutorials/generate', { user_request, code_context, project_path }).then(res => res.data),
    get: (id: string) => api.get(`/tutorials/${id}`).then(res => res.data),
};

export const profileService = {
    get: () => api.get('/profile').then(res => res.data),
    update: (profile: any) => api.post('/profile', profile).then(res => res.data),
};
