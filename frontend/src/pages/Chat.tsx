import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import api from "../api/axios";
import MainLayout from "../layout/MainLayout";

// =====================================================
// TYPES
// =====================================================

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface Friend {
  id: number;
  first_name: string;
  last_name: string;
  profile_picture: string | null;
  online?: boolean;
}

interface WebSocketMessage {
  type: "connected" | "message" | "error";

  id?: number;
  sender_id?: number;
  receiver_id?: number;
  content?: string;
  is_read?: boolean;
  created_at?: string;

  user_id?: number;
  message?: string;
}

// =====================================================
// COMPONENT
// =====================================================

function Chat() {
  const { userId } = useParams<{
    userId: string;
  }>();

  const navigate = useNavigate();

  const friendId = Number(userId);

  // =====================================================
  // STATE
  // =====================================================

  const [currentUserId, setCurrentUserId] =
    useState<number | null>(null);

  const [friend, setFriend] =
    useState<Friend | null>(null);

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [text, setText] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [connected, setConnected] =
    useState(false);

  const [socketError, setSocketError] =
    useState<string | null>(null);

  // =====================================================
  // REFS
  // =====================================================

  const socketRef =
    useRef<WebSocket | null>(null);

  const reconnectTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const reconnectAttemptsRef =
    useRef(0);

  const shouldReconnectRef =
    useRef(true);

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  /*
   * Every WebSocket receives a generation number.
   *
   * This prevents an old socket from changing the
   * state of a newer socket after reconnecting.
   */
  const socketGenerationRef =
    useRef(0);

  /*
   * Prevents sending while a message is waiting for
   * the backend response.
   */
  const sendingTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  // =====================================================
  // GET TOKEN
  // =====================================================

  const getToken = useCallback((): string | null => {
    const token =
      localStorage.getItem("token");

    if (token) {
      return token;
    }

    return localStorage.getItem(
      "access_token"
    );
  }, []);

  // =====================================================
  // VALIDATE FRIEND ID
  // =====================================================

  const isValidFriendId =
    Number.isInteger(friendId) &&
    friendId > 0;

  // =====================================================
  // LOAD CURRENT USER
  // =====================================================

  const loadCurrentUser =
    useCallback(async () => {
      try {
        const response =
          await api.get("/users/me");

        const userIdFromServer =
          Number(response.data.id);

        console.log(
          "[Chat] Current user:",
          response.data
        );

        if (
          !Number.isInteger(
            userIdFromServer
          ) ||
          userIdFromServer <= 0
        ) {
          console.error(
            "[Chat] Invalid current user ID:",
            response.data.id
          );

          setSocketError(
            "Unable to identify your account."
          );

          return;
        }

        setCurrentUserId(
          userIdFromServer
        );
      } catch (error: any) {
        console.error(
          "[Chat] Failed to load current user:",
          error
        );

        if (
          error.response?.status === 401
        ) {
          localStorage.removeItem(
            "token"
          );

          localStorage.removeItem(
            "access_token"
          );

          navigate("/login");
        }
      }
    }, [navigate]);

  // =====================================================
  // LOAD FRIEND
  // =====================================================

  const loadFriend =
    useCallback(async () => {
      if (!isValidFriendId) {
        navigate("/messages");
        return;
      }

      try {
        const response =
          await api.get(
            `/users/${friendId}`
          );

        console.log(
          "[Chat] Friend:",
          response.data
        );

        setFriend(
          response.data
        );
      } catch (error: any) {
        console.error(
          "[Chat] Failed to load friend:",
          error
        );

        if (
          error.response?.status === 401
        ) {
          navigate("/login");
          return;
        }

        if (
          error.response?.status === 404
        ) {
          alert(
            "User not found."
          );

          navigate("/messages");
        }
      }
    }, [
      friendId,
      navigate,
      isValidFriendId,
    ]);

  // =====================================================
  // LOAD OLD MESSAGES
  // =====================================================

  const loadMessages =
    useCallback(async () => {
      if (!isValidFriendId) {
        return;
      }

      try {
        setLoading(true);

        const response =
          await api.get(
            `/messages/${friendId}`
          );

        console.log(
          "[Chat] Old messages:",
          response.data
        );

        if (
          Array.isArray(
            response.data
          )
        ) {
          setMessages(
            response.data
          );
        } else {
          setMessages([]);
        }

        // -----------------------------------------------
        // MARK MESSAGES AS READ
        // -----------------------------------------------

        try {
          await api.put(
            `/messages/${friendId}/read`
          );
        } catch (error) {
          console.warn(
            "[Chat] Could not mark messages as read:",
            error
          );
        }
      } catch (error: any) {
        console.error(
          "[Chat] Failed to load messages:",
          error
        );

        setMessages([]);

        if (
          error.response?.status === 401
        ) {
          navigate("/login");
          return;
        }

        if (
          error.response?.status === 403
        ) {
          alert(
            "You can only chat with accepted friends."
          );

          navigate("/messages");
        }
      } finally {
        setLoading(false);
      }
    }, [
      friendId,
      navigate,
      isValidFriendId,
    ]);

  // =====================================================
  // WEBSOCKET URL
  // =====================================================

  const getWebSocketUrl =
    useCallback(
      (token: string): string => {
        /*
         * Browser:
         * http://localhost:5173
         *
         * Backend:
         * http://localhost:8000
         *
         * WebSocket:
         * ws://localhost:8000/chat/ws
         */

        const protocol =
          window.location.protocol ===
          "https:"
            ? "wss:"
            : "ws:";

        /*
         * If frontend is opened using localhost,
         * use localhost for backend.
         *
         * If frontend is opened using 127.0.0.1,
         * use 127.0.0.1 for backend.
         */

        const hostname =
          window.location.hostname;

        const backendHost =
          hostname === "localhost"
            ? "localhost"
            : "127.0.0.1";

        return (
          `${protocol}//${backendHost}:8000/chat/ws` +
          `?token=${encodeURIComponent(token)}`
        );
      },
      []
    );

  // =====================================================
  // HANDLE WEBSOCKET DATA
  // =====================================================

  const handleWebSocketMessage =
    useCallback(
      (data: WebSocketMessage) => {
        console.log(
          "[Chat] WebSocket data:",
          data
        );

        // =================================================
        // CONNECTED
        // =================================================

        if (
          data.type === "connected"
        ) {
          console.log(
            "[Chat] WebSocket authenticated."
          );

          console.log(
            "[Chat] Backend user ID:",
            data.user_id
          );

          setConnected(true);

          setSocketError(null);

          reconnectAttemptsRef.current =
            0;

          return;
        }

        // =================================================
        // BACKEND ERROR
        // =================================================

        if (
          data.type === "error"
        ) {
          console.error(
            "[Chat] WebSocket backend error:",
            data.message
          );

          setSending(false);

          if (
            sendingTimeoutRef.current
          ) {
            clearTimeout(
              sendingTimeoutRef.current
            );

            sendingTimeoutRef.current =
              null;
          }

          setSocketError(
            data.message ||
              "Unable to process chat request."
          );

          return;
        }

        // =================================================
        // MESSAGE
        // =================================================

        if (
          data.type !== "message"
        ) {
          return;
        }

        // -----------------------------------------------
        // VALIDATE MESSAGE
        // -----------------------------------------------

        if (
          data.id === undefined ||
          data.sender_id === undefined ||
          data.receiver_id === undefined ||
          data.content === undefined ||
          !data.created_at
        ) {
          console.warn(
            "[Chat] Invalid message received:",
            data
          );

          return;
        }

        const incomingMessage: Message = {
          id: Number(data.id),

          sender_id:
            Number(data.sender_id),

          receiver_id:
            Number(data.receiver_id),

          content:
            String(data.content),

          is_read:
            Boolean(
              data.is_read
            ),

          created_at:
            String(
              data.created_at
            ),
        };

        // =================================================
        // CURRENT USER REQUIRED
        // =================================================

        if (
          currentUserId === null
        ) {
          console.warn(
            "[Chat] Current user ID is not ready."
          );

          return;
        }

        // =================================================
        // CHECK CONVERSATION
        // =================================================

        const belongsToConversation =
          (
            incomingMessage.sender_id ===
              currentUserId &&
            incomingMessage.receiver_id ===
              friendId
          ) ||
          (
            incomingMessage.sender_id ===
              friendId &&
            incomingMessage.receiver_id ===
              currentUserId
          );

        if (
          !belongsToConversation
        ) {
          console.log(
            "[Chat] Ignoring message from another conversation."
          );

          return;
        }

        // =================================================
        // ADD MESSAGE WITHOUT DUPLICATE
        // =================================================

        setMessages(
          previousMessages => {
            const exists =
              previousMessages.some(
                message =>
                  message.id ===
                  incomingMessage.id
              );

            if (exists) {
              return previousMessages;
            }

            return [
              ...previousMessages,
              incomingMessage,
            ];
          }
        );

        // =================================================
        // MESSAGE SENT BY CURRENT USER
        // =================================================

        if (
          incomingMessage.sender_id ===
          currentUserId
        ) {
          setText("");

          setSending(false);

          if (
            sendingTimeoutRef.current
          ) {
            clearTimeout(
              sendingTimeoutRef.current
            );

            sendingTimeoutRef.current =
              null;
          }
        }

        // =================================================
        // MESSAGE RECEIVED FROM FRIEND
        // =================================================

        if (
          incomingMessage.sender_id ===
            friendId &&
          incomingMessage.receiver_id ===
            currentUserId
        ) {
          api
            .put(
              `/messages/${friendId}/read`
            )
            .catch(error => {
              console.warn(
                "[Chat] Could not mark incoming message as read:",
                error
              );
            });
        }
      },
      [
        currentUserId,
        friendId,
      ]
    );

  // =====================================================
  // CONNECT WEBSOCKET
  // =====================================================

  const connectWebSocket =
    useCallback(() => {
      const token =
        getToken();

      // =================================================
      // TOKEN CHECK
      // =================================================

      if (!token) {
        console.error(
          "[Chat] No authentication token."
        );

        setConnected(false);

        setSocketError(
          "You are not authenticated."
        );

        navigate("/login");

        return;
      }

      // =================================================
      // CURRENT USER CHECK
      // =================================================

      if (
        currentUserId === null
      ) {
        console.log(
          "[Chat] Waiting for current user..."
        );

        return;
      }

      // =================================================
      // FRIEND CHECK
      // =================================================

      if (!isValidFriendId) {
        console.error(
          "[Chat] Invalid friend ID:",
          friendId
        );

        return;
      }

      // =================================================
      // EXISTING SOCKET CHECK
      // =================================================

      if (
        socketRef.current &&
        (
          socketRef.current.readyState ===
            WebSocket.OPEN ||
          socketRef.current.readyState ===
            WebSocket.CONNECTING
        )
      ) {
        console.log(
          "[Chat] WebSocket already open/connecting."
        );

        return;
      }

      // =================================================
      // CLEAR RECONNECT TIMER
      // =================================================

      if (
        reconnectTimerRef.current
      ) {
        clearTimeout(
          reconnectTimerRef.current
        );

        reconnectTimerRef.current =
          null;
      }

      // =================================================
      // NEW SOCKET GENERATION
      // =================================================

      const generation =
        ++socketGenerationRef.current;

      // =================================================
      // BUILD URL
      // =================================================

      const wsUrl =
        getWebSocketUrl(token);

      /*
       * NEVER print the real JWT token.
       */

      const safeUrl =
        wsUrl.replace(
          token,
          "***TOKEN***"
        );

      console.log(
        "================================================="
      );

      console.log(
        "[Chat] Creating WebSocket connection..."
      );

      console.log(
        "[Chat] URL:",
        safeUrl
      );

      console.log(
        "[Chat] Current user:",
        currentUserId
      );

      console.log(
        "[Chat] Friend ID:",
        friendId
      );

      console.log(
        "[Chat] Token exists:",
        Boolean(token)
      );

      console.log(
        "================================================="
      );

      setSocketError(null);

      // =================================================
      // CREATE SOCKET
      // =================================================

      let ws: WebSocket;

      try {
        ws =
          new WebSocket(wsUrl);
      } catch (error) {
        console.error(
          "[Chat] Failed to create WebSocket:",
          error
        );

        setConnected(false);

        setSocketError(
          "Could not create real-time connection."
        );

        return;
      }

      socketRef.current =
        ws;

      // =================================================
      // CONNECTION TIMEOUT
      // =================================================

      const connectionTimeout =
        setTimeout(() => {
          if (
            generation !==
            socketGenerationRef.current
          ) {
            return;
          }

          if (
            ws.readyState ===
            WebSocket.CONNECTING
          ) {
            console.warn(
              "[Chat] WebSocket connection timed out."
            );

            setSocketError(
              "Real-time server did not respond."
            );

            ws.close();
          }
        }, 10000);

      // =================================================
      // OPEN
      // =================================================

      ws.onopen = () => {
        clearTimeout(
          connectionTimeout
        );

        if (
          generation !==
          socketGenerationRef.current
        ) {
          return;
        }

        console.log(
          "[Chat] WebSocket connection opened."
        );

        /*
         * IMPORTANT:
         *
         * We do NOT immediately mark the chat
         * as connected.
         *
         * The backend must first send:
         *
         * {
         *   "type": "connected",
         *   "user_id": ...
         * }
         *
         * Then handleWebSocketMessage()
         * changes connected to true.
         */
      };

      // =================================================
      // MESSAGE
      // =================================================

      ws.onmessage =
        event => {
          if (
            generation !==
            socketGenerationRef.current
          ) {
            console.warn(
              "[Chat] Ignoring message from old socket."
            );

            return;
          }

          try {
            const data:
              WebSocketMessage =
              JSON.parse(
                event.data
              );

            handleWebSocketMessage(
              data
            );
          } catch (error) {
            console.error(
              "[Chat] Invalid WebSocket response:",
              error
            );

            console.error(
              "[Chat] Raw response:",
              event.data
            );
          }
        };

      // =================================================
      // ERROR
      // =================================================

      ws.onerror =
        error => {
          if (
            generation !==
            socketGenerationRef.current
          ) {
            return;
          }

          console.error(
            "[Chat] WebSocket error:",
            error
          );

          console.error(
            "[Chat] WebSocket URL:",
            safeUrl
          );

          setConnected(false);

          setSocketError(
            "Real-time connection error."
          );
        };

      // =================================================
      // CLOSE
      // =================================================

      ws.onclose =
        event => {
          clearTimeout(
            connectionTimeout
          );

          if (
            generation !==
            socketGenerationRef.current
          ) {
            console.log(
              "[Chat] Old WebSocket closed."
            );

            return;
          }

          console.warn(
            "[Chat] WebSocket closed:",
            {
              code: event.code,
              reason: event.reason,
              wasClean: event.wasClean,
            }
          );

          setConnected(false);

          if (
            socketRef.current ===
            ws
          ) {
            socketRef.current =
              null;
          }

          // ---------------------------------------------
          // STOP RECONNECTING IF COMPONENT IS GONE
          // ---------------------------------------------

          if (
            !shouldReconnectRef.current
          ) {
            console.log(
              "[Chat] Reconnection disabled."
            );

            return;
          }

          // ---------------------------------------------
          // AUTHENTICATION FAILURE
          // ---------------------------------------------

          if (
            event.code === 1008
          ) {
            console.error(
              "[Chat] Backend rejected WebSocket."
            );

            console.error(
              "[Chat] Reason:",
              event.reason
            );

            setSocketError(
              event.reason ||
                "WebSocket authentication failed."
            );

            return;
          }

          // ---------------------------------------------
          // NORMAL CLOSURE
          // ---------------------------------------------

          if (
            event.code === 1000
          ) {
            console.log(
              "[Chat] WebSocket closed normally."
            );

            return;
          }

          // ---------------------------------------------
          // RECONNECT
          // ---------------------------------------------

          const attempts =
            reconnectAttemptsRef.current;

          const delay =
            Math.min(
              1000 *
                Math.pow(
                  2,
                  attempts
                ),
              10000
            );

          reconnectAttemptsRef.current =
            attempts + 1;

          console.log(
            `[Chat] Reconnecting in ${delay}ms...`
          );

          if (
            reconnectTimerRef.current
          ) {
            clearTimeout(
              reconnectTimerRef.current
            );
          }

          reconnectTimerRef.current =
            setTimeout(() => {
              reconnectTimerRef.current =
                null;

              if (
                shouldReconnectRef.current
              ) {
                connectWebSocket();
              }
            }, delay);
        };
    }, [
      currentUserId,
      friendId,
      getToken,
      getWebSocketUrl,
      handleWebSocketMessage,
      navigate,
      isValidFriendId,
    ]);

  // =====================================================
  // INITIALIZE CHAT
  // =====================================================

  useEffect(() => {
    if (!isValidFriendId) {
      navigate("/messages");
      return;
    }

    console.log(
      "[Chat] Initializing conversation with user:",
      friendId
    );

    shouldReconnectRef.current =
      true;

    reconnectAttemptsRef.current =
      0;

    loadCurrentUser();

    loadFriend();

    loadMessages();

    return () => {
      console.log(
        "[Chat] Cleaning up chat component..."
      );

      shouldReconnectRef.current =
        false;

      /*
       * Invalidate every old WebSocket.
       */
      socketGenerationRef.current +=
        1;

      // -----------------------------------------------
      // CLEAR RECONNECT TIMER
      // -----------------------------------------------

      if (
        reconnectTimerRef.current
      ) {
        clearTimeout(
          reconnectTimerRef.current
        );

        reconnectTimerRef.current =
          null;
      }

      // -----------------------------------------------
      // CLEAR SENDING TIMEOUT
      // -----------------------------------------------

      if (
        sendingTimeoutRef.current
      ) {
        clearTimeout(
          sendingTimeoutRef.current
        );

        sendingTimeoutRef.current =
          null;
      }

      // -----------------------------------------------
      // CLOSE SOCKET
      // -----------------------------------------------

      if (
        socketRef.current
      ) {
        const socket =
          socketRef.current;

        socketRef.current =
          null;

        if (
          socket.readyState ===
            WebSocket.OPEN ||
          socket.readyState ===
            WebSocket.CONNECTING
        ) {
          try {
            socket.close(
              1000,
              "Chat component closed"
            );
          } catch (error) {
            console.warn(
              "[Chat] Error closing WebSocket:",
              error
            );
          }
        }
      }

      setConnected(false);
    };
  }, [
    friendId,
    navigate,
    loadCurrentUser,
    loadFriend,
    loadMessages,
    isValidFriendId,
  ]);

  // =====================================================
  // CONNECT AFTER CURRENT USER LOADS
  // =====================================================

  useEffect(() => {
    if (
      currentUserId === null
    ) {
      return;
    }

    console.log(
      "[Chat] Current user loaded. Starting WebSocket..."
    );

    connectWebSocket();
  }, [
    currentUserId,
    connectWebSocket,
  ]);

  // =====================================================
  // AUTO SCROLL
  // =====================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // =====================================================
  // SEND MESSAGE
  // =====================================================

  function sendMessage() {
    const messageText =
      text.trim();

    // -----------------------------------------------
    // EMPTY
    // -----------------------------------------------

    if (!messageText) {
      return;
    }

    // -----------------------------------------------
    // FRIEND ID
    // -----------------------------------------------

    if (!isValidFriendId) {
      setSocketError(
        "Invalid friend."
      );

      return;
    }

    // -----------------------------------------------
    // LENGTH
    // -----------------------------------------------

    if (
      messageText.length > 5000
    ) {
      alert(
        "Message cannot exceed 5000 characters."
      );

      return;
    }

    // -----------------------------------------------
    // ALREADY SENDING
    // -----------------------------------------------

    if (sending) {
      return;
    }

    // -----------------------------------------------
    // SOCKET
    // -----------------------------------------------

    const socket =
      socketRef.current;

    if (
      !socket ||
      socket.readyState !==
        WebSocket.OPEN
    ) {
      console.warn(
        "[Chat] Cannot send. WebSocket is not open."
      );

      setSocketError(
        "Chat is not connected yet. Please wait a moment."
      );

      return;
    }

    // -----------------------------------------------
    // SEND
    // -----------------------------------------------

    try {
      setSending(true);

      setSocketError(null);

      const payload = {
        type: "message",

        receiver_id:
          friendId,

        content:
          messageText,
      };

      console.log(
        "[Chat] Sending message:",
        payload
      );

      socket.send(
        JSON.stringify(
          payload
        )
      );

      /*
       * Safety timeout.
       *
       * Normally the backend response clears
       * sending=false.
       *
       * If the response never comes, prevent the
       * Send button from being permanently locked.
       */

      if (
        sendingTimeoutRef.current
      ) {
        clearTimeout(
          sendingTimeoutRef.current
        );
      }

      sendingTimeoutRef.current =
        setTimeout(() => {
          console.warn(
            "[Chat] Message response timeout."
          );

          setSending(false);

          sendingTimeoutRef.current =
            null;
        }, 10000);
    } catch (error) {
      console.error(
        "[Chat] Failed to send message:",
        error
      );

      setSending(false);

      setSocketError(
        "Unable to send message."
      );
    }
  }

  // =====================================================
  // ENTER KEY
  // =====================================================

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (
      event.key === "Enter"
    ) {
      event.preventDefault();

      if (!sending) {
        sendMessage();
      }
    }
  }

  // =====================================================
  // PROFILE IMAGE
  // =====================================================

  function getProfileImage(
    user: Friend
  ): string {
    if (
      user.profile_picture
    ) {
      if (
        user.profile_picture.startsWith(
          "http"
        )
      ) {
        return user.profile_picture;
      }

      return (
        `http://127.0.0.1:8000` +
        `${user.profile_picture}`
      );
    }

    return (
      `https://ui-avatars.com/api/?name=` +
      `${encodeURIComponent(
        `${user.first_name} ${user.last_name}`
      )}` +
      `&background=dc2626&color=ffffff`
    );
  }

  // =====================================================
  // FORMAT TIME
  // =====================================================

  function formatTime(
    date: string
  ): string {
    const parsedDate =
      new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return "";
    }

    return parsedDate.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <MainLayout>

      <div className="bg-white rounded-2xl shadow-md overflow-hidden">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex items-center gap-4 p-5 border-b">

          <button
            type="button"
            onClick={() =>
              navigate("/messages")
            }
            className="text-2xl text-gray-600 hover:text-red-600 transition"
            aria-label="Back to messages"
          >
            ←
          </button>

          {friend && (
            <>

              {/* PROFILE */}

              <div className="relative">

                <img
                  src={getProfileImage(
                    friend
                  )}
                  alt={`${friend.first_name} ${friend.last_name}`}
                  className="w-12 h-12 rounded-full object-cover border"
                  onError={event => {
                    event.currentTarget.src =
                      `https://ui-avatars.com/api/?name=` +
                      `${encodeURIComponent(
                        `${friend.first_name} ${friend.last_name}`
                      )}` +
                      `&background=dc2626&color=ffffff`;
                  }}
                />

                {connected && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                )}

              </div>

              {/* USER INFORMATION */}

              <div className="flex-1">

                <h1 className="font-bold text-lg text-gray-800">

                  {friend.first_name}{" "}

                  {friend.last_name}

                </h1>

                <div className="flex items-center gap-2">

                  <span
                    className={`w-2 h-2 rounded-full ${
                      connected
                        ? "bg-green-500"
                        : "bg-gray-400"
                    }`}
                  />

                  <span className="text-sm text-gray-500">

                    {connected
                      ? "Online"
                      : "Connecting..."}

                  </span>

                </div>

              </div>

            </>
          )}

        </div>

        {/* =================================================
            SOCKET ERROR
        ================================================= */}

        {socketError && (

          <div className="px-5 py-2 bg-yellow-50 border-b border-yellow-200">

            <p className="text-xs text-yellow-700">

              {socketError}

            </p>

          </div>

        )}

        {/* =================================================
            MESSAGES
        ================================================= */}

        <div className="h-[500px] overflow-y-auto bg-gray-50 p-5">

          {/* LOADING */}

          {loading && (

            <div className="flex items-center justify-center h-full">

              <div className="text-center">

                <div className="text-4xl mb-3">
                  💬
                </div>

                <p className="text-gray-500">
                  Loading conversation...
                </p>

              </div>

            </div>

          )}

          {/* EMPTY */}

          {!loading &&
            messages.length === 0 && (

              <div className="flex items-center justify-center h-full text-center">

                <div>

                  <div className="text-5xl mb-4">
                    👋
                  </div>

                  <h2 className="text-xl font-semibold text-gray-700">

                    Start a conversation

                  </h2>

                  <p className="text-gray-500 mt-2">

                    Send a message to{" "}

                    {friend?.first_name ||
                      "your friend"}.

                  </p>

                </div>

              </div>

            )}

          {/* MESSAGE LIST */}

          {!loading &&
            messages.length > 0 && (

              <div className="space-y-3">

                {messages.map(
                  item => {

                    const isMine =
                      item.sender_id ===
                      currentUserId;

                    return (

                      <div
                        key={item.id}
                        className={`flex ${
                          isMine
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >

                        <div
                          className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                            isMine
                              ? "bg-red-600 text-white rounded-br-md"
                              : "bg-white text-gray-800 shadow-sm rounded-bl-md"
                          }`}
                        >

                          <p className="whitespace-pre-wrap break-words">

                            {item.content}

                          </p>

                          <div
                            className={`text-xs mt-1 ${
                              isMine
                                ? "text-red-100"
                                : "text-gray-400"
                            }`}
                          >

                            {formatTime(
                              item.created_at
                            )}

                            {isMine &&
                              item.is_read && (

                                <span className="ml-1">
                                  ✓✓
                                </span>

                              )}

                          </div>

                        </div>

                      </div>

                    );
                  }
                )}

                <div
                  ref={messagesEndRef}
                />

              </div>

            )}

        </div>

        {/* =================================================
            MESSAGE INPUT
        ================================================= */}

        <div className="p-4 border-t bg-white">

          <div className="flex gap-3">

            <input
              type="text"
              value={text}
              onChange={event =>
                setText(
                  event.target.value
                )
              }
              onKeyDown={
                handleKeyDown
              }
              maxLength={5000}
              placeholder={
                friend
                  ? `Message ${friend.first_name}...`
                  : "Write a message..."
              }
              disabled={
                !connected ||
                sending
              }
              className="flex-1 min-w-0 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
            />

            <button
              type="button"
              onClick={
                sendMessage
              }
              disabled={
                sending ||
                !text.trim() ||
                !connected
              }
              className="bg-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >

              {sending
                ? "Sending..."
                : "Send"}

            </button>

          </div>

          {!connected && (

            <p className="text-xs text-gray-400 mt-2">

              Connecting to chat server...

            </p>

          )}

          {text.length > 0 && (

            <p className="text-xs text-gray-400 mt-1 text-right">

              {text.length}/5000

            </p>

          )}

        </div>

      </div>

    </MainLayout>
  );
}

export default Chat;