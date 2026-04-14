export type Lang = "uz" | "ru" | "en";

export const DEFAULT_LANG: Lang = "uz";

type CommandInfo = {
  name: string;
  description: string;
  usage: string;
};

type CommandCategory = {
  title: string;
  commands: CommandInfo[];
};

type Translation = {
  // General
  groupOnly: string;
  languageChanged: string;

  // /hamma, /all
  noMembers: string;
  attentionMembers: string;

  // /help
  noCommands: string;
  availableCommands: string;

  // /news
  newsAlreadyEnabled: string;
  newsEnabled: string;
  newsNotEnabled: string;
  newsDisabled: string;

  // /foydali — useful content (YouTube)
  usefulAlreadyEnabled: string;
  usefulEnabled: string;
  usefulNotEnabled: string;
  usefulDisabled: string;
  usefulContentHeader: string;

  // /sensitive_content
  sensitiveAlreadyEnabled: string;
  sensitiveEnabled: string;
  sensitiveNotEnabled: string;
  sensitiveDisabled: string;

  // /stats
  trackedByBot: string;
  totalInGroup: string;
  membersAddedInfo: string;
  unknown: string;

  // /testNews
  developerOnly: string;
  sendingNews: string;
  newsSent: (count: number) => string;

  // Daily news
  dailyNewsHeader: string;

  // NSFW protection
  nsfwBannedProfile: (name: string) => string;
  nsfwBannedImage: (name: string) => string;
  nsfwBannedChannel: (name: string) => string;
  nsfwReactionRepost: string;

  // Command list for /help
  groupCommands: CommandCategory;
  devGroupCommands: CommandCategory;
  devBotCommands: CommandCategory;

  // Stats card labels
  statsCard: {
    weeklyChampion: string;
    weeklyLeaderboard: string;
    weeklyTopTen: string;
    monthlyChampion: string;
    monthlyLeaderboard: string;
    monthlyTopTen: string;
    yearlyChampion: string;
    yearlyLeaderboard: string;
    yearlyTopTen: string;
    monthlyCaption: (botUsername: string) => string;
    yearlyCaption: (botUsername: string) => string;
    rank: string;
    totalActions: string;
    messages: string;
    replies: string;
    reactionsGiven: string;
    reactionsReceived: string;
    stickers: string;
    voices: string;
    media: string;
    videoNotes: string;
    gifs: string;
    topMessager: string;
    topReplier: string;
    topReactionGiver: string;
    topReactionReceiver: string;
    topStickerSender: string;
    topVoiceSender: string;
    topMediaSender: string;
    topVideoNoteSender: string;
    topGifSender: string;
    weeklyCaption: (botUsername: string) => string;
    cardTagline: string;
  };

  // Greeting when bot is added to a group
  greeting: string;
  capabilitiesFull: string;
};

export const translations: Record<Lang, Translation> = {
  uz: {
    groupOnly: "Bu buyruq faqat guruhlarda ishlaydi.",
    languageChanged: "Til o'zbekchaga o'zgartirildi 🇺🇿",

    noMembers:
      "Hali hech qanday a'zo kuzatilmagan. A'zolar xabar yuborganlarida kuzatiladi.",
    attentionMembers: "Guruh a'zolari, e'tibor:\n\n",

    noCommands: "Mavjud buyruqlar yo'q.",
    availableCommands: "Mavjud buyruqlar:\n\n",

    newsAlreadyEnabled: "Kundalik yangiliklar bu guruhda allaqachon yoqilgan.",
    newsEnabled:
      "Kundalik yangiliklar yoqildi! Bu guruh har kuni yangiliklar oladi.",
    newsNotEnabled: "Kundalik yangiliklar bu guruhda yoqilmagan.",
    newsDisabled: "Kundalik yangiliklar bu guruh uchun o'chirildi.",

    usefulAlreadyEnabled: "Foydali kontentlar bu guruhda allaqachon yoqilgan.",
    usefulEnabled:
      "Foydali kontentlar yoqildi! Bu guruh har kuni tanlangan YouTube kanallaridan eng so'nggi videolarni oladi.",
    usefulNotEnabled: "Foydali kontentlar bu guruhda yoqilmagan.",
    usefulDisabled: "Foydali kontentlar bu guruh uchun o'chirildi.",
    usefulContentHeader: "🎬 Bugungi foydali videolar:\n\n",

    sensitiveAlreadyEnabled:
      "Nomaqbul kontent tekshiruvi bu guruhda allaqachon yoqilgan.",
    sensitiveEnabled:
      "Nomaqbul kontent tekshiruvi yoqildi. Bot endi profil, kanal va xabar rasmlarini tekshiradi.",
    sensitiveNotEnabled: "Nomaqbul kontent tekshiruvi bu guruhda yoqilmagan.",
    sensitiveDisabled: "Nomaqbul kontent tekshiruvi bu guruh uchun o'chirildi.",

    trackedByBot: "Bot kuzatgan",
    totalInGroup: "Guruhdagi jami",
    membersAddedInfo:
      "A'zolar xabar yuborganlarida yoki qo'shilganlarida qo'shiladi.",
    unknown: "noma'lum",

    developerOnly: "Bu buyruq faqat dasturchilar uchun.",
    sendingNews: "Barcha obuna bo'lgan guruhlarga yangiliklar yuborilmoqda...",
    newsSent: (count) => `Tayyor. ${count} ta guruhga yangiliklar yuborildi.`,

    dailyNewsHeader: "📰 Kundalik yangiliklar:\n\n",
    nsfwBannedProfile: (name) =>
      `Foydalanuvchi ${name} bloklandi: NSFW profil rasmi aniqlandi.`,
    nsfwBannedImage: (name) =>
      `Foydalanuvchi ${name} bloklandi: NSFW rasm aniqlandi.`,
    nsfwBannedChannel: (name) =>
      `Foydalanuvchi ${name} bloklandi: NSFW kanal rasmi aniqlandi.`,
    nsfwReactionRepost:
      "Sizning postingizga nojo'ya profilli foydalanuvchi reaksiya qoldirdi, shuning uchun postni qayta joyladik.",

    groupCommands: {
      title: "Guruh buyruqlari:",
      commands: [
        {
          name: "hamma",
          description: "Barcha kuzatilgan guruh a'zolarini eslatish",
          usage: "/hamma",
        },
        {
          name: "statistika",
          description: "Kuzatilgan va jami a'zolar sonini ko'rsatish",
          usage: "/statistika",
        },
        {
          name: "yordam",
          description: "Mavjud buyruqlar ro'yxatini ko'rsatish",
          usage: "/yordam",
        },
        {
          name: "yangiliklar",
          description: "Kundalik yangiliklar yoqish",
          usage: "/yangiliklar",
        },
        {
          name: "yangiliklar_bekor",
          description: "Kundalik yangiliklar o'chirish",
          usage: "/yangiliklar_bekor",
        },
        {
          name: "foydali",
          description: "Foydali YouTube videolarini yoqish",
          usage: "/foydali",
        },
        {
          name: "foydali_bekor",
          description: "Foydali YouTube videolarini o'chirish",
          usage: "/foydali_bekor",
        },
        {
          name: "sensitive_content",
          description: "Nomaqbul kontent tekshiruvini yoqish",
          usage: "/sensitive_content",
        },
        {
          name: "sensitive_content_off",
          description: "Nomaqbul kontent tekshiruvini o'chirish",
          usage: "/sensitive_content_off",
        },
        {
          name: "uz",
          description: "Tilni o'zbekchaga o'zgartirish",
          usage: "/uz",
        },
        {
          name: "ru",
          description: "Tilni ruschaga o'zgartirish",
          usage: "/ru",
        },
        {
          name: "en",
          description: "Tilni inglizchaga o'zgartirish",
          usage: "/en",
        },
        {
          name: "imkoniyatlarim",
          description: "Botning barcha imkoniyatlarini ko'rsatish",
          usage: "/imkoniyatlarim",
        },
      ],
    },
    devGroupCommands: {
      title: "Guruh buyruqlari (dasturchi):",
      commands: [
        {
          name: "testNews",
          description: "Yangiliklar hozir yuborish",
          usage: "/testNews",
        },
        {
          name: "testUseful",
          description: "Foydali videolarni hozir yuborish",
          usage: "/testUseful",
        },
        {
          name: "testweeklystats",
          description: "Haftalik statistika kartasini hozir yaratish",
          usage: "/testweeklystats",
        },
        {
          name: "testmonthlystats",
          description: "Oylik statistika kartasini hozir yaratish",
          usage: "/testmonthlystats",
        },
        {
          name: "testyearlystats",
          description: "Yillik statistika kartasini hozir yaratish",
          usage: "/testyearlystats",
        },
        {
          name: "teststats",
          description: "Statistika kartasi shablonini sinash",
          usage: "/teststats",
        },
        {
          name: "testleaderboard",
          description: "Reyting kartasi shablonini sinash",
          usage: "/testleaderboard",
        },
        {
          name: "dev",
          description: "Dasturchi buyruqlari ro'yxatini ko'rsatish",
          usage: "/dev",
        },
      ],
    },
    devBotCommands: {
      title: "Bot buyruqlari (dasturchi):",
      commands: [
        {
          name: "time",
          description: "Yangiliklar va foydali videolar yuborish vaqtlarini sozlash",
          usage: "/time",
        },
        {
          name: "newsstats",
          description: "Yangiliklar statistikasi",
          usage: "/newsstats",
        },
        {
          name: "usefulstats",
          description: "Foydali kontent bosish statistikasi (kanal bo'yicha, oylik)",
          usage: "/usefulstats [YYYY-MM]",
        },
        {
          name: "addChannel",
          description: "Yangi YouTube kanalini qo'shish",
          usage: "/addChannel <url|@handle|UC...>",
        },
        {
          name: "removeChannel",
          description: "YouTube kanalini o'chirish",
          usage: "/removeChannel <channel_id>",
        },
        {
          name: "listChannels",
          description: "Sozlangan YouTube kanallar ro'yxati",
          usage: "/listChannels",
        },
      ],
    },

    statsCard: {
      weeklyChampion: "Haftalik chempion",
      weeklyLeaderboard: "Haftalik reyting",
      weeklyTopTen: "Haftaning TOP 10 a'zosi",
      monthlyChampion: "Oylik chempion",
      monthlyLeaderboard: "Oylik reyting",
      monthlyTopTen: "Oyning TOP 10 a'zosi",
      yearlyChampion: "Yillik chempion",
      yearlyLeaderboard: "Yillik reyting",
      yearlyTopTen: "Yilning TOP 10 a'zosi",
      monthlyCaption: (bot) =>
        `🏆 Oylik statistika — bir oylik faolligimizning umumiy xulosasi!\n\nOyning eng faol a'zolarini tabriklaymiz! Yangi oy — yangi imkoniyatlar 🔥\n\n🤖 Botni o'z guruhingizga qo'shing: @${bot}\n\n⚠️ Reaksiya statistikasi uchun botga admin huquqlari kerak.`,
      yearlyCaption: (bot) =>
        `🏆 Yillik statistika — butun yilning yakunlari!\n\nYilning eng faol a'zolarini tabriklaymiz! Yangi yil — yangi rekordlar 🔥\n\n🤖 Botni o'z guruhingizga qo'shing: @${bot}\n\n⚠️ Reaksiya statistikasi uchun botga admin huquqlari kerak.`,
      rank: "O'rin",
      totalActions: "Jami harakatlar",
      messages: "Xabarlar",
      replies: "Javoblar",
      reactionsGiven: "Qo'yilgan reaksiyalar",
      reactionsReceived: "Olingan reaksiyalar",
      stickers: "Stikerlar",
      voices: "Ovozli xabarlar",
      media: "Media",
      videoNotes: "Doira videolar",
      gifs: "Gif'lar",
      topMessager: "Eng oqibatli foydalanuvchi",
      topReplier: "Eng yaxshi suhbatdosh",
      topReactionGiver: "Reaksiyalarni ayamaydilar",
      topReactionReceiver: "Eng ko'p reaksiya olgan guruh a'zosi",
      topStickerSender: "Stiker ustasi",
      topVoiceSender: "Ovozli xabarlarni yaxshi ko'radilar",
      topMediaSender: "Eng ko'p media yuborgan a'zo",
      topVideoNoteSender: "Doira video ustasi",
      topGifSender: "Gif qiroli",
      weeklyCaption: (bot) =>
        `🏆 Haftalik statistika — bir haftalik faolligimiz qisqacha!\n\nEng faol a'zolarimizni tabriklaymiz! Yangi hafta — yangi imkoniyatlar. Siz ham kuzatishda qoling 🔥\n\n🤖 Botni o'z guruhingizga qo'shing: @${bot}\nHar bir guruh uchun qiziqarli statistikalar va yangiliklar!\n\n⚠️ Eng ko'p reaksiya qo'ygan va olgan a'zolarni aniqlash uchun botga admin huquqlari kerak. Iltimos, botni adminga qo'shing.`,
      cardTagline: "Guruhingiz uchun aqlli yordamchi",
    },

    greeting:
      "Assalomu alaykum, aziz do'stlar! 👋\n\nMen guruhingizga qo'shilganimdan xursandman. Men — ko'p vazifali botman: har kuni qiziqarli yangiliklar va foydali YouTube videolarini yetkazib beraman, nomaqbul kontentni avtomatik aniqlayman, va eng muhimi — guruh a'zolarining haftalik, oylik va yillik faolliklarini kuzatib, eng faol a'zolarni aniqlayman 🏆\n\nTo'liq imkoniyatlarim haqida ma'lumot olish uchun /imkoniyatlarim buyrug'ini bosing.",
    capabilitiesFull:
      "🤖 <b>Mening imkoniyatlarim</b>\n\n<b>📊 Faollik statistikasi</b>\n• Haftalik, oylik va yillik faollikni avtomatik kuzataman\n• Xabarlar, javoblar, stikerlar, ovozli xabarlar, doira videolar, gif va mediani hisoblayman\n• Har hafta, har oy va har yil eng faol a'zolar kartasini yarataman\n• Eng ko'p yozgan, javob bergan, stiker yuborgan va media yuborganlarni aniqlayman\n\n<b>📰 Kundalik yangiliklar</b>\n• daryo.uz saytidan eng so'nggi yangiliklarni olib, kuniga bir necha marta guruhga yuboraman\n• /yangiliklar — yangiliklarni yoqish\n• /yangiliklar_bekor — o'chirish\n\n<b>🎬 Foydali kontentlar</b>\n• Tanlangan YouTube kanallaridan har kuni eng so'nggi 10 ta foydali videoni yuboraman\n• /foydali — yoqish\n• /foydali_bekor — o'chirish\n\n<b>🛡 Nomaqbul kontent himoyasi (ixtiyoriy)</b>\n• Profil rasmlari, kanal rasmlari va xabardagi rasmlarni avtomatik tekshiraman\n• Nomaqbul kontent aniqlansa, foydalanuvchini avtomatik bloklayman\n• Bir guruhda aniqlangan foydalanuvchi boshqa guruhlarda ham bloklanadi\n• /sensitive_content — yoqish (standart holatda o'chirilgan)\n• /sensitive_content_off — o'chirish\n\n<b>👥 A'zolar bilan ishlash</b>\n• /hamma — barcha a'zolarni eslatish\n• /statistika — guruh a'zolari soni\n\n<b>🌐 Ko'p tillilik</b>\n• O'zbek, rus va ingliz tillarini qo'llab-quvvatlayman\n• /uz /ru /en orqali tilni o'zgartirish mumkin\n\n<b>⭐ Adminlik berilsa nimalar qilaman?</b>\n• <b>Reaksiyalarni kuzataman</b> — eng ko'p reaksiya qo'ygan va eng ko'p reaksiya olgan a'zolarni aniqlayman (bularsiz reaksiya statistikasi ishlamaydi!)\n• <b>Nomaqbul foydalanuvchilarni avtomatik bloklayman</b> — adminliksiz bloklash imkonsiz\n• <b>Barcha a'zolarni kuzataman</b> — yangi qo'shilganlarni avtomatik qayd qilaman\n• <b>Nomaqbul rasmlarni o'chiraman</b> — guruhni toza tutaman\n\n💡 To'liq imkoniyatlardan foydalanish uchun botni adminga qo'shing!",
  },

  ru: {
    groupOnly: "Эта команда работает только в группах.",
    languageChanged: "Язык изменён на русский 🇷🇺",

    noMembers:
      "Пока нет отслеживаемых участников. Участники добавляются при отправке сообщений.",
    attentionMembers: "Внимание, участники группы:\n\n",

    noCommands: "Нет доступных команд.",
    availableCommands: "Доступные команды:\n\n",

    newsAlreadyEnabled: "Ежедневные новости уже включены для этой группы.",
    newsEnabled:
      "Ежедневные новости включены! Эта группа будет получать новости каждый день.",
    newsNotEnabled: "Ежедневные новости не включены для этой группы.",
    newsDisabled: "Ежедневные новости отключены для этой группы.",

    usefulAlreadyEnabled: "Полезный контент уже включён для этой группы.",
    usefulEnabled:
      "Полезный контент включён! Эта группа будет ежедневно получать свежие видео с выбранных YouTube-каналов.",
    usefulNotEnabled: "Полезный контент не включён для этой группы.",
    usefulDisabled: "Полезный контент отключён для этой группы.",
    usefulContentHeader: "🎬 Полезные видео дня:\n\n",

    sensitiveAlreadyEnabled:
      "Проверка неприемлемого контента уже включена для этой группы.",
    sensitiveEnabled:
      "Проверка неприемлемого контента включена. Бот будет проверять фото профилей, каналов и сообщений.",
    sensitiveNotEnabled:
      "Проверка неприемлемого контента не включена для этой группы.",
    sensitiveDisabled:
      "Проверка неприемлемого контента отключена для этой группы.",

    trackedByBot: "Отслежено ботом",
    totalInGroup: "Всего в группе",
    membersAddedInfo:
      "Участники добавляются при отправке сообщений или вступлении.",
    unknown: "неизвестно",

    developerOnly: "Эта команда только для разработчиков.",
    sendingNews: "Отправка новостей всем подписанным группам...",
    newsSent: (count) => `Готово. Новости отправлены в ${count} группу(ы).`,

    dailyNewsHeader: "📰 Ежедневные новости:\n\n",
    nsfwBannedProfile: (name) =>
      `Пользователь ${name} заблокирован: обнаружено NSFW фото профиля.`,
    nsfwBannedImage: (name) =>
      `Пользователь ${name} заблокирован: обнаружено NSFW изображение.`,
    nsfwBannedChannel: (name) =>
      `Пользователь ${name} заблокирован: обнаружено NSFW фото канала.`,
    nsfwReactionRepost:
      "На ваш пост отреагировал пользователь с непристойным профилем, поэтому мы переопубликовали пост.",

    groupCommands: {
      title: "Команды группы:",
      commands: [
        {
          name: "все",
          description: "Упомянуть всех отслеживаемых участников",
          usage: "/все",
        },
        {
          name: "статистика",
          description: "Показать количество отслеживаемых и всех участников",
          usage: "/статистика",
        },
        {
          name: "помощь",
          description: "Показать список доступных команд",
          usage: "/помощь",
        },
        {
          name: "новости",
          description: "Включить ежедневные новости",
          usage: "/новости",
        },
        {
          name: "отмена_новостей",
          description: "Отключить ежедневные новости",
          usage: "/отмена_новостей",
        },
        {
          name: "полезное",
          description: "Включить полезные YouTube-видео",
          usage: "/полезное",
        },
        {
          name: "отмена_полезного",
          description: "Отключить полезные YouTube-видео",
          usage: "/отмена_полезного",
        },
        {
          name: "sensitive_content",
          description: "Включить проверку неприемлемого контента",
          usage: "/sensitive_content",
        },
        {
          name: "sensitive_content_off",
          description: "Отключить проверку неприемлемого контента",
          usage: "/sensitive_content_off",
        },
        { name: "uz", description: "Сменить язык на узбекский", usage: "/uz" },
        { name: "ru", description: "Сменить язык на русский", usage: "/ru" },
        { name: "en", description: "Сменить язык на английский", usage: "/en" },
        {
          name: "возможности",
          description: "Показать все возможности бота",
          usage: "/возможности",
        },
      ],
    },
    devGroupCommands: {
      title: "Команды группы (разработчик):",
      commands: [
        {
          name: "testNews",
          description: "Отправить новости сейчас",
          usage: "/testNews",
        },
        {
          name: "testUseful",
          description: "Отправить полезные видео сейчас",
          usage: "/testUseful",
        },
        {
          name: "testweeklystats",
          description: "Сгенерировать недельную карточку статистики сейчас",
          usage: "/testweeklystats",
        },
        {
          name: "testmonthlystats",
          description: "Сгенерировать месячную карточку статистики сейчас",
          usage: "/testmonthlystats",
        },
        {
          name: "testyearlystats",
          description: "Сгенерировать годовую карточку статистики сейчас",
          usage: "/testyearlystats",
        },
        {
          name: "teststats",
          description: "Протестировать шаблон карточки статистики",
          usage: "/teststats",
        },
        {
          name: "testleaderboard",
          description: "Протестировать шаблон карточки рейтинга",
          usage: "/testleaderboard",
        },
        {
          name: "dev",
          description: "Показать список команд разработчика",
          usage: "/dev",
        },
      ],
    },
    devBotCommands: {
      title: "Команды бота (разработчик):",
      commands: [
        {
          name: "time",
          description: "Настроить время доставки новостей и полезных видео",
          usage: "/time",
        },
        {
          name: "newsstats",
          description: "Статистика новостей",
          usage: "/newsstats",
        },
        {
          name: "usefulstats",
          description: "Статистика кликов по полезному контенту (по каналам, за месяц)",
          usage: "/usefulstats [YYYY-MM]",
        },
        {
          name: "addChannel",
          description: "Добавить YouTube-канал в список",
          usage: "/addChannel <url|@handle|UC...>",
        },
        {
          name: "removeChannel",
          description: "Убрать YouTube-канал",
          usage: "/removeChannel <channel_id>",
        },
        {
          name: "listChannels",
          description: "Список настроенных YouTube-каналов",
          usage: "/listChannels",
        },
      ],
    },

    statsCard: {
      weeklyChampion: "Чемпион недели",
      weeklyLeaderboard: "Рейтинг недели",
      weeklyTopTen: "ТОП 10 участников недели",
      monthlyChampion: "Чемпион месяца",
      monthlyLeaderboard: "Рейтинг месяца",
      monthlyTopTen: "ТОП 10 участников месяца",
      yearlyChampion: "Чемпион года",
      yearlyLeaderboard: "Рейтинг года",
      yearlyTopTen: "ТОП 10 участников года",
      monthlyCaption: (bot) =>
        `🏆 Статистика месяца — итоги нашей активности за месяц!\n\nПоздравляем самых активных участников месяца! Новый месяц — новые возможности 🔥\n\n🤖 Добавьте бота в свою группу: @${bot}\n\n⚠️ Для статистики реакций боту нужны права администратора.`,
      yearlyCaption: (bot) =>
        `🏆 Статистика года — итоги всего года!\n\nПоздравляем самых активных участников года! Новый год — новые рекорды 🔥\n\n🤖 Добавьте бота в свою группу: @${bot}\n\n⚠️ Для статистики реакций боту нужны права администратора.`,
      rank: "Место",
      totalActions: "Всего действий",
      messages: "Сообщения",
      replies: "Ответы",
      reactionsGiven: "Отправлено реакций",
      reactionsReceived: "Получено реакций",
      stickers: "Стикеры",
      voices: "Голосовые",
      media: "Медиа",
      videoNotes: "Кружочки",
      gifs: "Гифки",
      topMessager: "Топ автор",
      topReplier: "Топ ответчик",
      topReactionGiver: "Топ реактор",
      topReactionReceiver: "Самый популярный",
      topStickerSender: "Топ стикеров",
      topVoiceSender: "Топ голосовых",
      topMediaSender: "Топ медиа",
      topVideoNoteSender: "Топ кружочков",
      topGifSender: "Топ гифок",
      weeklyCaption: (bot) =>
        `🏆 Статистика недели — краткая сводка нашей активности!\n\nПоздравляем самых активных участников! Новая неделя — новые возможности. Следите за рейтингом 🔥\n\n🤖 Добавьте бота в свою группу: @${bot}\nИнтересная статистика и новости для каждой группы!\n\n⚠️ Чтобы определять участников, которые ставят и получают больше всех реакций, боту нужны права администратора. Пожалуйста, дайте боту админку.`,
      cardTagline: "Умный помощник для вашей группы",
    },

    greeting:
      "Привет, друзья! 👋\n\nРад присоединиться к вашей группе. Я — многофункциональный бот: доставляю свежие новости и полезные YouTube-видео каждый день, автоматически определяю неприемлемый контент, и самое главное — отслеживаю недельную, месячную и годовую активность участников, чтобы определять самых активных 🏆\n\nЧтобы узнать обо всех моих возможностях, нажмите /capabilities.",
    capabilitiesFull:
      "🤖 <b>Мои возможности</b>\n\n<b>📊 Статистика активности</b>\n• Автоматически отслеживаю недельную, месячную и годовую активность\n• Считаю сообщения, ответы, стикеры, голосовые, кружочки, гифки и медиа\n• Каждую неделю, каждый месяц и каждый год создаю карточку самых активных участников\n• Определяю топ авторов, ответчиков, отправителей стикеров и медиа\n\n<b>📰 Ежедневные новости</b>\n• Беру последние новости с daryo.uz и отправляю в группу несколько раз в день\n• /новости — включить\n• /отмена_новостей — выключить\n\n<b>🎬 Полезный контент</b>\n• Каждый день отправляю 10 свежих видео с выбранных YouTube-каналов\n• /полезное — включить\n• /отмена_полезного — выключить\n\n<b>🛡 Защита от неприемлемого контента (опционально)</b>\n• Автоматически проверяю фото профиля, фото каналов и фото в сообщениях\n• При обнаружении неприемлемого контента — автоматический бан\n• Пользователь, заблокированный в одной группе, блокируется во всех\n• /sensitive_content — включить (по умолчанию выключено)\n• /sensitive_content_off — выключить\n\n<b>👥 Работа с участниками</b>\n• /все — упомянуть всех\n• /статистика — количество участников\n\n<b>🌐 Мультиязычность</b>\n• Поддерживаю узбекский, русский и английский\n• Смена языка: /uz /ru /en\n\n<b>⭐ Что я могу с правами администратора?</b>\n• <b>Отслеживаю реакции</b> — определяю тех, кто ставит и получает больше всех реакций (без этого статистика реакций не работает!)\n• <b>Автоматически баню неприемлемых пользователей</b> — без админки бан невозможен\n• <b>Отслеживаю всех участников</b> — автоматически регистрирую новоприбывших\n• <b>Удаляю неприемлемые фото</b> — держу группу чистой\n\n💡 Дайте боту права администратора, чтобы использовать все возможности!",
  },

  en: {
    groupOnly: "This command only works in groups.",
    languageChanged: "Language changed to English 🇬🇧",

    noMembers:
      "No members tracked yet. Members are tracked as they send messages.",
    attentionMembers: "Attention group members:\n\n",

    noCommands: "No commands available.",
    availableCommands: "Available commands:\n\n",

    newsAlreadyEnabled: "Daily news is already enabled for this group.",
    newsEnabled: "Daily news enabled! This group will receive news every day.",
    newsNotEnabled: "Daily news is not enabled for this group.",
    newsDisabled: "Daily news disabled for this group.",

    usefulAlreadyEnabled: "Useful content is already enabled for this group.",
    usefulEnabled:
      "Useful content enabled! This group will receive the latest videos from curated YouTube channels every day.",
    usefulNotEnabled: "Useful content is not enabled for this group.",
    usefulDisabled: "Useful content disabled for this group.",
    usefulContentHeader: "🎬 Today's useful videos:\n\n",

    sensitiveAlreadyEnabled:
      "Sensitive content check is already enabled for this group.",
    sensitiveEnabled:
      "Sensitive content check enabled. The bot will now scan profile, channel and message photos.",
    sensitiveNotEnabled:
      "Sensitive content check is not enabled for this group.",
    sensitiveDisabled: "Sensitive content check disabled for this group.",

    trackedByBot: "Tracked by bot",
    totalInGroup: "Total in group",
    membersAddedInfo: "Members are added as they send messages or join.",
    unknown: "unknown",

    developerOnly: "This command is for developers only.",
    sendingNews: "Sending news to all subscribed groups...",
    newsSent: (count) => `Done. News sent to ${count} group(s).`,

    dailyNewsHeader: "📰 Daily News:\n\n",
    nsfwBannedProfile: (name) =>
      `User ${name} was banned: NSFW profile photo detected.`,
    nsfwBannedImage: (name) => `User ${name} was banned: NSFW image detected.`,
    nsfwBannedChannel: (name) =>
      `User ${name} was banned: NSFW channel photo detected.`,
    nsfwReactionRepost:
      "A user with a sensitive profile reacted to your post, so we reposted it.",

    groupCommands: {
      title: "Group commands:",
      commands: [
        {
          name: "all",
          description: "Mention all tracked group members",
          usage: "/all",
        },
        {
          name: "stats",
          description: "Show tracked vs total member counts",
          usage: "/stats",
        },
        {
          name: "help",
          description: "Show list of available commands",
          usage: "/help",
        },
        {
          name: "news",
          description: "Enable daily news for this group",
          usage: "/news",
        },
        {
          name: "cancelNews",
          description: "Disable daily news for this group",
          usage: "/cancelNews",
        },
        {
          name: "useful",
          description: "Enable daily useful YouTube videos",
          usage: "/useful",
        },
        {
          name: "useful_off",
          description: "Disable daily useful YouTube videos",
          usage: "/useful_off",
        },
        {
          name: "sensitive_content",
          description: "Enable sensitive content scanning",
          usage: "/sensitive_content",
        },
        {
          name: "sensitive_content_off",
          description: "Disable sensitive content scanning",
          usage: "/sensitive_content_off",
        },
        { name: "uz", description: "Change language to Uzbek", usage: "/uz" },
        { name: "ru", description: "Change language to Russian", usage: "/ru" },
        { name: "en", description: "Change language to English", usage: "/en" },
        {
          name: "capabilities",
          description: "Show all bot capabilities",
          usage: "/capabilities",
        },
      ],
    },
    devGroupCommands: {
      title: "Group commands (developer):",
      commands: [
        { name: "testNews", description: "Send news now", usage: "/testNews" },
        {
          name: "testUseful",
          description: "Send useful videos now",
          usage: "/testUseful",
        },
        {
          name: "testweeklystats",
          description: "Generate weekly stats card now",
          usage: "/testweeklystats",
        },
        {
          name: "testmonthlystats",
          description: "Generate monthly stats card now",
          usage: "/testmonthlystats",
        },
        {
          name: "testyearlystats",
          description: "Generate yearly stats card now",
          usage: "/testyearlystats",
        },
        {
          name: "teststats",
          description: "Test the stats card template",
          usage: "/teststats",
        },
        {
          name: "testleaderboard",
          description: "Test the leaderboard card template",
          usage: "/testleaderboard",
        },
        {
          name: "dev",
          description: "Show developer commands list",
          usage: "/dev",
        },
      ],
    },
    devBotCommands: {
      title: "Bot commands (developer):",
      commands: [
        {
          name: "time",
          description: "Configure news and useful content delivery hours",
          usage: "/time",
        },
        {
          name: "newsstats",
          description: "News click statistics",
          usage: "/newsstats",
        },
        {
          name: "usefulstats",
          description: "Useful content click stats (per channel, monthly)",
          usage: "/usefulstats [YYYY-MM]",
        },
        {
          name: "addChannel",
          description: "Add a YouTube channel to the curated list",
          usage: "/addChannel <url|@handle|UC...>",
        },
        {
          name: "removeChannel",
          description: "Deactivate a YouTube channel",
          usage: "/removeChannel <channel_id>",
        },
        {
          name: "listChannels",
          description: "List configured YouTube channels",
          usage: "/listChannels",
        },
      ],
    },

    statsCard: {
      weeklyChampion: "Weekly Champion",
      weeklyLeaderboard: "Weekly Leaderboard",
      weeklyTopTen: "Weekly Top 10 Members",
      monthlyChampion: "Monthly Champion",
      monthlyLeaderboard: "Monthly Leaderboard",
      monthlyTopTen: "Monthly Top 10 Members",
      yearlyChampion: "Yearly Champion",
      yearlyLeaderboard: "Yearly Leaderboard",
      yearlyTopTen: "Yearly Top 10 Members",
      monthlyCaption: (bot) =>
        `🏆 Monthly stats — our activity summary for the month!\n\nCongrats to the most active members of the month! New month, new chances 🔥\n\n🤖 Add the bot to your own group: @${bot}\n\n⚠️ Reaction stats require admin rights.`,
      yearlyCaption: (bot) =>
        `🏆 Yearly stats — a full year in review!\n\nCongrats to the most active members of the year! New year, new records 🔥\n\n🤖 Add the bot to your own group: @${bot}\n\n⚠️ Reaction stats require admin rights.`,
      rank: "Rank",
      totalActions: "Total Actions",
      messages: "Messages",
      replies: "Replies",
      reactionsGiven: "Reactions Given",
      reactionsReceived: "Reactions Received",
      stickers: "Stickers",
      voices: "Voices",
      media: "Media",
      videoNotes: "Video Notes",
      gifs: "GIFs",
      topMessager: "Top Messager",
      topReplier: "Top Replier",
      topReactionGiver: "Top Reaction Giver",
      topReactionReceiver: "Top Reaction Receiver",
      topStickerSender: "Top Sticker Sender",
      topVoiceSender: "Top Voice Sender",
      topMediaSender: "Top Media Sender",
      topVideoNoteSender: "Top Video Note Sender",
      topGifSender: "Top GIF Sender",
      weeklyCaption: (bot) =>
        `🏆 Weekly stats — a quick look at how active we were!\n\nCongrats to our most active members! New week, new chances — stay in the race 🔥\n\n🤖 Add the bot to your own group: @${bot}\nFun stats and news for every community!\n\n⚠️ To track who gives and receives the most reactions, the bot needs admin rights. Please grant admin so it can count reactions.`,
      cardTagline: "The smart sidekick for your group",
    },

    greeting:
      "Hi everyone! 👋\n\nHappy to join your group. I'm a multi-purpose bot: I deliver fresh news and useful YouTube videos every day, automatically detect inappropriate content, and most importantly — I track weekly, monthly and yearly member activity to highlight your most active members 🏆\n\nTap /capabilities to see everything I can do.",
    capabilitiesFull:
      "🤖 <b>What I can do</b>\n\n<b>📊 Activity stats</b>\n• Automatically track weekly, monthly and yearly activity\n• Count messages, replies, stickers, voice messages, video notes, GIFs and media\n• Generate a top-members card every week, every month and every year\n• Identify top messagers, repliers, sticker senders and media senders\n\n<b>📰 Daily news</b>\n• Fetch the latest news from daryo.uz and deliver it to the group several times a day\n• /news — enable\n• /cancelNews — disable\n\n<b>🎬 Useful content</b>\n• Deliver 10 fresh videos from curated YouTube channels every day\n• /useful — enable\n• /useful_off — disable\n\n<b>🛡 Content protection (opt-in)</b>\n• Automatically scan profile photos, channel photos and in-message photos\n• Auto-ban users posting inappropriate content\n• A user flagged in one group is banned in every group\n• /sensitive_content — enable (off by default)\n• /sensitive_content_off — disable\n\n<b>👥 Member tools</b>\n• /all — mention every tracked member\n• /stats — group member counts\n\n<b>🌐 Multi-language</b>\n• Full Uzbek, Russian and English support\n• Change language with /uz /ru /en\n\n<b>⭐ What can I do with admin rights?</b>\n• <b>Track reactions</b> — identify who gives and receives the most reactions (reaction stats do not work without this!)\n• <b>Auto-ban flagged users</b> — banning is impossible without admin\n• <b>Track every member</b> — automatically register new joiners\n• <b>Delete inappropriate photos</b> — keep the group clean\n\n💡 Grant admin rights to unlock everything!",
  },
};
