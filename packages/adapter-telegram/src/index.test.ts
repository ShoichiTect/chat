import { ValidationError } from "@chat-adapter/shared";
import type { ChatInstance, Logger } from "chat";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTelegramAdapter,
  TelegramAdapter,
  type TelegramMessage,
} from "./index";

const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

const mockFetch = vi.fn<typeof fetch>();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function telegramOk(result: unknown): Response {
  return new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function createMockChat(): ChatInstance {
  return {
    getLogger: vi.fn().mockReturnValue(mockLogger),
    getState: vi.fn(),
    getUserName: vi.fn().mockReturnValue("mybot"),
    handleIncomingMessage: vi.fn().mockResolvedValue(undefined),
    processMessage: vi.fn(),
    processReaction: vi.fn(),
    processAction: vi.fn(),
    processModalClose: vi.fn(),
    processModalSubmit: vi.fn().mockResolvedValue(undefined),
    processSlashCommand: vi.fn(),
    processAssistantThreadStarted: vi.fn(),
    processAssistantContextChanged: vi.fn(),
    processAppHomeOpened: vi.fn(),
  } as unknown as ChatInstance;
}

function sampleMessage(overrides?: Partial<TelegramMessage>): TelegramMessage {
  return {
    message_id: 11,
    date: 1735689600,
    chat: {
      id: 123,
      type: "private",
      first_name: "User",
    },
    from: {
      id: 456,
      is_bot: false,
      first_name: "User",
      username: "user",
    },
    text: "hello",
    ...overrides,
  };
}

describe("createTelegramAdapter", () => {
  it("throws when bot token is missing", () => {
    delete process.env.TELEGRAM_BOT_TOKEN;

    expect(() => createTelegramAdapter({ logger: mockLogger })).toThrow(
      ValidationError
    );
  });

  it("uses env vars when config is omitted", () => {
    process.env.TELEGRAM_BOT_TOKEN = "token-from-env";

    const adapter = createTelegramAdapter({ logger: mockLogger });
    expect(adapter).toBeInstanceOf(TelegramAdapter);
    expect(adapter.name).toBe("telegram");
  });
});

describe("TelegramAdapter", () => {
  it("encodes and decodes thread IDs", () => {
    const adapter = createTelegramAdapter({
      botToken: "token",
      logger: mockLogger,
    });

    expect(
      adapter.encodeThreadId({
        chatId: "-100123",
      })
    ).toBe("telegram:-100123");

    expect(
      adapter.encodeThreadId({
        chatId: "-100123",
        messageThreadId: 42,
      })
    ).toBe("telegram:-100123:42");

    expect(adapter.decodeThreadId("telegram:-100123:42")).toEqual({
      chatId: "-100123",
      messageThreadId: 42,
    });
  });

  it("handles webhook message updates and marks mentions", async () => {
    mockFetch.mockResolvedValueOnce(
      telegramOk({
        id: 999,
        is_bot: true,
        first_name: "Bot",
        username: "mybot",
      })
    );

    const adapter = createTelegramAdapter({
      botToken: "token",
      logger: mockLogger,
      userName: "mybot",
    });

    const chat = createMockChat();
    await adapter.initialize(chat);

    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        update_id: 1,
        message: sampleMessage({
          chat: {
            id: -100123,
            type: "supergroup",
            title: "General",
          },
          text: "hello @mybot",
          entities: [{ type: "mention", offset: 6, length: 6 }],
        }),
      }),
    });

    const response = await adapter.handleWebhook(request);
    expect(response.status).toBe(200);

    const processMessage = chat.processMessage as ReturnType<typeof vi.fn>;
    expect(processMessage).toHaveBeenCalledTimes(1);

    const [, threadId, parsedMessage] = processMessage.mock.calls[0] as [
      unknown,
      string,
      { isMention?: boolean; text: string }
    ];

    expect(threadId).toBe("telegram:-100123");
    expect(parsedMessage.text).toBe("hello @mybot");
    expect(parsedMessage.isMention).toBe(true);
  });

  it("posts, edits, deletes, and sends typing events", async () => {
    mockFetch
      .mockResolvedValueOnce(
        telegramOk({
          id: 999,
          is_bot: true,
          first_name: "Bot",
          username: "mybot",
        })
      )
      .mockResolvedValueOnce(telegramOk(sampleMessage()))
      .mockResolvedValueOnce(
        telegramOk(
          sampleMessage({
            text: "updated",
            edit_date: 1735689700,
          })
        )
      )
      .mockResolvedValueOnce(telegramOk(true))
      .mockResolvedValueOnce(telegramOk(true));

    const adapter = createTelegramAdapter({
      botToken: "token",
      logger: mockLogger,
      userName: "mybot",
    });

    await adapter.initialize(createMockChat());

    const posted = await adapter.postMessage("telegram:123", {
      markdown: "hello",
    });

    expect(posted.id).toBe("123:11");
    expect(posted.threadId).toBe("telegram:123");

    await adapter.editMessage("telegram:123", posted.id, "updated");
    await adapter.deleteMessage("telegram:123", posted.id);
    await adapter.startTyping("telegram:123");

    const sendMessageUrl = String(mockFetch.mock.calls[1]?.[0]);
    const editMessageUrl = String(mockFetch.mock.calls[2]?.[0]);
    const deleteMessageUrl = String(mockFetch.mock.calls[3]?.[0]);
    const typingUrl = String(mockFetch.mock.calls[4]?.[0]);

    expect(sendMessageUrl).toContain("/sendMessage");
    expect(editMessageUrl).toContain("/editMessageText");
    expect(deleteMessageUrl).toContain("/deleteMessage");
    expect(typingUrl).toContain("/sendChatAction");

    const sendMessageBody = JSON.parse(
      String((mockFetch.mock.calls[1]?.[1] as RequestInit).body)
    ) as { chat_id: string; text: string };

    expect(sendMessageBody.chat_id).toBe("123");
    expect(sendMessageBody.text).toBe("hello");
  });

  it("adds and removes reactions", async () => {
    mockFetch
      .mockResolvedValueOnce(
        telegramOk({
          id: 999,
          is_bot: true,
          first_name: "Bot",
          username: "mybot",
        })
      )
      .mockResolvedValueOnce(telegramOk(true))
      .mockResolvedValueOnce(telegramOk(true));

    const adapter = createTelegramAdapter({
      botToken: "token",
      logger: mockLogger,
      userName: "mybot",
    });

    await adapter.initialize(createMockChat());

    await adapter.addReaction("telegram:123", "123:11", "thumbs_up");
    await adapter.removeReaction("telegram:123", "123:11", "thumbs_up");

    const addBody = JSON.parse(
      String((mockFetch.mock.calls[1]?.[1] as RequestInit).body)
    ) as {
      reaction: Array<{ type: string; emoji?: string }>;
    };
    const removeBody = JSON.parse(
      String((mockFetch.mock.calls[2]?.[1] as RequestInit).body)
    ) as {
      reaction: unknown[];
    };

    expect(addBody.reaction[0]).toEqual({ type: "emoji", emoji: "👍" });
    expect(removeBody.reaction).toEqual([]);
  });

  it("paginates cached messages", async () => {
    mockFetch.mockResolvedValueOnce(
      telegramOk({
        id: 999,
        is_bot: true,
        first_name: "Bot",
        username: "mybot",
      })
    );

    const adapter = createTelegramAdapter({
      botToken: "token",
      logger: mockLogger,
      userName: "mybot",
    });

    await adapter.initialize(createMockChat());

    adapter.parseMessage(sampleMessage({ message_id: 1, text: "m1", date: 1 }));
    adapter.parseMessage(sampleMessage({ message_id: 2, text: "m2", date: 2 }));
    adapter.parseMessage(sampleMessage({ message_id: 3, text: "m3", date: 3 }));

    const backward = await adapter.fetchMessages("telegram:123", {
      limit: 2,
      direction: "backward",
    });

    expect(backward.messages.map((message) => message.text)).toEqual([
      "m2",
      "m3",
    ]);
    expect(backward.nextCursor).toBe("123:2");

    const forward = await adapter.fetchMessages("telegram:123", {
      limit: 2,
      direction: "forward",
    });

    expect(forward.messages.map((message) => message.text)).toEqual([
      "m1",
      "m2",
    ]);
    expect(forward.nextCursor).toBe("123:2");
  });
});
