"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { MessageSquare, X, Send, Sparkles, RefreshCw, ShoppingBag } from "lucide-react";

/**
 * OfertyChatWidget
 * Componente flotante para oferty-web
 * 
 * Reglas clave:
 * 1. Solo visible en la web pública (se auto-excluye de /admin)
 * 2. Asistente especializado en productos y comparador de Oferty
 * 3. Restrictivo contra consultas capciosas o fuera de lugar
 */

const INITIAL_MESSAGE = {
  role: "assistant",
  content: "¡Hola! Soy Oferty, tu asistente de compras inteligentes 🛍️\n\nPuedo ayudarte a comparar precios, encontrar los mejores descuentos en tiendas de Colombia (Mercado Libre, Falabella, Éxito, Alkosto, etc.) o explicarte cómo funciona el comparador.\n\n¿Qué producto o precio te gustaría consultar hoy?",
  action: null,
  timestamp: new Date().toISOString()
};

const DEFAULT_SUGGESTIONS = [
  "¿Qué celular tiene mejor descuento?",
  "¿Cómo compara tiendas Oferty?",
  "Comparar precios de televisores",
  "¿Qué tiendas monitorea Oferty?"
];

export default function OfertyChatWidget({ 
  // Puede apuntar al endpoint local de oferty-backend o directo al proxy
  apiEndpoint = process.env.NEXT_PUBLIC_CHAT_API_URL || "/api/chat" 
}) {
  const pathname = usePathname();
  // REGLA OBLIGATORIA: Nunca renderizar en rutas administrativas
  const isAdminRoute = pathname?.startsWith("/admin");

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [hasUnread, setHasUnread] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Inicializar o restaurar sesión
  useEffect(() => {
    if (isAdminRoute) return;
    try {
      let storedSession = localStorage.getItem("oferty_chat_session");
      if (!storedSession) {
        storedSession = "sess_oferty_" + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
        localStorage.setItem("oferty_chat_session", storedSession);
      }
      setSessionId(storedSession);

      const savedMessages = localStorage.getItem("oferty_chat_msgs");
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          setHasUnread(false);
        }
      }
    } catch {
      // Fallback
    }
  }, [isAdminRoute]);

  // Guardar mensajes localmente
  useEffect(() => {
    if (messages.length > 1) {
      try {
        localStorage.setItem("oferty_chat_msgs", JSON.stringify(messages.slice(-20)));
      } catch {
        // Fallback
      }
    }
  }, [messages]);

  // Scroll automático
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHasUnread(false);
    }
  };

  const handleSendMessage = async (textToSend = null) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    setInputText("");

    const userMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: "oferty",
          sessionId,
          message: text,
          history: newMessages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          channel: "web"
        })
      });

      const data = await response.json();

      if (data.success && data.data) {
        const botMessage = {
          role: "assistant",
          content: data.data.reply,
          action: data.data.action,
          actionData: data.data.actionData,
          quickSuggestions: data.data.quickSuggestions,
          timestamp: new Date().toISOString()
        };
        setMessages([...newMessages, botMessage]);
      } else {
        throw new Error(data.message || "Error al procesar el mensaje");
      }
    } catch (err) {
      console.error("[OfertyChat] Error comunicando con el bot:", err);
      const errorMessage = {
        role: "assistant",
        content: "En este momento estoy consultando las tiendas y ofertas en tiempo real. Por favor prueba preguntarme nuevamente o visita directamente las ofertas en Oferty.",
        timestamp: new Date().toISOString()
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReset = () => {
    const newSess = "sess_oferty_" + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    setSessionId(newSess);
    setMessages([INITIAL_MESSAGE]);
    try {
      localStorage.setItem("oferty_chat_session", newSess);
      localStorage.removeItem("oferty_chat_msgs");
    } catch {
      // Fallback
    }
  };

  const lastSuggestions = messages[messages.length - 1]?.quickSuggestions || DEFAULT_SUGGESTIONS;

  // Si está en /admin, no se renderiza nada
  if (isAdminRoute) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* Botón Flotante con Tooltip "¡Hola! Pregúntale a Oferty" */}
      {!isOpen && (
        <div className="relative group flex items-center">
          {hasUnread && (
            <div className="absolute right-full mr-3.5 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl border border-indigo-100 flex items-center gap-2 whitespace-nowrap animate-bounce">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-semibold text-slate-800">
                ¡Hola! Pregúntale a <strong className="text-indigo-600">Oferty</strong> 🛍️
              </span>
              <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white rotate-45 border-t border-r border-indigo-100" />
            </div>
          )}

          <button
            onClick={handleToggle}
            aria-label="Abrir chat con Oferty"
            className="relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-700 to-orange-500 shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 p-0.5 group focus:outline-none focus:ring-4 focus:ring-indigo-300"
          >
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden relative p-1.5 shadow-inner">
              <Image
                src="/images/logo-oferty.png"
                alt="Logo Oferty"
                width={52}
                height={52}
                unoptimized
                className="object-contain w-full h-full transition-transform duration-300 group-hover:scale-110"
                priority
              />
            </div>
            <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow" />
          </button>
        </div>
      )}

      {/* Ventana de Chat */}
      {isOpen && (
        <div className="w-[92vw] sm:w-[420px] h-[600px] max-h-[85vh] bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-indigo-100/80 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-orange-500 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-full bg-white p-1 border border-white/40 overflow-hidden flex-shrink-0 shadow-sm">
                <Image
                  src="/images/logo-oferty.png"
                  alt="Oferty"
                  width={40}
                  height={40}
                  unoptimized
                  className="object-contain w-full h-full"
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-indigo-900 rounded-full" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm tracking-wide">Oferty</h3>
                  <span className="text-[10px] font-medium bg-white/20 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    Asistente IA
                  </span>
                </div>
                <p className="text-xs text-indigo-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block" />
                  En línea • Comparador de Precios
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                title="Reiniciar conversación"
                className="p-1.5 text-indigo-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <RefreshCw size={15} />
              </button>
              <button
                onClick={handleToggle}
                title="Cerrar chat"
                className="p-1.5 text-indigo-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60 scrollbar-thin scrollbar-thumb-indigo-200">
            {messages.map((msg, index) => {
              const isAssistant = msg.role === "assistant";
              return (
                <div
                  key={index}
                  className={`flex gap-2.5 ${isAssistant ? "justify-start" : "justify-end"}`}
                >
                  {isAssistant && (
                    <div className="w-7 h-7 rounded-full bg-white flex-shrink-0 overflow-hidden mt-1 border border-indigo-200 p-0.5 shadow-xs">
                      <Image
                        src="/images/logo-oferty.png"
                        alt="Oferty"
                        width={26}
                        height={26}
                        unoptimized
                        className="object-contain w-full h-full"
                      />
                    </div>
                  )}

                  <div className="max-w-[84%] space-y-2">
                    <div
                      className={`px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                        isAssistant
                          ? "bg-white text-slate-800 border border-slate-200/80 rounded-tl-sm"
                          : "bg-indigo-600 text-white rounded-tr-sm"
                      }`}
                    >
                      <div className="whitespace-pre-line">{msg.content}</div>

                      {msg.action === "RESTRICTED_QUERY" && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-amber-700 font-medium">
                          <ShoppingBag size={13} className="text-amber-600" />
                          <span>Especializado exclusivamente en productos y compras Oferty</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-full bg-white flex-shrink-0 overflow-hidden mt-1 border border-indigo-200 p-0.5 shadow-xs">
                  <Image
                    src="/images/logo-oferty.png"
                    alt="Oferty"
                    width={26}
                    height={26}
                    unoptimized
                    className="object-contain w-full h-full"
                  />
                </div>
                <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200/80 shadow-sm rounded-tl-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Sugerencias Rápidas */}
          {!isLoading && lastSuggestions && lastSuggestions.length > 0 && (
            <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap flex items-center gap-1">
                <Sparkles size={11} className="text-orange-500" /> Ideas:
              </span>
              {lastSuggestions.slice(0, 3).map((sug, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(sug)}
                  className="text-[11px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors border border-slate-200/60 font-medium"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Input Footer */}
          <div className="p-3.5 bg-white border-t border-slate-100">
            <div className="flex items-center gap-2 bg-slate-100/90 rounded-2xl px-3.5 py-2 border border-slate-200/70 focus-within:border-indigo-500 focus-within:bg-white transition-all shadow-inner">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pregúntale a Oferty sobre un producto o precio..."
                disabled={isLoading}
                className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isLoading}
                aria-label="Enviar mensaje a Oferty"
                className="p-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-orange-500 hover:opacity-90 text-white disabled:opacity-40 transition-all flex-shrink-0"
              >
                <Send size={15} />
              </button>
            </div>
            <div className="mt-2 text-center">
              <p className="text-[10px] text-slate-400 font-medium">
                Comparador inteligente impulsado por <strong className="text-indigo-600">ScraperLabs</strong> & IA
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
