/**
 * Telegram adapter types.
 */

/**
 * Telegram adapter configuration.
 */
export interface TelegramAdapterConfig {
  /** Telegram bot token from BotFather. */
  botToken: string;
  /** Optional custom API base URL (defaults to https://api.telegram.org). */
  apiBaseUrl?: string;
  /** Optional webhook secret token checked against x-telegram-bot-api-secret-token. */
  secretToken?: string;
}

/**
 * Telegram thread ID components.
 */
export interface TelegramThreadId {
  /** Telegram chat ID. */
  chatId: string;
  /** Optional forum topic ID for supergroup topics. */
  messageThreadId?: number;
}

/**
 * Telegram user object.
 * @see https://core.telegram.org/bots/api#user
 */
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Telegram chat object.
 * @see https://core.telegram.org/bots/api#chat
 */
export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Telegram message entity (mentions, links, commands, etc).
 * @see https://core.telegram.org/bots/api#messageentity
 */
export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
  user?: TelegramUser;
}

/**
 * Telegram file metadata.
 */
export interface TelegramFile {
  file_id: string;
  file_unique_id?: string;
  file_size?: number;
  file_path?: string;
}

/**
 * Telegram photo size object.
 */
export interface TelegramPhotoSize extends TelegramFile {
  width: number;
  height: number;
}

/**
 * Telegram message.
 * @see https://core.telegram.org/bots/api#message
 */
export interface TelegramMessage {
  message_id: number;
  message_thread_id?: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  chat: TelegramChat;
  date: number;
  edit_date?: number;
  text?: string;
  caption?: string;
  entities?: TelegramMessageEntity[];
  caption_entities?: TelegramMessageEntity[];
  photo?: TelegramPhotoSize[];
  document?: TelegramFile & { file_name?: string; mime_type?: string };
  video?: TelegramFile & {
    width?: number;
    height?: number;
    mime_type?: string;
    file_name?: string;
  };
  audio?: TelegramFile & {
    duration?: number;
    performer?: string;
    title?: string;
    mime_type?: string;
    file_name?: string;
  };
  voice?: TelegramFile & { duration?: number; mime_type?: string };
  sticker?: TelegramFile & { emoji?: string };
}

/**
 * Telegram inline keyboard button.
 * @see https://core.telegram.org/bots/api#inlinekeyboardbutton
 */
export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

/**
 * Telegram inline keyboard markup.
 * @see https://core.telegram.org/bots/api#inlinekeyboardmarkup
 */
export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

/**
 * Telegram callback query (inline keyboard button click).
 * @see https://core.telegram.org/bots/api#callbackquery
 */
export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
}

/**
 * Telegram reaction types.
 */
export interface TelegramReactionTypeEmoji {
  type: "emoji";
  emoji: string;
}

export interface TelegramReactionTypeCustomEmoji {
  type: "custom_emoji";
  custom_emoji_id: string;
}

export type TelegramReactionType =
  | TelegramReactionTypeEmoji
  | TelegramReactionTypeCustomEmoji;

/**
 * Telegram message reaction update.
 * @see https://core.telegram.org/bots/api#messagereactionupdated
 */
export interface TelegramMessageReactionUpdated {
  chat: TelegramChat;
  message_id: number;
  message_thread_id?: number;
  date: number;
  old_reaction: TelegramReactionType[];
  new_reaction: TelegramReactionType[];
  user?: TelegramUser;
  actor_chat?: TelegramChat;
}

/**
 * Telegram webhook update payload.
 * @see https://core.telegram.org/bots/api#update
 */
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  message_reaction?: TelegramMessageReactionUpdated;
}

/**
 * Telegram API response envelope.
 */
export interface TelegramApiResponse<TResult> {
  ok: boolean;
  result?: TResult;
  description?: string;
  error_code?: number;
  parameters?: {
    retry_after?: number;
  };
}

export type TelegramRawMessage = TelegramMessage;
