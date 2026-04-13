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
    monthlyChampion: string;
    monthlyLeaderboard: string;
    yearlyChampion: string;
    yearlyLeaderboard: string;
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
    topMessager: string;
    topReplier: string;
    topReactionGiver: string;
    topReactionReceiver: string;
    topStickerSender: string;
    topVoiceSender: string;
    topMediaSender: string;
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
      ],
    },
    devBotCommands: {
      title: "Bot buyruqlari (dasturchi):",
      commands: [
        {
          name: "settings",
          description: "Bot sozlamalari",
          usage: "/settings",
        },
        {
          name: "newsstats",
          description: "Yangiliklar statistikasi",
          usage: "/newsstats",
        },
      ],
    },

    statsCard: {
      weeklyChampion: "Haftalik chempion",
      weeklyLeaderboard: "Haftalik reyting",
      monthlyChampion: "Oylik chempion",
      monthlyLeaderboard: "Oylik reyting",
      yearlyChampion: "Yillik chempion",
      yearlyLeaderboard: "Yillik reyting",
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
      topMessager: "Eng oqibatli foydalanuvchi",
      topReplier: "Eng yaxshi suhbatdosh",
      topReactionGiver: "Reaksiyalarni ayamaydigan a'zo",
      topReactionReceiver: "Eng ko'p reaksiya olgan a'zo",
      topStickerSender: "Stiker ustasi",
      topVoiceSender: "Ovoz  xabarlarni yaxshi ko'radigan a'zo",
      topMediaSender: "Eng ko'p media yuborgan a'zo",
      weeklyCaption: (bot) =>
        `🏆 Haftalik statistika — bir haftalik faolligimiz qisqacha!\n\nEng faol a'zolarimizni tabriklaymiz! Yangi hafta — yangi imkoniyatlar. Siz ham kuzatishda qoling 🔥\n\n🤖 Botni o'z guruhingizga qo'shing: @${bot}\nHar bir guruh uchun qiziqarli statistikalar va yangiliklar!\n\n⚠️ Eng ko'p reaksiya qo'ygan va olgan a'zolarni aniqlash uchun botga admin huquqlari kerak. Iltimos, botni adminga qo'shing.`,
      cardTagline: "Guruhingiz uchun aqlli yordamchi",
    },

    greeting:
      "Assalomu alaykum, aziz do'stlar! 👋\n\nMen guruhingizga qo'shilganimdan xursandman. Men — ko'p vazifali botman: har kuni qiziqarli yangiliklarni yetkazib beraman, nomaqbul kontentni avtomatik aniqlayman, va eng muhimi — guruh a'zolarining haftalik, oylik va yillik faolliklarini kuzatib, eng faol a'zolarni aniqlayman 🏆\n\nTo'liq imkoniyatlarim haqida ma'lumot olish uchun /imkoniyatlarim buyrug'ini bosing.",
    capabilitiesFull:
      "🤖 <b>Mening imkoniyatlarim</b>\n\n<b>📊 Faollik statistikasi</b>\n• Haftalik, oylik va yillik faollikni avtomatik kuzataman\n• Xabarlar, javoblar, stikerlar, ovozli xabarlar va mediani hisoblayman\n• Har hafta, har oy va har yil eng faol a'zolar kartasini yarataman\n• Eng ko'p yozgan, javob bergan, stiker yuborgan va media yuborganlarni aniqlayman\n\n<b>📰 Kundalik yangiliklar</b>\n• daryo.uz saytidan eng so'nggi yangiliklarni olib, kuniga bir necha marta guruhga yuboraman\n• /yangiliklar — yangiliklarni yoqish\n• /yangiliklar_bekor — o'chirish\n\n<b>🛡 Nomaqbul kontent himoyasi (ixtiyoriy)</b>\n• Profil rasmlari, kanal rasmlari va xabardagi rasmlarni avtomatik tekshiraman\n• Nomaqbul kontent aniqlansa, foydalanuvchini avtomatik bloklayman\n• Bir guruhda aniqlangan foydalanuvchi boshqa guruhlarda ham bloklanadi\n• /sensitive_content — yoqish (standart holatda o'chirilgan)\n• /sensitive_content_off — o'chirish\n\n<b>👥 A'zolar bilan ishlash</b>\n• /hamma — barcha a'zolarni eslatish\n• /statistika — guruh a'zolari soni\n\n<b>🌐 Ko'p tillilik</b>\n• O'zbek, rus va ingliz tillarini qo'llab-quvvatlayman\n• /uz /ru /en orqali tilni o'zgartirish mumkin\n\n<b>⭐ Adminlik berilsa nimalar qilaman?</b>\n• <b>Reaksiyalarni kuzataman</b> — eng ko'p reaksiya qo'ygan va eng ko'p reaksiya olgan a'zolarni aniqlayman (bularsiz reaksiya statistikasi ishlamaydi!)\n• <b>Nomaqbul foydalanuvchilarni avtomatik bloklayman</b> — adminliksiz bloklash imkonsiz\n• <b>Barcha a'zolarni kuzataman</b> — yangi qo'shilganlarni avtomatik qayd qilaman\n• <b>Nomaqbul rasmlarni o'chiraman</b> — guruhni toza tutaman\n\n💡 To'liq imkoniyatlardan foydalanish uchun botni adminga qo'shing!",
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
      ],
    },
    devBotCommands: {
      title: "Команды бота (разработчик):",
      commands: [
        { name: "settings", description: "Настройки бота", usage: "/settings" },
        {
          name: "newsstats",
          description: "Статистика новостей",
          usage: "/newsstats",
        },
      ],
    },

    statsCard: {
      weeklyChampion: "Чемпион недели",
      weeklyLeaderboard: "Рейтинг недели",
      monthlyChampion: "Чемпион месяца",
      monthlyLeaderboard: "Рейтинг месяца",
      yearlyChampion: "Чемпион года",
      yearlyLeaderboard: "Рейтинг года",
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
      topMessager: "Топ автор",
      topReplier: "Топ ответчик",
      topReactionGiver: "Топ реактор",
      topReactionReceiver: "Самый популярный",
      topStickerSender: "Топ стикеров",
      topVoiceSender: "Топ голосовых",
      topMediaSender: "Топ медиа",
      weeklyCaption: (bot) =>
        `🏆 Статистика недели — краткая сводка нашей активности!\n\nПоздравляем самых активных участников! Новая неделя — новые возможности. Следите за рейтингом 🔥\n\n🤖 Добавьте бота в свою группу: @${bot}\nИнтересная статистика и новости для каждой группы!\n\n⚠️ Чтобы определять участников, которые ставят и получают больше всех реакций, боту нужны права администратора. Пожалуйста, дайте боту админку.`,
      cardTagline: "Умный помощник для вашей группы",
    },

    greeting:
      "Привет, друзья! 👋\n\nРад присоединиться к вашей группе. Я — многофункциональный бот: доставляю свежие новости каждый день, автоматически определяю неприемлемый контент, и самое главное — отслеживаю недельную, месячную и годовую активность участников, чтобы определять самых активных 🏆\n\nЧтобы узнать обо всех моих возможностях, нажмите /capabilities.",
    capabilitiesFull:
      "🤖 <b>Мои возможности</b>\n\n<b>📊 Статистика активности</b>\n• Автоматически отслеживаю недельную, месячную и годовую активность\n• Считаю сообщения, ответы, стикеры, голосовые и медиа\n• Каждую неделю, каждый месяц и каждый год создаю карточку самых активных участников\n• Определяю топ авторов, ответчиков, отправителей стикеров и медиа\n\n<b>📰 Ежедневные новости</b>\n• Беру последние новости с daryo.uz и отправляю в группу несколько раз в день\n• /новости — включить\n• /отмена_новостей — выключить\n\n<b>🛡 Защита от неприемлемого контента (опционально)</b>\n• Автоматически проверяю фото профиля, фото каналов и фото в сообщениях\n• При обнаружении неприемлемого контента — автоматический бан\n• Пользователь, заблокированный в одной группе, блокируется во всех\n• /sensitive_content — включить (по умолчанию выключено)\n• /sensitive_content_off — выключить\n\n<b>👥 Работа с участниками</b>\n• /все — упомянуть всех\n• /статистика — количество участников\n\n<b>🌐 Мультиязычность</b>\n• Поддерживаю узбекский, русский и английский\n• Смена языка: /uz /ru /en\n\n<b>⭐ Что я могу с правами администратора?</b>\n• <b>Отслеживаю реакции</b> — определяю тех, кто ставит и получает больше всех реакций (без этого статистика реакций не работает!)\n• <b>Автоматически баню неприемлемых пользователей</b> — без админки бан невозможен\n• <b>Отслеживаю всех участников</b> — автоматически регистрирую новоприбывших\n• <b>Удаляю неприемлемые фото</b> — держу группу чистой\n\n💡 Дайте боту права администратора, чтобы использовать все возможности!",
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
      ],
    },
    devBotCommands: {
      title: "Bot commands (developer):",
      commands: [
        { name: "settings", description: "Bot settings", usage: "/settings" },
        {
          name: "newsstats",
          description: "News click statistics",
          usage: "/newsstats",
        },
      ],
    },

    statsCard: {
      weeklyChampion: "Weekly Champion",
      weeklyLeaderboard: "Weekly Leaderboard",
      monthlyChampion: "Monthly Champion",
      monthlyLeaderboard: "Monthly Leaderboard",
      yearlyChampion: "Yearly Champion",
      yearlyLeaderboard: "Yearly Leaderboard",
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
      topMessager: "Top Messager",
      topReplier: "Top Replier",
      topReactionGiver: "Top Reaction Giver",
      topReactionReceiver: "Top Reaction Receiver",
      topStickerSender: "Top Sticker Sender",
      topVoiceSender: "Top Voice Sender",
      topMediaSender: "Top Media Sender",
      weeklyCaption: (bot) =>
        `🏆 Weekly stats — a quick look at how active we were!\n\nCongrats to our most active members! New week, new chances — stay in the race 🔥\n\n🤖 Add the bot to your own group: @${bot}\nFun stats and news for every community!\n\n⚠️ To track who gives and receives the most reactions, the bot needs admin rights. Please grant admin so it can count reactions.`,
      cardTagline: "The smart sidekick for your group",
    },

    greeting:
      "Hi everyone! 👋\n\nHappy to join your group. I'm a multi-purpose bot: I deliver fresh news every day, automatically detect inappropriate content, and most importantly — I track weekly, monthly and yearly member activity to highlight your most active members 🏆\n\nTap /capabilities to see everything I can do.",
    capabilitiesFull:
      "🤖 <b>What I can do</b>\n\n<b>📊 Activity stats</b>\n• Automatically track weekly, monthly and yearly activity\n• Count messages, replies, stickers, voice messages and media\n• Generate a top-members card every week, every month and every year\n• Identify top messagers, repliers, sticker senders and media senders\n\n<b>📰 Daily news</b>\n• Fetch the latest news from daryo.uz and deliver it to the group several times a day\n• /news — enable\n• /cancelNews — disable\n\n<b>🛡 Content protection (opt-in)</b>\n• Automatically scan profile photos, channel photos and in-message photos\n• Auto-ban users posting inappropriate content\n• A user flagged in one group is banned in every group\n• /sensitive_content — enable (off by default)\n• /sensitive_content_off — disable\n\n<b>👥 Member tools</b>\n• /all — mention every tracked member\n• /stats — group member counts\n\n<b>🌐 Multi-language</b>\n• Full Uzbek, Russian and English support\n• Change language with /uz /ru /en\n\n<b>⭐ What can I do with admin rights?</b>\n• <b>Track reactions</b> — identify who gives and receives the most reactions (reaction stats do not work without this!)\n• <b>Auto-ban flagged users</b> — banning is impossible without admin\n• <b>Track every member</b> — automatically register new joiners\n• <b>Delete inappropriate photos</b> — keep the group clean\n\n💡 Grant admin rights to unlock everything!",
  },
};
