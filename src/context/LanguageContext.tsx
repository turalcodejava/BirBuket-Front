import React, { createContext, useContext, useState } from 'react';

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

    // About Section
    about_title: "BirBuket - hisslərin ən zərif ifadəsi",
    about_desc: "BirBuket olaraq məqsədimiz sevdiklərinizə çatacaq hər buketi xüsusi etməkdir. Platformamız vasitəsilə siz həm sürətli sifariş verə, həm də sifarişinizin çatdırılma mərhələsini rahat izləyə bilərsiniz.",
    why_choose_us: "Nəyə görə bizi seçirlər?",
    why_choose_li_1: "- Geniş buket çeşidləri və fərdi dizayn imkanı",
    why_choose_li_2: "- Rahat ödəniş və sadə sifariş prosesi",
    why_choose_li_3: "- Müştəri məmnuniyyətinə fokuslanan dəstək xidməti",
    
    hl_title_1: "Təzə güllər",
    hl_desc_1: "Kompozisiyalar gündəlik seçilən təzə güllərlə hazırlanır.",
    hl_title_2: "Sürətli çatdırılma",
    hl_desc_2: "Bakı daxili çatdırılma: məsafəyə görə 5–20 AZN (4 km-ə qədər 5 AZN; 15 km-dən çox 20 AZN). Vaxtında və təhlükəsiz çatdırılma.",
    hl_title_3: "Fərdi yanaşma",
    hl_desc_3: "Hər buket istəyinizə uyğun zövqlə formalaşdırılır.",
    hl_title_4: "Etibarlı xidmət",
    hl_desc_4: "Sifarişdən təhvila qədər hər addımda şəffaf proses.",
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

    // About Section
    about_title: "BirBuket - нежнейшее выражение чувств",
    about_desc: "Наша цель в BirBuket — сделать особенным каждый букет, доставленный вашим близким. Через нашу платформу вы можете сделать быстрый заказ и легко отслеживать статус доставки.",
    why_choose_us: "Почему выбирают нас?",
    why_choose_li_1: "- Широкий выбор букетов и возможность индивидуального дизайна",
    why_choose_li_2: "- Удобная оплата и простой процесс заказа",
    why_choose_li_3: "- Служба поддержки, ориентированная на удовлетворенность клиентов",
    
    hl_title_1: "Свежие цветы",
    hl_desc_1: "Композиции создаются из свежих цветов, выбираемых ежедневно.",
    hl_title_2: "Быстрая доставка",
    hl_desc_2: "Доставка по Баку: 5–20 AZN в зависимости от расстояния (до 4 км — 5 AZN; более 15 км — 20 AZN). Своевременная и безопасная доставка.",
    hl_title_3: "Индивидуальный подход",
    hl_desc_3: "Каждый букет оформляется со вкусом в соответствии с вашими пожеланиями.",
    hl_title_4: "Надежный сервис",
    hl_desc_4: "Прозрачный процесс на каждом этапе от заказа до доставки.",
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

    // About Section
    about_title: "BirBuket - the finest expression of feelings",
    about_desc: "As BirBuket, our goal is to make every bouquet delivered to your loved ones special. Through our platform, you can place quick orders and easily track the delivery stage.",
    why_choose_us: "Why choose us?",
    why_choose_li_1: "- Wide range of bouquets and individual design options",
    why_choose_li_2: "- Convenient payment and simple ordering process",
    why_choose_li_3: "- Customer satisfaction-focused support service",
    
    hl_title_1: "Fresh flowers",
    hl_desc_1: "Arrangements are made with fresh flowers selected daily.",
    hl_title_2: "Fast delivery",
    hl_desc_2: "Delivery within Baku: 5–20 AZN depending on distance (up to 4 km is 5 AZN; over 15 km is 20 AZN). Timely and safe delivery.",
    hl_title_3: "Individual approach",
    hl_desc_3: "Every bouquet is tastefully designed according to your request.",
    hl_title_4: "Reliable service",
    hl_desc_4: "Transparent process at every step from order to delivery.",
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

    // About Section
    about_title: "BirBuket - tuyg'ularning eng nozik ifodasi",
    about_desc: "BirBuket sifatida maqsadimiz - yaqinlaringizga yetkaziladigan har bir guldastani o'zgacha qilishdir. Platformamiz orqali tezda buyurtma berishingiz va yetkazib berish bosqichini osongina kuzatib borishingiz mumkin.",
    why_choose_us: "Nega bizni tanlashadi?",
    why_choose_li_1: "- Keng turdagi guldastalar va individual dizayn imkoniyati",
    why_choose_li_2: "- Qulay to'lov va oddiy buyurtma jarayoni",
    why_choose_li_3: "- Mijozlar mamnuniyatiga yo'naltirilgan qo'llab-quvvatlash xizmati",
    
    hl_title_1: "Yangi gullar",
    hl_desc_1: "Kompozitsiyalar har kuni tanlangan yangi gullardan tayyorlanadi.",
    hl_title_2: "Tezkor yetkazib berish",
    hl_desc_2: "Boku bo'ylab yetkazib berish: masofaga qarab 5–20 AZN (4 kmgacha 5 AZN; 15 kmdan ortiq 20 AZN). O'z vaqtida va xavfsiz yetkazib berish.",
    hl_title_3: "Individual yondashuv",
    hl_desc_3: "Har bir guldasta sizning xohishingizga ko'ra did bilan shakllantiriladi.",
    hl_title_4: "Ishonchli xizmat",
    hl_desc_4: "Buyurtmadan topshirishgacha bo'lgan har bir qadamda shaffof jarayon.",
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

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
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
