/**
 * Foro - Foro de la comunidad SPM
 * Full MUI Migration
 */
import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "../context/i18n";
import { useAuthStore } from "../store/authStore";
import api from "../services/api";

// MUI Components
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import Divider from "@mui/material/Divider";

// MUI Icons
import ForumIcon from "@mui/icons-material/Forum";
import SendIcon from "@mui/icons-material/Send";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AddIcon from "@mui/icons-material/Add";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import TagIcon from "@mui/icons-material/Tag";
import CloseIcon from "@mui/icons-material/Close";

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
    const matchesCategoria = selectedCategoria === null || post.categoria?.toLowerCase() === selectedCategoria;
    return matchesSearch && matchesCategoria;
  });

  // Contar posts por categoria
  const getCategoriaCount = (catId) => {
    return posts.filter(p => p.categoria?.toLowerCase() === catId).length;
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Header con busqueda */}
      <Box sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "flex-start", sm: "center" },
        justifyContent: "space-between",
        gap: 2
      }}>
        <Box>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: "text.primary",
              display: "flex",
              alignItems: "center",
              gap: 1,
              textTransform: "uppercase"
            }}
          >
            <ForumIcon sx={{ color: "secondary.main" }} />
            Foro SPM
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setNewPostOpen(!newPostOpen)}
        >
          Nueva Publicacion
        </Button>
      </Box>

      {/* Barra de busqueda */}
      <TextField
        fullWidth
        placeholder="Buscar publicaciones por titulo, contenido o autor..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: "text.secondary" }} />
            </InputAdornment>
          ),
          endAdornment: searchQuery && (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearchQuery("")}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{
          "& .MuiOutlinedInput-root": {
            bgcolor: "background.paper",
          }
        }}
      />

      {/* Layout con sidebar */}
      <Box sx={{ display: "flex", gap: 3 }}>
        {/* Sidebar - Indice de temas */}
        <Box
          component="aside"
          sx={{
            width: 224,
            flexShrink: 0,
            display: { xs: "none", lg: "block" }
          }}
        >
          <Paper sx={{ position: "sticky", top: 16, p: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                mb: 2,
                color: "text.secondary"
              }}
            >
              <FilterListIcon fontSize="small" />
              Categorias
            </Typography>
            <Stack spacing={0.5}>
              {/* Todas las categorias */}
              <Box
                component="button"
                onClick={() => setSelectedCategoria(null)}
                sx={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  px: 1.5,
                  py: 1,
                  borderRadius: 1,
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  transition: "all 0.2s",
                  bgcolor: selectedCategoria === null ? "primary.50" : "transparent",
                  color: selectedCategoria === null ? "primary.main" : "text.secondary",
                  fontWeight: selectedCategoria === null ? 600 : 400,
                  "&:hover": {
                    bgcolor: selectedCategoria === null ? "primary.50" : "action.hover",
                    color: selectedCategoria === null ? "primary.main" : "text.primary",
                  }
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <TagIcon sx={{ fontSize: 16 }} />
                  Todos
                </Box>
                <Chip
                  label={posts.length}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: "0.75rem",
                    bgcolor: "action.selected"
                  }}
                />
              </Box>

              {/* Categorias individuales */}
              {categorias.map((cat) => (
                <Box
                  component="button"
                  key={cat.id}
                  onClick={() => setSelectedCategoria(cat.id === selectedCategoria ? null : cat.id)}
                  sx={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 1.5,
                    py: 1,
                    borderRadius: 1,
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    transition: "all 0.2s",
                    bgcolor: selectedCategoria === cat.id ? `${cat.color}15` : "transparent",
                    color: selectedCategoria === cat.id ? cat.color : "text.secondary",
                    fontWeight: selectedCategoria === cat.id ? 600 : 400,
                    "&:hover": {
                      bgcolor: selectedCategoria === cat.id ? `${cat.color}15` : "action.hover",
                      color: selectedCategoria === cat.id ? cat.color : "text.primary",
                    }
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: cat.color,
                      }}
                    />
                    {cat.label}
                  </Box>
                  <Chip
                    label={getCategoriaCount(cat.id)}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: "0.75rem",
                      bgcolor: "action.selected"
                    }}
                  />
                </Box>
              ))}
            </Stack>
          </Paper>
        </Box>

        {/* Main content */}
        <Box component="main" sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Formulario nuevo post */}
          {newPostOpen && (
            <Paper sx={{ p: 3, borderLeft: 4, borderColor: "primary.main" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                Nueva Publicacion
              </Typography>
              <Box component="form" onSubmit={handleCreatePost} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box>
                  <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>
                    Titulo
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={newPost.titulo}
                    onChange={(e) => setNewPost({ ...newPost, titulo: e.target.value })}
                    placeholder="Escribe un titulo descriptivo..."
                    inputProps={{ maxLength: 100 }}
                  />
                </Box>

                <Box>
                  <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>
                    Categoria
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                    {categorias.map((cat) => (
                      <Chip
                        key={cat.id}
                        label={cat.label}
                        size="small"
                        onClick={() => setNewPost({ ...newPost, categoria: cat.id })}
                        sx={{
                          cursor: "pointer",
                          fontWeight: 600,
                          bgcolor: newPost.categoria === cat.id ? cat.color : "transparent",
                          color: newPost.categoria === cat.id ? "white" : "text.secondary",
                          border: newPost.categoria === cat.id ? "none" : "1px solid",
                          borderColor: "divider",
                          "&:hover": {
                            bgcolor: newPost.categoria === cat.id ? cat.color : "action.hover",
                          }
                        }}
                      />
                    ))}
                  </Stack>
                </Box>

                <Box>
                  <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>
                    Contenido
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    value={newPost.contenido}
                    onChange={(e) => setNewPost({ ...newPost, contenido: e.target.value })}
                    placeholder="Describe tu pregunta, idea o comentario..."
                    inputProps={{ maxLength: 2000 }}
                  />
                </Box>

                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button variant="text" onClick={() => setNewPostOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={submitting || !newPost.titulo.trim() || !newPost.contenido.trim()}
                  >
                    {submitting ? "Publicando..." : "Publicar"}
                  </Button>
                </Stack>
              </Box>
            </Paper>
          )}

          {/* Lista de posts */}
          {loading ? (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <CircularProgress size={40} />
              <Typography sx={{ color: "text.secondary", mt: 2 }}>
                Cargando publicaciones...
              </Typography>
            </Box>
          ) : error ? (
            <Paper sx={{ p: 4, textAlign: "center", borderLeft: 4, borderColor: "error.main" }}>
              <WarningAmberIcon sx={{ fontSize: 48, color: "warning.main", mb: 1.5 }} />
              <Typography sx={{ color: "text.secondary" }}>{error}</Typography>
              <Button variant="outlined" onClick={loadPosts} sx={{ mt: 2 }}>
                Reintentar
              </Button>
            </Paper>
          ) : filteredPosts.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: "center" }}>
              <ForumIcon sx={{ fontSize: 64, color: "secondary.main", opacity: 0.5, mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                {posts.length === 0 ? "No hay publicaciones aun" : "No se encontraron resultados"}
              </Typography>
              <Typography sx={{ color: "text.secondary", mb: 2 }}>
                {posts.length === 0
                  ? "Se el primero en iniciar una conversacion!"
                  : "Intenta con otros terminos de busqueda o categoria"}
              </Typography>
              {posts.length === 0 && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setNewPostOpen(true)}
                >
                  Crear primera publicacion
                </Button>
              )}
              {(searchQuery || selectedCategoria) && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategoria(null);
                  }}
                >
                  Limpiar filtros
                </Button>
              )}
            </Paper>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {/* Mobile category filter */}
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  flexWrap: "wrap",
                  gap: 1,
                  display: { xs: "flex", lg: "none" }
                }}
              >
                <Chip
                  label={`Todos (${posts.length})`}
                  size="small"
                  onClick={() => setSelectedCategoria(null)}
                  sx={{
                    fontWeight: 600,
                    bgcolor: selectedCategoria === null ? "primary.main" : "transparent",
                    color: selectedCategoria === null ? "white" : "text.secondary",
                    border: selectedCategoria === null ? "none" : "1px solid",
                    borderColor: "divider",
                  }}
                />
                {categorias.map((cat) => (
                  <Chip
                    key={cat.id}
                    label={`${cat.label} (${getCategoriaCount(cat.id)})`}
                    size="small"
                    onClick={() => setSelectedCategoria(cat.id === selectedCategoria ? null : cat.id)}
                    sx={{
                      fontWeight: 600,
                      bgcolor: selectedCategoria === cat.id ? cat.color : "transparent",
                      color: selectedCategoria === cat.id ? "white" : "text.secondary",
                      border: selectedCategoria === cat.id ? "none" : "1px solid",
                      borderColor: "divider",
                    }}
                  />
                ))}
              </Stack>

              {/* Results count */}
              {(searchQuery || selectedCategoria) && (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {filteredPosts.length} resultado{filteredPosts.length !== 1 ? "s" : ""}
                  {selectedCategoria && ` en ${getCategoriaLabel(selectedCategoria)}`}
                  {searchQuery && ` para "${searchQuery}"`}
                </Typography>
              )}

              {filteredPosts.map((post) => {
                const isExpanded = expandedPosts[post.id];
                const hasReplies = post.respuestas && post.respuestas.length > 0;

                return (
                  <Paper
                    key={post.id}
                    sx={{
                      p: 2.5,
                      transition: "border-color 0.2s",
                      "&:hover": {
                        borderColor: "primary.light",
                      }
                    }}
                  >
                    {/* Header del post */}
                    <Box sx={{ display: "flex", gap: 1.5 }}>
                      <Avatar
                        sx={{
                          bgcolor: getCategoriaColor(post.categoria),
                          width: 40,
                          height: 40,
                          fontSize: "0.875rem",
                          fontWeight: 700,
                        }}
                      >
                        {post.autor_nombre?.[0]?.toUpperCase() || "U"}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {post.autor_nombre}
                          </Typography>
                          <Chip
                            label={getCategoriaLabel(post.categoria)}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: "0.625rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              bgcolor: `${getCategoriaColor(post.categoria)}20`,
                              color: getCategoriaColor(post.categoria),
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5
                            }}
                          >
                            <AccessTimeIcon sx={{ fontSize: 12, color: "info.main" }} />
                            {formatDate(post.created_at)}
                          </Typography>
                        </Stack>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 0.5 }}>
                          {post.titulo}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "text.secondary",
                            mt: 1,
                            whiteSpace: "pre-wrap"
                          }}
                        >
                          {post.contenido}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Acciones del post */}
                    <Divider sx={{ my: 2 }} />
                    <Stack direction="row" spacing={2}>
                      <Button
                        size="small"
                        startIcon={post.user_liked ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />}
                        onClick={() => handleLike(post.id)}
                        sx={{
                          color: post.user_liked ? "primary.main" : "text.secondary",
                          "&:hover": {
                            color: "primary.main",
                          }
                        }}
                      >
                        {post.likes || 0}
                      </Button>
                      <Button
                        size="small"
                        startIcon={<ChatBubbleOutlineIcon sx={{ color: "secondary.main" }} />}
                        endIcon={hasReplies ? (isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />) : null}
                        onClick={() => toggleExpand(post.id)}
                        sx={{ color: "text.secondary" }}
                      >
                        {post.respuestas?.length || 0} respuestas
                      </Button>
                    </Stack>

                    {/* Respuestas */}
                    {isExpanded && (
                      <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
                        <Stack spacing={2}>
                          {/* Lista de respuestas */}
                          {post.respuestas?.map((resp) => (
                            <Box
                              key={resp.id}
                              sx={{
                                display: "flex",
                                gap: 1.5,
                                pl: 2,
                                borderLeft: 2,
                                borderColor: "divider"
                              }}
                            >
                              <Avatar
                                sx={{
                                  bgcolor: "action.selected",
                                  width: 32,
                                  height: 32,
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  color: "text.secondary",
                                }}
                              >
                                {resp.autor_nombre?.[0]?.toUpperCase() || "U"}
                              </Avatar>
                              <Box sx={{ flex: 1 }}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {resp.autor_nombre}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    {formatDate(resp.created_at)}
                                  </Typography>
                                </Stack>
                                <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                                  {resp.contenido}
                                </Typography>
                              </Box>
                            </Box>
                          ))}

                          {/* Input para nueva respuesta */}
                          <Box sx={{ display: "flex", gap: 1, pl: 2 }}>
                            <TextField
                              fullWidth
                              size="small"
                              placeholder="Escribe una respuesta..."
                              value={replyContent[post.id] || ""}
                              onChange={(e) => setReplyContent({ ...replyContent, [post.id]: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleReply(post.id);
                                }
                              }}
                            />
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => handleReply(post.id)}
                              disabled={!replyContent[post.id]?.trim()}
                              sx={{ minWidth: "auto", px: 2 }}
                            >
                              <SendIcon fontSize="small" />
                            </Button>
                          </Box>
                        </Stack>
                      </Box>
                    )}
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
