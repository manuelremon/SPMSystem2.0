import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  CircularProgress,
} from "@mui/material";
import {
  EmojiEvents as TrophyIcon,
  Star as StarIcon,
  Bolt as ZapIcon,
  TrackChanges as TargetIcon,
  HelpOutline as HelpCircleIcon,
  AttachMoney as DollarSignIcon,
  Layers as LayersIcon,
  MenuBook as BookOpenIcon,
  ArrowForward as ArrowRightIcon,
  ArrowBack as ArrowLeftIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as XCircleIcon,
  Timer as TimerIcon,
  MilitaryTech as MedalIcon,
  WorkspacePremium as CrownIcon,
  Refresh as RefreshCwIcon,
} from "@mui/icons-material";
import { useI18n } from "../context/i18n";
import { useAuthStore } from "../store/authStore";
import api from "../services/api";

// === DATOS DE JUEGOS ===

// Preguntas Quiz SPM
const quizQuestions = [
  {
    question: "¿Cual es el estado inicial de una solicitud recien creada?",
    options: ["Enviada", "Borrador", "Aprobada", "En Proceso"],
    correct: 1,
    explanation: "Las solicitudes comienzan como Borrador hasta ser enviadas"
  },
  {
    question: "¿Quien debe aprobar una solicitud antes de ser planificada?",
    options: ["El Planificador", "El Solicitante", "El Aprobador/Jefe", "El Administrador"],
    correct: 2,
    explanation: "El flujo requiere aprobacion del jefe antes de planificacion"
  },
  {
    question: "¿Que significa la criticidad 'Alta' en una solicitud?",
    options: ["No es urgente", "Prioridad normal", "Requiere atencion prioritaria", "Ya fue procesada"],
    correct: 2,
    explanation: "Criticidad Alta indica que el pedido requiere atencion prioritaria"
  },
  {
    question: "¿Donde se valida el presupuesto disponible?",
    options: ["En el Dashboard", "Al crear la solicitud", "Al aprobar la solicitud", "Al cerrar la solicitud"],
    correct: 2,
    explanation: "El presupuesto se valida en el momento de la aprobacion"
  },
  {
    question: "¿Que rol puede acceder a todas las funciones del sistema?",
    options: ["Solicitante", "Planificador", "Aprobador", "Administrador"],
    correct: 3,
    explanation: "El Administrador tiene acceso completo al sistema"
  },
  {
    question: "¿Como se identifica un material en el sistema?",
    options: ["Por nombre", "Por codigo SAP", "Por precio", "Por proveedor"],
    correct: 1,
    explanation: "Cada material tiene un codigo SAP unico"
  },
  {
    question: "¿Que sucede cuando una solicitud es rechazada?",
    options: ["Se elimina", "Vuelve al solicitante", "Se archiva", "Se envia al planificador"],
    correct: 1,
    explanation: "El solicitante puede revisar y reenviar la solicitud"
  },
  {
    question: "¿Cual es la unidad de moneda utilizada en SPM?",
    options: ["Pesos", "Euros", "Dolares USD", "Reales"],
    correct: 2,
    explanation: "SPM utiliza Dolares USD para todos los montos"
  },
];

// Materiales para el juego de precios
const priceMaterials = [
  { name: "Valvula de compuerta 4 pulgadas", correctPrice: 850, options: [450, 850, 1500] },
  { name: "Bomba centrifuga 10 HP", correctPrice: 3200, options: [1800, 3200, 5500] },
  { name: "Cable de control 4x16 AWG (100m)", correctPrice: 420, options: [180, 420, 750] },
  { name: "Rodamiento SKF 6308-2Z", correctPrice: 85, options: [35, 85, 150] },
  { name: "Motor electrico trifasico 5 HP", correctPrice: 1800, options: [900, 1800, 3200] },
  { name: "Junta de expansion DN100", correctPrice: 280, options: [120, 280, 520] },
  { name: "Filtro de aire industrial", correctPrice: 95, options: [45, 95, 180] },
  { name: "Sensor de temperatura PT100", correctPrice: 320, options: [150, 320, 580] },
];

// Categorias y materiales para drag & drop
const categoryGame = {
  categories: [
    { id: "electrico", name: "Electrico", color: "#eab308" },
    { id: "mecanico", name: "Mecanico", color: "#3b82f6" },
    { id: "instrumentacion", name: "Instrumentacion", color: "#22c55e" },
  ],
  rounds: [
    {
      materials: [
        { id: "m1", name: "Motor trifasico", category: "electrico" },
        { id: "m2", name: "Rodamiento", category: "mecanico" },
        { id: "m3", name: "Sensor de nivel", category: "instrumentacion" },
      ]
    },
    {
      materials: [
        { id: "m4", name: "Cable de potencia", category: "electrico" },
        { id: "m5", name: "Valvula de bola", category: "mecanico" },
        { id: "m6", name: "Transmisor de presion", category: "instrumentacion" },
      ]
    },
    {
      materials: [
        { id: "m7", name: "Contactor", category: "electrico" },
        { id: "m8", name: "Bomba centrifuga", category: "mecanico" },
        { id: "m9", name: "Termocupla tipo K", category: "instrumentacion" },
      ]
    },
    {
      materials: [
        { id: "m10", name: "Variador de frecuencia", category: "electrico" },
        { id: "m11", name: "Acoplamiento flexible", category: "mecanico" },
        { id: "m12", name: "Medidor de flujo", category: "instrumentacion" },
      ]
    },
  ]
};

// Materiales para adivinar (descripcion parcial)
const guessMaterials = [
  {
    description: "Dispositivo rotativo que convierte energia electrica en mecanica, utilizado para accionar bombas y compresores",
    options: ["Generador", "Motor electrico", "Transformador", "Inversor"],
    correct: 1
  },
  {
    description: "Elemento mecanico que reduce la friccion entre partes moviles, comun en ejes y poleas",
    options: ["Junta", "Empaquetadura", "Rodamiento", "Sello mecanico"],
    correct: 2
  },
  {
    description: "Instrumento que mide la fuerza por unidad de area en sistemas hidraulicos y neumaticos",
    options: ["Termometro", "Caudalimetro", "Manometro", "Nivel"],
    correct: 2
  },
  {
    description: "Dispositivo que regula el paso de fluidos, puede ser de bola, compuerta o mariposa",
    options: ["Bomba", "Filtro", "Valvula", "Tuberia"],
    correct: 2
  },
  {
    description: "Equipo que eleva fluidos de un punto a otro mediante accion mecanica",
    options: ["Compresor", "Bomba", "Tanque", "Intercambiador"],
    correct: 1
  },
  {
    description: "Sensor que detecta variaciones de temperatura y las convierte en senal electrica",
    options: ["Termocupla", "Presostato", "Flujometro", "Transductor"],
    correct: 0
  },
];

export default function Trivias() {
  const { t } = useI18n();
  const { user } = useAuthStore();

  // Estados del juego
  const [activeGame, setActiveGame] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [gameOver, setGameOver] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);

  // Estado para drag & drop
  const [draggedMaterial, setDraggedMaterial] = useState(null);
  const [categoryAssignments, setCategoryAssignments] = useState({});
  const [categoryRound, setCategoryRound] = useState(0);

  // Rankings
  const [rankings, setRankings] = useState([]);
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [myStats, setMyStats] = useState({ total_score: 0, games_played: 0 });

  // Cargar rankings
  const loadRankings = useCallback(async () => {
    setLoadingRankings(true);
    try {
      const res = await api.get("/trivias/rankings");
      if (res.data.ok) {
        setRankings(res.data.rankings || []);
        setMyStats(res.data.my_stats || { total_score: 0, games_played: 0 });
      }
    } catch (err) {
    } finally {
      setLoadingRankings(false);
    }
  }, []);

  useEffect(() => {
    loadRankings();
  }, [loadRankings]);

  // Timer
  useEffect(() => {
    if (!activeGame || answered || gameOver) return;

    if (timeLeft <= 0) {
      handleTimeout();
      return;
    }

    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, activeGame, answered, gameOver]);

  const handleTimeout = () => {
    setAnswered(true);
    setStreak(0);
    setTimeout(() => nextQuestion(), 1500);
  };

  // Mapeo de nombres de juegos internos a backend
  const gameTypeToMode = {
    quiz: "quiz",
    guess: "material",
    price: "precio",
    category: "categorias"
  };

  // Guardar puntuacion
  const saveScore = async (gameType, finalScore) => {
    try {
      const gameMode = gameTypeToMode[gameType] || gameType;
      await api.post("/trivias/score", {
        game_mode: gameMode,
        score: finalScore,
        correct_answers: correctAnswers,
        total_questions: totalQuestions,
      });
      loadRankings();
    } catch (err) {
    }
  };

  // === JUEGO 1: QUIZ SPM ===
  const startQuiz = () => {
    setActiveGame("quiz");
    setScore(0);
    setStreak(0);
    setQuestionIndex(0);
    setAnswered(false);
    setSelectedAnswer(null);
    setTimeLeft(15);
    setGameOver(false);
    setTotalQuestions(quizQuestions.length);
    setCorrectAnswers(0);
  };

  // === JUEGO 2: ADIVINA EL MATERIAL ===
  const startGuessMaterial = () => {
    setActiveGame("guess");
    setScore(0);
    setStreak(0);
    setQuestionIndex(0);
    setAnswered(false);
    setSelectedAnswer(null);
    setTimeLeft(20);
    setGameOver(false);
    setTotalQuestions(guessMaterials.length);
    setCorrectAnswers(0);
  };

  // === JUEGO 3: CUANTO CUESTA ===
  const startPriceGame = () => {
    setActiveGame("price");
    setScore(0);
    setStreak(0);
    setQuestionIndex(0);
    setAnswered(false);
    setSelectedAnswer(null);
    setTimeLeft(12);
    setGameOver(false);
    setTotalQuestions(priceMaterials.length);
    setCorrectAnswers(0);
  };

  // === JUEGO 4: CATEGORIAS ===
  const startCategoryGame = () => {
    setActiveGame("category");
    setScore(0);
    setStreak(0);
    setCategoryRound(0);
    setCategoryAssignments({});
    setGameOver(false);
    setTotalQuestions(categoryGame.rounds.length);
    setCorrectAnswers(0);
  };

  // Manejar respuesta
  const handleAnswer = (answerIndex) => {
    if (answered) return;

    setAnswered(true);
    setSelectedAnswer(answerIndex);

    let isCorrect = false;
    let points = 0;

    if (activeGame === "quiz") {
      isCorrect = answerIndex === quizQuestions[questionIndex].correct;
    } else if (activeGame === "guess") {
      isCorrect = answerIndex === guessMaterials[questionIndex].correct;
    } else if (activeGame === "price") {
      const material = priceMaterials[questionIndex];
      isCorrect = material.options[answerIndex] === material.correctPrice;
    }

    if (isCorrect) {
      points = 100 + (timeLeft * 5) + (streak * 20);
      setScore(s => s + points);
      setStreak(s => s + 1);
      setCorrectAnswers(c => c + 1);
    } else {
      setStreak(0);
    }

    setTimeout(() => nextQuestion(), 1500);
  };

  const nextQuestion = () => {
    const maxQuestions = activeGame === "quiz" ? quizQuestions.length :
                         activeGame === "guess" ? guessMaterials.length :
                         activeGame === "price" ? priceMaterials.length : 0;

    if (questionIndex + 1 >= maxQuestions) {
      setGameOver(true);
      saveScore(activeGame, score);
    } else {
      setQuestionIndex(i => i + 1);
      setAnswered(false);
      setSelectedAnswer(null);
      setTimeLeft(activeGame === "guess" ? 20 : activeGame === "price" ? 12 : 15);
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (material) => {
    setDraggedMaterial(material);
  };

  const handleDrop = (categoryId) => {
    if (!draggedMaterial) return;

    setCategoryAssignments(prev => ({
      ...prev,
      [draggedMaterial.id]: categoryId
    }));
    setDraggedMaterial(null);
  };

  const checkCategoryAnswers = () => {
    const round = categoryGame.rounds[categoryRound];
    let correct = 0;

    round.materials.forEach(m => {
      if (categoryAssignments[m.id] === m.category) {
        correct++;
      }
    });

    const points = correct * 100 + (correct === 3 ? 150 : 0);
    setScore(s => s + points);
    setCorrectAnswers(c => c + correct);

    if (categoryRound + 1 >= categoryGame.rounds.length) {
      setGameOver(true);
      saveScore("category", score + points);
    } else {
      setCategoryRound(r => r + 1);
      setCategoryAssignments({});
    }
  };

  const exitGame = () => {
    setActiveGame(null);
    setGameOver(false);
  };

  // Render del contenido del juego
  const renderGameContent = () => {
    if (gameOver) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <TrophyIcon sx={{ width: 64, height: 64, mx: 'auto', mb: 2, color: 'warning.main' }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}>
            Juego Terminado!
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 2 }}>
            {score} puntos
          </Typography>
          <Typography sx={{ color: 'text.secondary', mb: 3 }}>
            Respuestas correctas: {correctAnswers} / {totalQuestions}
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              variant="contained"
              startIcon={<RefreshCwIcon />}
              onClick={() => {
                if (activeGame === "quiz") startQuiz();
                else if (activeGame === "guess") startGuessMaterial();
                else if (activeGame === "price") startPriceGame();
                else if (activeGame === "category") startCategoryGame();
              }}
            >
              Jugar de nuevo
            </Button>
            <Button
              variant="outlined"
              startIcon={<ArrowLeftIcon />}
              onClick={exitGame}
            >
              Volver
            </Button>
          </Stack>
        </Box>
      );
    }

    // Quiz SPM
    if (activeGame === "quiz") {
      const q = quizQuestions[questionIndex];
      return (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Chip label={`Pregunta ${questionIndex + 1} / ${quizQuestions.length}`} color="info" />
            <Stack direction="row" spacing={2} alignItems="center">
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'warning.main' }}>
                <ZapIcon sx={{ width: 16, height: 16 }} />
                <Typography sx={{ fontWeight: 'bold' }}>{streak}</Typography>
              </Stack>
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{
                  color: timeLeft <= 5 ? 'error.main' : 'text.secondary',
                  animation: timeLeft <= 5 ? 'pulse 1s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                  },
                }}
              >
                <TimerIcon sx={{ width: 16, height: 16 }} />
                <Typography sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{timeLeft}s</Typography>
              </Stack>
            </Stack>
          </Stack>

          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 3 }}>
            {q.question}
          </Typography>

          <Stack spacing={1.5}>
            {q.options.map((opt, idx) => (
              <Box
                key={idx}
                component="button"
                onClick={() => handleAnswer(idx)}
                disabled={answered}
                sx={{
                  width: '100%',
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  cursor: answered ? 'default' : 'pointer',
                  backgroundColor: answered
                    ? idx === q.correct
                      ? 'success.light'
                      : idx === selectedAnswer
                        ? 'error.light'
                        : 'grey.100'
                    : 'grey.50',
                  borderColor: answered
                    ? idx === q.correct
                      ? 'success.main'
                      : idx === selectedAnswer
                        ? 'error.main'
                        : 'grey.300'
                    : 'grey.300',
                  color: answered
                    ? idx === q.correct
                      ? 'success.dark'
                      : idx === selectedAnswer
                        ? 'error.dark'
                        : 'text.secondary'
                    : 'text.primary',
                  '&:hover': !answered ? {
                    borderColor: 'primary.main',
                    backgroundColor: 'primary.light',
                  } : {},
                  '&:disabled': {
                    cursor: 'default',
                  },
                }}
              >
                <Typography sx={{ fontWeight: 500 }}>{opt}</Typography>
              </Box>
            ))}
          </Stack>

          {answered && (
            <Paper sx={{ mt: 2, p: 2, backgroundColor: 'grey.50' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                <Box component="span" sx={{ fontWeight: 'bold', color: 'text.primary' }}>Explicacion:</Box> {q.explanation}
              </Typography>
            </Paper>
          )}
        </Box>
      );
    }

    // Adivina el Material
    if (activeGame === "guess") {
      const m = guessMaterials[questionIndex];
      return (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Chip label={`Material ${questionIndex + 1} / ${guessMaterials.length}`} color="success" />
            <Stack direction="row" spacing={2} alignItems="center">
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'warning.main' }}>
                <ZapIcon sx={{ width: 16, height: 16 }} />
                <Typography sx={{ fontWeight: 'bold' }}>{streak}</Typography>
              </Stack>
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{
                  color: timeLeft <= 5 ? 'error.main' : 'text.secondary',
                  animation: timeLeft <= 5 ? 'pulse 1s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                  },
                }}
              >
                <TimerIcon sx={{ width: 16, height: 16 }} />
                <Typography sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{timeLeft}s</Typography>
              </Stack>
            </Stack>
          </Stack>

          <Paper sx={{ p: 2, mb: 3, backgroundColor: 'primary.light', border: '1px solid', borderColor: 'primary.main' }}>
            <Typography sx={{ color: 'text.primary', fontStyle: 'italic' }}>"{m.description}"</Typography>
          </Paper>

          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 2 }}>
            ¿Que material es?
          </Typography>

          <Stack spacing={1.5}>
            {m.options.map((opt, idx) => (
              <Box
                key={idx}
                component="button"
                onClick={() => handleAnswer(idx)}
                disabled={answered}
                sx={{
                  width: '100%',
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  cursor: answered ? 'default' : 'pointer',
                  backgroundColor: answered
                    ? idx === m.correct
                      ? 'success.light'
                      : idx === selectedAnswer
                        ? 'error.light'
                        : 'grey.100'
                    : 'grey.50',
                  borderColor: answered
                    ? idx === m.correct
                      ? 'success.main'
                      : idx === selectedAnswer
                        ? 'error.main'
                        : 'grey.300'
                    : 'grey.300',
                  color: answered
                    ? idx === m.correct
                      ? 'success.dark'
                      : idx === selectedAnswer
                        ? 'error.dark'
                        : 'text.secondary'
                    : 'text.primary',
                  '&:hover': !answered ? {
                    borderColor: 'primary.main',
                    backgroundColor: 'primary.light',
                  } : {},
                  '&:disabled': {
                    cursor: 'default',
                  },
                }}
              >
                <Typography sx={{ fontWeight: 500 }}>{opt}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      );
    }

    // Cuanto Cuesta
    if (activeGame === "price") {
      const m = priceMaterials[questionIndex];
      return (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Chip label={`Precio ${questionIndex + 1} / ${priceMaterials.length}`} color="warning" />
            <Stack direction="row" spacing={2} alignItems="center">
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'warning.main' }}>
                <ZapIcon sx={{ width: 16, height: 16 }} />
                <Typography sx={{ fontWeight: 'bold' }}>{streak}</Typography>
              </Stack>
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{
                  color: timeLeft <= 5 ? 'error.main' : 'text.secondary',
                  animation: timeLeft <= 5 ? 'pulse 1s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                  },
                }}
              >
                <TimerIcon sx={{ width: 16, height: 16 }} />
                <Typography sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{timeLeft}s</Typography>
              </Stack>
            </Stack>
          </Stack>

          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <DollarSignIcon sx={{ width: 48, height: 48, mx: 'auto', mb: 1.5, color: 'warning.main' }} />
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
              {m.name}
            </Typography>
            <Typography sx={{ color: 'text.secondary', mt: 1 }}>
              ¿Cual es el precio aproximado?
            </Typography>
          </Box>

          <Stack direction="row" spacing={2}>
            {m.options.map((price, idx) => (
              <Box
                key={idx}
                component="button"
                onClick={() => handleAnswer(idx)}
                disabled={answered}
                sx={{
                  flex: 1,
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  cursor: answered ? 'default' : 'pointer',
                  backgroundColor: answered
                    ? price === m.correctPrice
                      ? 'success.light'
                      : idx === selectedAnswer
                        ? 'error.light'
                        : 'grey.100'
                    : 'grey.50',
                  borderColor: answered
                    ? price === m.correctPrice
                      ? 'success.main'
                      : idx === selectedAnswer
                        ? 'error.main'
                        : 'grey.300'
                    : 'grey.300',
                  '&:hover': !answered ? {
                    borderColor: 'warning.main',
                    backgroundColor: 'warning.light',
                  } : {},
                  '&:disabled': {
                    cursor: 'default',
                  },
                }}
              >
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 'bold',
                    color: answered && price === m.correctPrice
                      ? 'success.dark'
                      : answered && idx === selectedAnswer
                        ? 'error.dark'
                        : 'text.primary',
                  }}
                >
                  ${price.toLocaleString()}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>USD</Typography>
              </Box>
            ))}
          </Stack>

          {answered && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Precio correcto: <Box component="span" sx={{ fontWeight: 'bold', color: 'success.main' }}>${m.correctPrice.toLocaleString()} USD</Box>
              </Typography>
            </Box>
          )}
        </Box>
      );
    }

    // Categorias (Drag & Drop)
    if (activeGame === "category") {
      const round = categoryGame.rounds[categoryRound];
      const unassigned = round.materials.filter(m => !categoryAssignments[m.id]);

      return (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Chip label={`Ronda ${categoryRound + 1} / ${categoryGame.rounds.length}`} color="info" />
            <Typography sx={{ color: 'text.secondary' }}>
              Puntaje: <Box component="span" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{score}</Box>
            </Typography>
          </Stack>

          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}>
            Arrastra cada material a su categoria
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Clasifica los 3 materiales correctamente
          </Typography>

          {/* Materiales sin asignar */}
          <Paper
            sx={{
              mb: 3,
              p: 2,
              backgroundColor: 'grey.50',
              border: '2px dashed',
              borderColor: 'grey.300',
              minHeight: 80,
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, mb: 1.5, display: 'block' }}>
              Materiales:
            </Typography>
            <Stack direction="row" flexWrap="wrap" spacing={1}>
              {unassigned.map(m => (
                <Box
                  key={m.id}
                  draggable
                  onDragStart={() => handleDragStart(m)}
                  sx={{
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    backgroundColor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'grey.300',
                    cursor: 'grab',
                    '&:active': { cursor: 'grabbing' },
                    '&:hover': { borderColor: 'primary.main' },
                    transition: 'all 0.2s',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>{m.name}</Typography>
                </Box>
              ))}
              {unassigned.length === 0 && (
                <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                  Todos los materiales asignados
                </Typography>
              )}
            </Stack>
          </Paper>

          {/* Categorias */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ mb: 3 }}
          >
            {categoryGame.categories.map(cat => {
              const assigned = round.materials.filter(m => categoryAssignments[m.id] === cat.id);
              return (
                <Box
                  key={cat.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(cat.id)}
                  sx={{
                    flex: 1,
                    p: 2,
                    borderRadius: 2,
                    border: '2px dashed',
                    borderColor: `${cat.color}50`,
                    backgroundColor: `${cat.color}10`,
                    minHeight: 120,
                    transition: 'all 0.2s',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5, color: cat.color }}>
                    {cat.name}
                  </Typography>
                  <Stack spacing={1}>
                    {assigned.map(m => (
                      <Box
                        key={m.id}
                        sx={{
                          px: 1.5,
                          py: 1,
                          borderRadius: 1,
                          backgroundColor: 'background.paper',
                          border: '1px solid',
                          borderColor: cat.color,
                        }}
                      >
                        <Typography variant="body2">{m.name}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              );
            })}
          </Stack>

          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              startIcon={<CheckCircleIcon />}
              onClick={checkCategoryAnswers}
              disabled={unassigned.length > 0}
            >
              Verificar Respuestas
            </Button>
          </Box>
        </Box>
      );
    }

    return null;
  };

  // Menu principal de juegos
  if (!activeGame) {
    return (
      <Box sx={{ maxWidth: 1024, mx: 'auto' }}>
        <Stack spacing={3}>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1, textTransform: 'uppercase' }}>
                <TrophyIcon sx={{ color: 'warning.main' }} />
                Trivias SPM
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Tu puntaje total</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{myStats.total_score.toLocaleString()}</Typography>
            </Box>
          </Stack>

          {/* Grid de juegos */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            flexWrap="wrap"
            sx={{ gap: 2 }}
          >
            {/* Quiz SPM */}
            <Paper
              onClick={startQuiz}
              sx={{
                flex: { xs: '1 1 100%', md: '1 1 calc(50% - 8px)' },
                p: 3,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: 2,
                },
              }}
            >
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    backgroundColor: 'primary.light',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <BookOpenIcon sx={{ color: 'primary.main' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>Quiz SPM</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>Responde preguntas sobre el sistema y sus procesos</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    <Chip label={`${quizQuestions.length} preguntas`} size="small" />
                    <Chip label="15s por pregunta" size="small" color="info" />
                  </Stack>
                </Box>
                <ArrowRightIcon sx={{ color: 'text.secondary' }} />
              </Stack>
            </Paper>

            {/* Adivina el Material */}
            <Paper
              onClick={startGuessMaterial}
              sx={{
                flex: { xs: '1 1 100%', md: '1 1 calc(50% - 8px)' },
                p: 3,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'success.main',
                  boxShadow: 2,
                },
              }}
            >
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    backgroundColor: 'success.light',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <HelpCircleIcon sx={{ color: 'success.main' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>Adivina el Material</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>Lee la descripcion y elige el material correcto</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    <Chip label={`${guessMaterials.length} materiales`} size="small" />
                    <Chip label="20s por pregunta" size="small" color="success" />
                  </Stack>
                </Box>
                <ArrowRightIcon sx={{ color: 'text.secondary' }} />
              </Stack>
            </Paper>

            {/* Cuanto Cuesta */}
            <Paper
              onClick={startPriceGame}
              sx={{
                flex: { xs: '1 1 100%', md: '1 1 calc(50% - 8px)' },
                p: 3,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'warning.main',
                  boxShadow: 2,
                },
              }}
            >
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    backgroundColor: 'warning.light',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <DollarSignIcon sx={{ color: 'warning.main' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>¿Cuanto Cuesta?</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>Adivina el precio correcto del material</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    <Chip label={`${priceMaterials.length} materiales`} size="small" />
                    <Chip label="12s por pregunta" size="small" color="warning" />
                  </Stack>
                </Box>
                <ArrowRightIcon sx={{ color: 'text.secondary' }} />
              </Stack>
            </Paper>

            {/* Categorias */}
            <Paper
              onClick={startCategoryGame}
              sx={{
                flex: { xs: '1 1 100%', md: '1 1 calc(50% - 8px)' },
                p: 3,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'info.main',
                  boxShadow: 2,
                },
              }}
            >
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    backgroundColor: 'info.light',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <LayersIcon sx={{ color: 'info.main' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>Categorias</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>Arrastra cada material a su grupo correcto</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    <Chip label={`${categoryGame.rounds.length} rondas`} size="small" />
                    <Chip label="Drag & Drop" size="small" color="info" />
                  </Stack>
                </Box>
                <ArrowRightIcon sx={{ color: 'text.secondary' }} />
              </Stack>
            </Paper>
          </Stack>

          {/* Ranking */}
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <MedalIcon sx={{ color: 'warning.main' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Ranking de Jugadores</Typography>
            </Stack>

            {loadingRankings ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : rankings.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                <TrophyIcon sx={{ width: 48, height: 48, mx: 'auto', mb: 1.5, opacity: 0.3 }} />
                <Typography>Aun no hay puntuaciones. Se el primero en jugar!</Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {rankings.slice(0, 10).map((r, idx) => (
                  <Box
                    key={r.user_id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: r.user_id === user?.id ? 'primary.light' : 'grey.50',
                      border: r.user_id === user?.id ? '1px solid' : 'none',
                      borderColor: 'primary.main',
                    }}
                  >
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {idx === 0 ? (
                        <CrownIcon sx={{ color: 'warning.main' }} />
                      ) : idx === 1 ? (
                        <MedalIcon sx={{ color: 'grey.500' }} />
                      ) : idx === 2 ? (
                        <MedalIcon sx={{ color: '#CD7F32' }} />
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>{idx + 1}</Typography>
                      )}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 500, color: 'text.primary' }}>{r.user_name}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{r.games_played} partidas</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontWeight: 'bold', color: 'primary.main' }}>{r.total_score.toLocaleString()}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>puntos</Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>
      </Box>
    );
  }

  // Pantalla de juego activo
  return (
    <Box sx={{ maxWidth: 672, mx: 'auto' }}>
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {activeGame === "quiz" && <><BookOpenIcon sx={{ color: 'primary.main' }} /> Quiz SPM</>}
            {activeGame === "guess" && <><HelpCircleIcon sx={{ color: 'success.main' }} /> Adivina el Material</>}
            {activeGame === "price" && <><DollarSignIcon sx={{ color: 'warning.main' }} /> ¿Cuanto Cuesta?</>}
            {activeGame === "category" && <><LayersIcon sx={{ color: 'info.main' }} /> Categorias</>}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <StarIcon sx={{ width: 16, height: 16, color: 'warning.main' }} />
            <Typography sx={{ fontWeight: 'bold', color: 'text.primary' }}>{score}</Typography>
          </Stack>
        </Stack>
        {renderGameContent()}
      </Paper>

      {!gameOver && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button
            variant="text"
            startIcon={<ArrowLeftIcon />}
            onClick={exitGame}
          >
            Salir del juego
          </Button>
        </Box>
      )}
    </Box>
  );
}
