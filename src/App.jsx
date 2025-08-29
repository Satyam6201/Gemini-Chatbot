import { useEffect, useRef, useState } from "react";
import Message from "./components/Message";
import PromptForm from "./components/PromptForm";
import Sidebar from "./components/Sidebar";
import { Menu } from "lucide-react";

const App = () => {
  // Main app state
  const [isLoading, setIsLoading] = useState(false);
  const typingInterval = useRef(null);
  const messagesContainerRef = useRef(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth > 768);

  // Theme setup
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) return savedTheme;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  });

  // Conversations
  const [conversations, setConversations] = useState(() => {
    try {
      const saved = localStorage.getItem("conversations");
      return saved ? JSON.parse(saved) : [{ id: "default", title: "New Chat", messages: [] }];
    } catch {
      return [{ id: "default", title: "New Chat", messages: [] }];
    }
  });

  const [activeConversation, setActiveConversation] = useState(() => {
    return localStorage.getItem("activeConversation") || "default";
  });

  // Persist active conversation
  useEffect(() => {
    localStorage.setItem("activeConversation", activeConversation);
  }, [activeConversation]);

  // Save conversations to localStorage
  useEffect(() => {
    localStorage.setItem("conversations", JSON.stringify(conversations));
  }, [conversations]);

  // Handle theme changes
  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Get current active conversation
  const currentConversation = conversations.find((c) => c.id === activeConversation) || conversations[0];

  // Scroll to bottom of container
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  // Effect to scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [conversations, activeConversation]);

  // Typing effect for bot messages
  const typingEffect = (text, messageId) => {
    let textElement = document.querySelector(`#${messageId} .text`);
    if (!textElement) return;

    // Initially set message empty
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === activeConversation
          ? {
              ...conv,
              messages: conv.messages.map((msg) =>
                msg.id === messageId ? { ...msg, content: "", loading: true } : msg
              ),
            }
          : conv
      )
    );

    textElement.textContent = "";
    const words = text.split(" ");
    let wordIndex = 0;
    let currentText = "";
    clearInterval(typingInterval.current);

    typingInterval.current = setInterval(() => {
      if (wordIndex < words.length) {
        currentText += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
        textElement.textContent = currentText;

        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === activeConversation
              ? {
                  ...conv,
                  messages: conv.messages.map((msg) =>
                    msg.id === messageId ? { ...msg, content: currentText, loading: true } : msg
                  ),
                }
              : conv
          )
        );
        scrollToBottom();
      } else {
        clearInterval(typingInterval.current);
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === activeConversation
              ? {
                  ...conv,
                  messages: conv.messages.map((msg) =>
                    msg.id === messageId ? { ...msg, content: currentText, loading: false } : msg
                  ),
                }
              : conv
          )
        );
        setIsLoading(false);
      }
    }, 40);
  };

  // Generate AI response
  const generateResponse = async (conversation, botMessageId) => {
    const API_URL = import.meta.env.VITE_API_URL;
    const API_KEY = import.meta.env.VITE_API_KEY;

    // Format messages for API
    const formattedMessages = conversation.messages?.map((msg) => ({
      role: msg.role === "bot" ? "model" : msg.role,
      parts: [{ text: msg.content }],
    }));

    try {
      const res = await fetch(`${API_URL}?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: formattedMessages }),
      });

      const text = await res.text();
      // console.log("Raw API response:", text);s

      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data.error?.message || "API request failed");

      const responseText = data.candidates[0].content.parts[0].text
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .trim();

      typingEffect(responseText, botMessageId);
    } catch (error) {
      setIsLoading(false);
      // Update bot message with error
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeConversation
            ? {
                ...conv,
                messages: conv.messages.map((msg) =>
                  msg.id === botMessageId
                    ? { ...msg, content: error.message, error: true, loading: false }
                    : msg
                ),
              }
            : conv
        )
      );
    }
  };

  return (
    <div className={`app-container ${theme === "light" ? "light-theme" : "dark-theme"}`}>
      <div
        className={`overlay ${isSidebarOpen ? "show" : "hide"}`}
        onClick={() => setIsSidebarOpen(false)}
      ></div>

      <Sidebar
        conversations={conversations}
        setConversations={setConversations}
        activeConversation={activeConversation}
        setActiveConversation={setActiveConversation}
        theme={theme}
        setTheme={setTheme}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      <main className="main-container">
        <header className="main-header">
          <button onClick={() => setIsSidebarOpen(true)} className="sidebar-toggle">
            <Menu size={18} />
          </button>
        </header>

        {currentConversation.messages.length === 0 ? (
          <div className="welcome-container">
            <img className="welcome-logo" src="gemini-chatbot-logo.svg" alt="Gemini Logo" />
            <h1 className="welcome-heading">Message Gemini</h1>
            <p className="welcome-text">Ask me anything about any topic. I'm here to help!</p>
          </div>
        ) : (
          <div className="messages-container" ref={messagesContainerRef}>
            {currentConversation.messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
          </div>
        )}

        <div className="prompt-container">
          <div className="prompt-wrapper">
            <PromptForm
              conversations={conversations}
              setConversations={setConversations}
              activeConversation={activeConversation}
              generateResponse={generateResponse}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          </div>
          <p className="disclaimer-text">Gemini can make mistakes, so double-check it.</p>
        </div>
      </main>
    </div>
  );
};

export default App;
