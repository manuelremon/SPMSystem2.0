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
} from "lucide-react";
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
    { id: "general", label: "General", color: "var(--primary)" },
    { id: "ayuda", label: "Ayuda", color: "var(--info)" },
    { id: "sugerencias", label: "Sugerencias", color: "var(--success)" },
    { id: "problemas", label: "Problemas", color: "var(--danger)" },
    { id: "anuncios", label: "Anuncios", color: "var(--warning)" },
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
    if (diffDays < 7) return `Hace ${diffDays} dias`;
    return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  };

  const getCategoriaColor = (catId) => {
    return categorias.find(c => c.id === catId)?.color || "var(--fg-muted)";
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
          <h1 className="text-2xl font-bold text-[var(--fg)] flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-[var(--primary)]" />
            Foro SPM
          </h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">
            Comparte ideas, resuelve dudas y conecta con tus companeros
          </p>
        </div>
        <Button onClick={() => setNewPostOpen(!newPostOpen)}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Publicacion
        </Button>
      </div>

      {/* Barra de busqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--fg-subtle)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar publicaciones por titulo, contenido o autor..."
          className="w-full pl-10 pr-4 py-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:border-[var(--primary)] transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
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
                <Filter className="w-4 h-4" />
                Categorias
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <nav className="space-y-1">
                {/* Todas las categorias */}
                <button
                  onClick={() => setSelectedCategoria(null)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCategoria === null
                      ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
                      : "text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    Todos
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-elevated)]">
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
                        : "text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]"
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
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-elevated)]">
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
            <Card className="border-[var(--primary)]/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Nueva Publicacion</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreatePost} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">
                      Titulo
                    </label>
                    <input
                      type="text"
                      value={newPost.titulo}
                      onChange={(e) => setNewPost({ ...newPost, titulo: e.target.value })}
                      placeholder="Escribe un titulo descriptivo..."
                      className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">
                      Categoria
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
                              : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--primary)]"
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
                    <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">
                      Contenido
                    </label>
                    <textarea
                      value={newPost.contenido}
                      onChange={(e) => setNewPost({ ...newPost, contenido: e.target.value })}
                      placeholder="Describe tu pregunta, idea o comentario..."
                      rows={4}
                      className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:border-[var(--primary)] transition-colors resize-none"
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
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary)] mx-auto"></div>
              <p className="text-[var(--fg-muted)] mt-4">Cargando publicaciones...</p>
            </div>
          ) : error ? (
            <Card className="border-[var(--danger)]/30">
              <CardContent className="py-8 text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-[var(--danger)]" />
                <p className="text-[var(--fg-muted)]">{error}</p>
                <Button variant="outline" onClick={loadPosts} className="mt-4">
                  Reintentar
                </Button>
              </CardContent>
            </Card>
          ) : filteredPosts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 text-[var(--fg-subtle)] opacity-50" />
                <h3 className="text-lg font-semibold text-[var(--fg)] mb-2">
                  {posts.length === 0 ? "No hay publicaciones aun" : "No se encontraron resultados"}
                </h3>
                <p className="text-[var(--fg-muted)] mb-4">
                  {posts.length === 0
                    ? "Se el primero en iniciar una conversacion!"
                    : "Intenta con otros terminos de busqueda o categoria"}
                </p>
                {posts.length === 0 && (
                  <Button onClick={() => setNewPostOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Crear primera publicacion
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
                      ? "bg-[var(--primary)] text-white border-transparent"
                      : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--primary)]"
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
                        : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--primary)]"
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
                <p className="text-sm text-[var(--fg-muted)]">
                  {filteredPosts.length} resultado{filteredPosts.length !== 1 ? "s" : ""}
                  {selectedCategoria && ` en ${getCategoriaLabel(selectedCategoria)}`}
                  {searchQuery && ` para "${searchQuery}"`}
                </p>
              )}

              {filteredPosts.map((post) => {
                const isExpanded = expandedPosts[post.id];
                const hasReplies = post.respuestas && post.respuestas.length > 0;

                return (
                  <Card key={post.id} className="hover:border-[var(--primary)]/30 transition-colors">
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
                            <span className="font-semibold text-[var(--fg)]">{post.autor_nombre}</span>
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                              style={{
                                backgroundColor: `${getCategoriaColor(post.categoria)}20`,
                                color: getCategoriaColor(post.categoria),
                              }}
                            >
                              {getCategoriaLabel(post.categoria)}
                            </span>
                            <span className="text-xs text-[var(--fg-subtle)] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(post.created_at)}
                            </span>
                          </div>
                          <h3 className="font-semibold text-[var(--fg)] mt-1">{post.titulo}</h3>
                          <p className="text-sm text-[var(--fg-muted)] mt-2 whitespace-pre-wrap">
                            {post.contenido}
                          </p>
                        </div>
                      </div>

                      {/* Acciones del post */}
                      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[var(--border)]">
                        <button
                          onClick={() => handleLike(post.id)}
                          className={`flex items-center gap-1.5 text-sm transition-colors ${
                            post.user_liked
                              ? "text-[var(--primary)]"
                              : "text-[var(--fg-muted)] hover:text-[var(--primary)]"
                          }`}
                        >
                          <ThumbsUp className="w-4 h-4" />
                          <span>{post.likes || 0}</span>
                        </button>
                        <button
                          onClick={() => toggleExpand(post.id)}
                          className="flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--primary)] transition-colors"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>{post.respuestas?.length || 0} respuestas</span>
                          {hasReplies && (
                            isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {/* Respuestas */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-4">
                          {/* Lista de respuestas */}
                          {post.respuestas?.map((resp) => (
                            <div key={resp.id} className="flex gap-3 pl-4 border-l-2 border-[var(--border)]">
                              <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] grid place-items-center flex-shrink-0 text-[var(--fg-muted)] text-xs font-bold">
                                {resp.autor_nombre?.[0]?.toUpperCase() || "U"}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-[var(--fg)]">{resp.autor_nombre}</span>
                                  <span className="text-xs text-[var(--fg-subtle)]">{formatDate(resp.created_at)}</span>
                                </div>
                                <p className="text-sm text-[var(--fg-muted)] mt-1">{resp.contenido}</p>
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
                              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:border-[var(--primary)] transition-colors"
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
