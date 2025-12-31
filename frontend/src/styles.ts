// Переиспользуемые классы стилей для компонентов

export const styles = {
    // Контейнеры
    card: "glass p-6 rounded-2xl",
    cardLarge: "glass p-8 rounded-3xl",

    // Инпуты
    input: "w-full bg-slate-900 border border-slate-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all",
    inputSmall: "bg-slate-900 border border-slate-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm",
    textarea: "w-full bg-slate-900 border border-slate-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500",

    // Кнопки
    button: {
        primary: "bg-primary hover:opacity-90 font-bold px-6 py-3 rounded-lg transition-all disabled:opacity-50",
        secondary: "bg-slate-800 hover:bg-slate-700 font-bold px-6 py-3 rounded-lg transition-all disabled:opacity-50",
        ghost: "px-4 py-2 hover:bg-slate-800 rounded-lg transition-all",
        icon: "bg-slate-800 hover:bg-slate-700 px-4 rounded-lg transition-all",
    },

    // Навигация
    nav: {
        item: "flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
        active: "bg-primary/20 text-primary font-semibold",
        inactive: "hover:bg-slate-800 text-slate-400",
    },

    // Списки
    list: {
        item: "p-3 rounded-lg cursor-pointer transition-all group",
        active: "bg-purple-500/20 border border-purple-500",
        hover: "hover:bg-slate-800",
    },

    // Badges
    badge: {
        success: "px-3 py-1 rounded-full text-xs font-bold text-green-400 bg-green-500/20",
        warning: "px-3 py-1 rounded-full text-xs font-bold text-yellow-400 bg-yellow-500/20",
        error: "px-3 py-1 rounded-full text-xs font-bold text-red-400 bg-red-500/20",
        info: "px-3 py-1 rounded-full text-xs font-bold text-blue-400 bg-blue-500/20",
    },

    // Заголовки
    heading: {
        h1: "text-4xl font-bold",
        h2: "text-2xl font-bold",
        h3: "text-xl font-bold",
    },

    // Текст
    text: {
        muted: "text-slate-400 text-sm",
        small: "text-xs text-slate-500",
        label: "text-sm font-medium text-slate-300",
    },

    // Layouts
    layout: {
        page: "min-h-screen bg-background text-foreground flex",
        sidebar: "w-64 border-r border-border p-6 flex flex-col gap-8",
        main: "flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent",
        content: "max-w-6xl mx-auto space-y-6",
    },

    // Квизы
    quiz: {
        question: "bg-slate-900/50 p-6 rounded-xl",
        option: "flex items-center gap-3 p-3 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-all",
    },
};

// Утилиты для комбинирования классов
export const cn = (...classes: (string | boolean | undefined)[]) => {
    return classes.filter(Boolean).join(' ');
};