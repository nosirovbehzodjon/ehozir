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

    newsAlreadyEnabled:
      "Kundalik yangiliklar bu guruhda allaqachon yoqilgan.",
    newsEnabled:
      "Kundalik yangiliklar yoqildi! Bu guruh har kuni yangiliklar oladi.",
    newsNotEnabled: "Kundalik yangiliklar bu guruhda yoqilmagan.",
    newsDisabled: "Kundalik yangiliklar bu guruh uchun o'chirildi.",

    trackedByBot: "Bot kuzatgan",
    totalInGroup: "Guruhdagi jami",
    membersAddedInfo:
      "A'zolar xabar yuborganlarida yoki qo'shilganlarida qo'shiladi.",
    unknown: "noma'lum",

    developerOnly: "Bu buyruq faqat dasturchilar uchun.",
    sendingNews:
      "Barcha obuna bo'lgan guruhlarga yangiliklar yuborilmoqda...",
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
        { name: "hamma", description: "Barcha kuzatilgan guruh a'zolarini eslatish", usage: "/hamma" },
        { name: "statistika", description: "Kuzatilgan va jami a'zolar sonini ko'rsatish", usage: "/statistika" },
        { name: "yordam", description: "Mavjud buyruqlar ro'yxatini ko'rsatish", usage: "/yordam" },
        { name: "yangiliklar", description: "Kundalik yangiliklar yoqish", usage: "/yangiliklar" },
        { name: "yangiliklar_bekor", description: "Kundalik yangiliklar o'chirish", usage: "/yangiliklar_bekor" },
        { name: "uz", description: "Tilni o'zbekchaga o'zgartirish", usage: "/uz" },
        { name: "ru", description: "Tilni ruschaga o'zgartirish", usage: "/ru" },
        { name: "en", description: "Tilni inglizchaga o'zgartirish", usage: "/en" },
      ],
    },
    devGroupCommands: {
      title: "Guruh buyruqlari (dasturchi):",
      commands: [
        { name: "testNews", description: "Yangiliklar hozir yuborish", usage: "/testNews" },
      ],
    },
    devBotCommands: {
      title: "Bot buyruqlari (dasturchi):",
      commands: [
        { name: "settings", description: "Bot sozlamalari", usage: "/settings" },
        { name: "newsstats", description: "Yangiliklar statistikasi", usage: "/newsstats" },
      ],
    },
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

    trackedByBot: "Отслежено ботом",
    totalInGroup: "Всего в группе",
    membersAddedInfo:
      "Участники добавляются при отправке сообщений или вступлении.",
    unknown: "неизвестно",

    developerOnly: "Эта команда только для разработчиков.",
    sendingNews: "Отправка новостей всем подписанным группам...",
    newsSent: (count) =>
      `Готово. Новости отправлены в ${count} группу(ы).`,

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
        { name: "все", description: "Упомянуть всех отслеживаемых участников", usage: "/все" },
        { name: "статистика", description: "Показать количество отслеживаемых и всех участников", usage: "/статистика" },
        { name: "помощь", description: "Показать список доступных команд", usage: "/помощь" },
        { name: "новости", description: "Включить ежедневные новости", usage: "/новости" },
        { name: "отмена_новостей", description: "Отключить ежедневные новости", usage: "/отмена_новостей" },
        { name: "uz", description: "Сменить язык на узбекский", usage: "/uz" },
        { name: "ru", description: "Сменить язык на русский", usage: "/ru" },
        { name: "en", description: "Сменить язык на английский", usage: "/en" },
      ],
    },
    devGroupCommands: {
      title: "Команды группы (разработчик):",
      commands: [
        { name: "testNews", description: "Отправить новости сейчас", usage: "/testNews" },
      ],
    },
    devBotCommands: {
      title: "Команды бота (разработчик):",
      commands: [
        { name: "settings", description: "Настройки бота", usage: "/settings" },
        { name: "newsstats", description: "Статистика новостей", usage: "/newsstats" },
      ],
    },
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
    newsEnabled:
      "Daily news enabled! This group will receive news every day.",
    newsNotEnabled: "Daily news is not enabled for this group.",
    newsDisabled: "Daily news disabled for this group.",

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
    nsfwBannedImage: (name) =>
      `User ${name} was banned: NSFW image detected.`,
    nsfwBannedChannel: (name) =>
      `User ${name} was banned: NSFW channel photo detected.`,
    nsfwReactionRepost:
      "A user with a sensitive profile reacted to your post, so we reposted it.",

    groupCommands: {
      title: "Group commands:",
      commands: [
        { name: "all", description: "Mention all tracked group members", usage: "/all" },
        { name: "stats", description: "Show tracked vs total member counts", usage: "/stats" },
        { name: "help", description: "Show list of available commands", usage: "/help" },
        { name: "news", description: "Enable daily news for this group", usage: "/news" },
        { name: "cancelNews", description: "Disable daily news for this group", usage: "/cancelNews" },
        { name: "uz", description: "Change language to Uzbek", usage: "/uz" },
        { name: "ru", description: "Change language to Russian", usage: "/ru" },
        { name: "en", description: "Change language to English", usage: "/en" },
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
        { name: "newsstats", description: "News click statistics", usage: "/newsstats" },
      ],
    },
  },
};
