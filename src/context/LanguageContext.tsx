import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'az' | 'ru' | 'en' | 'uz';

type LanguageContextType = {
  language: Language;
  changeLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['az']) => string;
};

const translations = {
  az: {
    home: "Ana Səhifə",
    collections: "Kolleksiyalar",
    club: "BirBuketClub",
    create_bouquet: "BirBuket Yarat",
    gardener: "BirBağban",
    about: "Haqqımızda",
    bagban_panel: "Bağban Paneli",
    florist_panel: "Florist Paneli",
    login: "Daxil ol",
    register: "Qeydiyyat",
    logout: "Çıxış",
    profile: "Hesabım",
    cart: "Səbət",
    profile_info: "Profil məlumatlarım",
    order_history: "Sifariş tarixçəm",
    favorites: "Sevimlilərim",
    gardener_requests: "Bağban müraciətləri",
    services_title: "Xidmətlərimiz",
    services_subtitle: "Sizin üçün ən yaxşı xidməti təklif etmək məqsədilə hər detala diqqət yetiririk.",
    loading_api: "Məlumatlar API-dan alınır...",
    
    // Hero Section
    premium_service: "Premium Çiçək Xidməti",
    hero_title_1: "Hər Çiçəkdə",
    hero_title_italic: "Bir Hekayə",
    hero_title_2: "Var",
    hero_desc: "Təbii güllər, estetik dibçək bitkiləri və unudulmaz tədbirləriniz üçün xüsusi dizayn edilmiş dekorasiyalar. Sizin sevginizi çiçəklərlə ifadə edirik.",
    order_now: "İndi sifariş et",
    view_collections: "Kolleksiyalara bax",
    fresh_species: "45+ növ",
    fresh_desc: "Təzə kəsilmiş gül növləri hər gün anbarda",
  },
  ru: {
    home: "Главная",
    collections: "Коллекции",
    club: "BirBuketClub",
    create_bouquet: "Создать букет",
    gardener: "BirBağban",
    about: "О нас",
    bagban_panel: "Панель садовника",
    florist_panel: "Панель флориста",
    login: "Войти",
    register: "Регистрация",
    logout: "Выход",
    profile: "Профиль",
    cart: "Корзина",
    profile_info: "Информация профиля",
    order_history: "История заказов",
    favorites: "Избранное",
    gardener_requests: "Запросы садовнику",
    services_title: "Наши услуги",
    services_subtitle: "Мы уделяем внимание каждой детали, чтобы предложить вам наилучший сервис.",
    loading_api: "Получение данных из API...",
    
    // Hero Section
    premium_service: "Премиальный цветочный сервис",
    hero_title_1: "В каждом цветке",
    hero_title_italic: "своя история",
    hero_title_2: "есть",
    hero_desc: "Свежие цветы, эстетичные комнатные растения и авторские декорации для ваших незабываемых событий. Выражаем вашу любовь цветами.",
    order_now: "Заказать сейчас",
    view_collections: "Смотреть коллекции",
    fresh_species: "45+ видов",
    fresh_desc: "Свежесрезанные сорта цветов каждый день в наличии",
  },
  en: {
    home: "Home",
    collections: "Collections",
    club: "BirBuketClub",
    create_bouquet: "Create Bouquet",
    gardener: "BirBağban",
    about: "About Us",
    bagban_panel: "Gardener Panel",
    florist_panel: "Florist Panel",
    login: "Login",
    register: "Register",
    logout: "Log Out",
    profile: "Profile",
    cart: "Cart",
    profile_info: "Profile info",
    order_history: "Order history",
    favorites: "Favorites",
    gardener_requests: "Gardener requests",
    services_title: "Our Services",
    services_subtitle: "We pay attention to every detail to offer you the best service.",
    loading_api: "Fetching data from API...",
    
    // Hero Section
    premium_service: "Premium Flower Service",
    hero_title_1: "In Every Flower",
    hero_title_italic: "A Story",
    hero_title_2: "There Is",
    hero_desc: "Fresh flowers, aesthetic indoor plants and custom-designed decorations for your unforgettable events. We express your love with flowers.",
    order_now: "Order now",
    view_collections: "View collections",
    fresh_species: "45+ species",
    fresh_desc: "Freshly cut flower species in stock daily",
  },
  uz: {
    home: "Bosh sahifa",
    collections: "Kolleksiyalar",
    club: "BirBuketClub",
    create_bouquet: "Guldasta yaratish",
    gardener: "BirBağban",
    about: "Biz haqimizda",
    bagban_panel: "Bog'bon paneli",
    florist_panel: "Florist paneli",
    login: "Kirish",
    register: "Ro'yxatdan o'tish",
    logout: "Chiqish",
    profile: "Profil",
    cart: "Savat",
    profile_info: "Profil ma'lumotlarim",
    order_history: "Buyurtmalar tarixi",
    favorites: "Sevimlilarim",
    gardener_requests: "Bog'bon murojaatlari",
    services_title: "Xizmatlarimiz",
    services_subtitle: "Sizga eng yaxshi xizmatni taklif qilish uchun har bir detalga e'tibor qaratamiz.",
    loading_api: "API'dan ma'lumot yuklanmoqda...",
    
    // Hero Section
    premium_service: "Premium guldasta xizmati",
    hero_title_1: "Har bir gulda",
    hero_title_italic: "bir hikoya",
    hero_title_2: "bor",
    hero_desc: "Tabiiy gullar, estetik xona o'simliklari va unutilmas tadbirlaringiz uchun maxsus dizayn qilingan bezaklar. Muhabbatingizni gullar bilan ifodalaymiz.",
    order_now: "Hozir buyurtma berish",
    view_collections: "Kolleksiyalarni ko'rish",
    fresh_species: "45+ turdagi",
    fresh_desc: "Yangi kesilgan gul turlari har kuni omborda",
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    if (saved === 'az' || saved === 'ru' || saved === 'en' || saved === 'uz') {
      return saved as Language;
    }
    return 'az';
  });

  useEffect(() => {
    const cookieValue = language === 'az' ? '/az/az' : `/az/${language}`;
    
    // Always check cookies on load
    const currentTrans = document.cookie.split(';').find(item => item.trim().startsWith('googtrans='));
    if (!currentTrans || currentTrans.split('=')[1] !== cookieValue) {
      document.cookie = `googtrans=${cookieValue}; path=/;`;
      document.cookie = `googtrans=${cookieValue}; path=/; domain=${window.location.hostname};`;
    }

    // Extremely aggressive DOM remover and style corrector running every 50ms
    const interval = setInterval(() => {
      const frames = document.querySelectorAll(
        'iframe.goog-te-banner-frame, iframe[class*="goog-te-banner-frame"], iframe[id*="goog-te-banner-frame"], iframe[src*="translate.google.com"], iframe[src*="translate.googleapis.com"], iframe[class*="goog"], iframe[id*="goog"], .goog-te-banner-frame, .goog-te-banner, .goog-te-gadget-icon, #goog-gt-tt, .goog-tooltip, .goog-tooltip:hover, .skiptranslate, .skiptranslate[id*="goog"], iframe.skiptranslate'
      );
      frames.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.display = 'none';
        htmlEl.style.visibility = 'hidden';
        htmlEl.style.height = '0px';
        htmlEl.style.opacity = '0';
        try { el.remove(); } catch (e) {}
      });
      if (document.body && (document.body.style.top !== '0px' || document.body.style.marginTop !== '0px' || document.body.style.position !== 'static')) {
        document.body.style.top = '0px';
        document.body.style.marginTop = '0px';
        document.body.style.position = 'static';
      }
      if (document.documentElement && document.documentElement.style.top !== '0px') {
        document.documentElement.style.top = '0px';
      }
    }, 50);

    return () => clearInterval(interval);
  }, [language]);

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
    const cookieValue = lang === 'az' ? '/az/az' : `/az/${lang}`;
    document.cookie = `googtrans=${cookieValue}; path=/;`;
    document.cookie = `googtrans=${cookieValue}; path=/; domain=${window.location.hostname};`;
    window.location.reload();
  };

  const t = (key: keyof typeof translations['az']): string => {
    return translations[language][key] || translations['az'][key] || '';
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
