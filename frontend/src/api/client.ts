import axios from 'axios';

                                                                                
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://api.sentinela.my',
  headers: {
    'Content-Type': 'application/json',
  },
});

                                                                      
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sentinela_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

                                                                            
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
                                  
      localStorage.removeItem('sentinela_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);