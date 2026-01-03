import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import {
  MessageCircle,
  Send,
  ThumbsUp,
  MessageSquare,
  Clock,
  User,
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertCircle,
  Search,
  Filter,
  Hash,
} from "../components/ui/Icons";
import { useI18n } from "../context/i18n";
import { useAuthStore } from "../store/authStore";
import api from "../services/api";

export default function Foro() {
  const { t } = useI18n();
  const { user } = useAuthStore();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [newPost, setNewPost] = useState({ titulo: "", contenido: "", categoria: "general" });
  const [submitting, setSubmitting] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState({});
  const [replyContent, setReplyContent] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState(null);

  const categorias = [
    { id: "general", label: "General", color: "#2563eb" },
    { id: "ayuda", label: "Ayuda", color: "#3b82f6" },
    { id: "sugerencias", label: "Sugerencias", color: "#10b981" },
    { id: "problemas", label: "Problemas", color: "#ef4444" },
    { id: "anuncios", label: "Anuncios", color: "#f59e0b" },
  ];

  // Cargar posts
  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/foro/posts");
      if (res.data.ok) {
        setPosts(res.data.posts || []);
      }
    } catch (err) {
      console.error("Error loading posts", err);
      setError("No se pudieron cargar las publicaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Crear nuevo post
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.titulo.trim() || !newPost.contenido.trim()) return;

    setSubmitting(true);
    try {
      const res = await api.post("/foro/posts", newPost);
      if (res.data.ok) {
        setNewPost({ titulo: "", contenido: "", categoria: "general" });
        setNewPostOpen(false);
        loadPosts();
      }
    } catch (err) {
      console.error("Error creating post", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Dar like a un post
  const handleLike = async (postId) => {
    try {
      await api.post(`/foro/posts/${postId}/like`);
      loadPosts();
    } catch (err) {
      console.error("Error liking post", err);
    }
  };

  // Responder a un post
  const handleReply = async (postId) => {
    const contenido = replyContent[postId];
    if (!contenido?.trim()) return;

    try {
      await api.post(`/foro/posts/${postId}/respuestas`, { contenido });
      setReplyContent({ ...replyContent, [postId]: "" });
      loadPosts();
    } catch (err) {
      console.error("Error replying to post", err);
    }
  };

  // Toggle expandir post
  const toggleExpand = (postId) => {
    setExpandedPosts(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  // Formatear fecha
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Ahora mismo";
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  };

  const getCategoriaColor = (catId) => {
    return categorias.find(c => c.id === catId)?.color || "#64748b";
  };

  const getCategoriaLabel = (catId) => {
    return categorias.find(c => c.id === catId)?.label || catId;
  };

  // Filtrar posts por busqueda y categoria
  const filteredPosts = posts.filter((post) => {
    const matchesSearch = searchQuery.trim() === "" ||
      post.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.contenido.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.autor_nombre?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategoria = selectedCategoria === null || post.categoria === selectedCategoria;
    return matchesSearch && matchesCategoria;
  });

  // Contar posts por categoria
  const getCategoriaCount = (catId) => {
    return posts.filter(p => p.categoria === catId).length;
  };

  return (
    <div className="space-y-4">
      {/* Header con busqueda */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 uppercase">
            <MessageCircle className="w-6 h-6 text-violet-500" />
            Foro SPM
          </h1>
        </div>
        <Button onClick={() => setNewPostOpen(!newPostOpen)}>
          <Plus className="w-4 h-4" />
          Nueva Publicación
        </Button>
      </div>

      {/* Barra de busqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar publicaciones por título, contenido o autor..."
          className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-50/70 dark:bg-slate-800/70 border border-white/30 dark:border-slate-700/30 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <span className="text-lg">&times;</span>
          </button>
        )}
      </div>

      {/* Layout con sidebar */}
      <div className="flex gap-6">
        {/* Sidebar - Indice de temas */}
        <aside className="w-56 flex-shrink-0 hidden lg:block">
          <Card className="sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Categorías
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <nav className="space-y-1">
                {/* Todas las categorias */}
                <button
                  onClick={() => setSelectedCategoria(null)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCategoria === null
                      ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-medium"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-700/70 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    Todos
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100/70 dark:bg-slate-700/70">
                    {posts.length}
                  </span>
                </button>

                {/* Categorias individuales */}
                {categorias.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoria(cat.id === selectedCategoria ? null : cat.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedCategoria === cat.id
                        ? "font-medium"
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-700/70 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                    style={{
                      backgroundColor: selectedCategoria === cat.id ? `${cat.color}15` : undefined,
                      color: selectedCategoria === cat.id ? cat.color : undefined,
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.label}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100/70 dark:bg-slate-700/70">
                      {getCategoriaCount(cat.id)}
                    </span>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-4">
          {/* Formulario nuevo post */}
          {newPostOpen && (
            <Card className="border-blue-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Nueva Publicación</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreatePost} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Título
                    </label>
                    <input
                      type="text"
                      value={newPost.titulo}
                      onChange={(e) => setNewPost({ ...newPost, titulo: e.target.value })}
                      placeholder="Escribe un título descriptivo..."
                      className="w-full px-4 py-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/70 border border-white/30 dark:border-slate-700/30 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Categoría
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {categorias.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setNewPost({ ...newPost, categoria: cat.id })}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            newPost.categoria === cat.id
                              ? "border-transparent text-white"
                              : "border-white/30 dark:border-slate-700/30 text-slate-500 dark:text-slate-400 hover:border-blue-500"
                          }`}
                          style={{
                            backgroundColor: newPost.categoria === cat.id ? cat.color : "transparent",
                          }}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Contenido
                    </label>
                    <textarea
                      value={newPost.contenido}
                      onChange={(e) => setNewPost({ ...newPost, contenido: e.target.value })}
                      placeholder="Describe tu pregunta, idea o comentario..."
                      rows={4}
                      className="w-full px-4 py-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/70 border border-white/30 dark:border-slate-700/30 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                      maxLength={2000}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setNewPostOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={submitting || !newPost.titulo.trim() || !newPost.contenido.trim()}>
                      {submitting ? "Publicando..." : "Publicar"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Lista de posts */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-slate-500 dark:text-slate-400 mt-4">Cargando publicaciones...</p>
            </div>
          ) : error ? (
            <Card className="border-red-500/30">
              <CardContent className="py-8 text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-amber-500" />
                <p className="text-slate-500 dark:text-slate-400">{error}</p>
                <Button variant="outline" onClick={loadPosts} className="mt-4">
                  Reintentar
                </Button>
              </CardContent>
            </Card>
          ) : filteredPosts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 text-violet-500 opacity-50" />
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                  {posts.length === 0 ? "No hay publicaciones aún" : "No se encontraron resultados"}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  {posts.length === 0
                    ? "Sé el primero en iniciar una conversación!"
                    : "Intenta con otros términos de búsqueda o categoría"}
                </p>
                {posts.length === 0 && (
                  <Button onClick={() => setNewPostOpen(true)}>
                    <Plus className="w-4 h-4" />
                    Crear primera publicación
                  </Button>
                )}
                {(searchQuery || selectedCategoria) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategoria(null);
                    }}
                  >
                    Limpiar filtros
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Mobile category filter */}
              <div className="flex flex-wrap gap-2 lg:hidden">
                <button
                  onClick={() => setSelectedCategoria(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    selectedCategoria === null
                      ? "bg-blue-600 text-white border-transparent"
                      : "border-white/30 dark:border-slate-700/30 text-slate-500 dark:text-slate-400 hover:border-blue-500"
                  }`}
                >
                  Todos ({posts.length})
                </button>
                {categorias.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoria(cat.id === selectedCategoria ? null : cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      selectedCategoria === cat.id
                        ? "border-transparent text-white"
                        : "border-white/30 dark:border-slate-700/30 text-slate-500 dark:text-slate-400 hover:border-blue-500"
                    }`}
                    style={{
                      backgroundColor: selectedCategoria === cat.id ? cat.color : "transparent",
                    }}
                  >
                    {cat.label} ({getCategoriaCount(cat.id)})
                  </button>
                ))}
              </div>

              {/* Results count */}
              {(searchQuery || selectedCategoria) && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {filteredPosts.length} resultado{filteredPosts.length !== 1 ? "s" : ""}
                  {selectedCategoria && ` en ${getCategoriaLabel(selectedCategoria)}`}
                  {searchQuery && ` para "${searchQuery}"`}
                </p>
              )}

              {filteredPosts.map((post) => {
                const isExpanded = expandedPosts[post.id];
                const hasReplies = post.respuestas && post.respuestas.length > 0;

                return (
                  <Card key={post.id} className="hover:border-blue-500/30 transition-colors">
                    <CardContent className="p-5">
                      {/* Header del post */}
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-full grid place-items-center flex-shrink-0 text-white font-bold text-sm"
                          style={{ backgroundColor: getCategoriaColor(post.categoria) }}
                        >
                          {post.autor_nombre?.[0]?.toUpperCase() || "U"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{post.autor_nombre}</span>
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                              style={{
                                backgroundColor: `${getCategoriaColor(post.categoria)}20`,
                                color: getCategoriaColor(post.categoria),
                              }}
                            >
                              {getCategoriaLabel(post.categoria)}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />
                              {formatDate(post.created_at)}
                            </span>
                          </div>
                          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mt-1">{post.titulo}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 whitespace-pre-wrap">
                            {post.contenido}
                          </p>
                        </div>
                      </div>

                      {/* Acciones del post */}
                      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/30 dark:border-slate-700/30">
                        <button
                          onClick={() => handleLike(post.id)}
                          className={`flex items-center gap-1.5 text-sm transition-colors ${
                            post.user_liked
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                          }`}
                        >
                          <ThumbsUp className="w-4 h-4" />
                          <span>{post.likes || 0}</span>
                        </button>
                        <button
                          onClick={() => toggleExpand(post.id)}
                          className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <MessageSquare className="w-4 h-4 text-violet-500" />
                          <span>{post.respuestas?.length || 0} respuestas</span>
                          {hasReplies && (
                            isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {/* Respuestas */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-white/30 dark:border-slate-700/30 space-y-4">
                          {/* Lista de respuestas */}
                          {post.respuestas?.map((resp) => (
                            <div key={resp.id} className="flex gap-3 pl-4 border-l-2 border-white/30 dark:border-slate-700/30">
                              <div className="w-8 h-8 rounded-full bg-slate-100/70 dark:bg-slate-700/70 grid place-items-center flex-shrink-0 text-slate-500 dark:text-slate-400 text-xs font-bold">
                                {resp.autor_nombre?.[0]?.toUpperCase() || "U"}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{resp.autor_nombre}</span>
                                  <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(resp.created_at)}</span>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{resp.contenido}</p>
                              </div>
                            </div>
                          ))}

                          {/* Input para nueva respuesta */}
                          <div className="flex gap-2 pl-4">
                            <input
                              type="text"
                              value={replyContent[post.id] || ""}
                              onChange={(e) => setReplyContent({ ...replyContent, [post.id]: e.target.value })}
                              placeholder="Escribe una respuesta..."
                              className="flex-1 px-3 py-2 rounded-lg bg-slate-50/70 dark:bg-slate-800/70 border border-white/30 dark:border-slate-700/30 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleReply(post.id);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleReply(post.id)}
                              disabled={!replyContent[post.id]?.trim()}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
