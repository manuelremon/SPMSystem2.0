import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import {
  Trophy,
  Star,
  Zap,
  Target,
  HelpCircle,
  DollarSign,
  Layers,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Timer,
  Medal,
  Crown,
  RefreshCw,
} from "lucide-react";
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
      console.error("Error loading rankings", err);
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
      console.error("Error saving score", err);
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
        <div className="text-center py-8">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-[var(--warning)]" />
          <h2 className="text-2xl font-bold text-[var(--fg)] mb-2">Juego Terminado!</h2>
          <p className="text-4xl font-bold text-[var(--primary)] mb-4">{score} puntos</p>
          <p className="text-[var(--fg-muted)] mb-6">
            Respuestas correctas: {correctAnswers} / {totalQuestions}
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => {
              if (activeGame === "quiz") startQuiz();
              else if (activeGame === "guess") startGuessMaterial();
              else if (activeGame === "price") startPriceGame();
              else if (activeGame === "category") startCategoryGame();
            }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Jugar de nuevo
            </Button>
            <Button variant="outline" onClick={exitGame}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </div>
        </div>
      );
    }

    // Quiz SPM
    if (activeGame === "quiz") {
      const q = quizQuestions[questionIndex];
      return (
        <div>
          <div className="flex items-center justify-between mb-6">
            <Badge variant="info">Pregunta {questionIndex + 1} / {quizQuestions.length}</Badge>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-[var(--warning)]">
                <Zap className="w-4 h-4" />
                <span className="font-bold">{streak}</span>
              </div>
              <div className={`flex items-center gap-1 ${timeLeft <= 5 ? 'text-[var(--danger)] animate-pulse' : 'text-[var(--fg-muted)]'}`}>
                <Timer className="w-4 h-4" />
                <span className="font-mono font-bold">{timeLeft}s</span>
              </div>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-[var(--fg)] mb-6">{q.question}</h3>

          <div className="grid gap-3">
            {q.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                disabled={answered}
                className={`
                  w-full p-4 rounded-lg border text-left transition-all
                  ${answered
                    ? idx === q.correct
                      ? 'bg-[var(--success-bg)] border-[var(--success)] text-[var(--success)]'
                      : idx === selectedAnswer
                        ? 'bg-[var(--danger-bg)] border-[var(--danger)] text-[var(--danger)]'
                        : 'bg-[var(--bg-soft)] border-[var(--border)] text-[var(--fg-muted)]'
                    : 'bg-[var(--bg-soft)] border-[var(--border)] text-[var(--fg)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/10'
                  }
                `}
              >
                <span className="font-medium">{opt}</span>
              </button>
            ))}
          </div>

          {answered && (
            <div className="mt-4 p-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)]">
              <p className="text-sm text-[var(--fg-muted)]">
                <strong className="text-[var(--fg)]">Explicacion:</strong> {q.explanation}
              </p>
            </div>
          )}
        </div>
      );
    }

    // Adivina el Material
    if (activeGame === "guess") {
      const m = guessMaterials[questionIndex];
      return (
        <div>
          <div className="flex items-center justify-between mb-6">
            <Badge variant="success">Material {questionIndex + 1} / {guessMaterials.length}</Badge>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-[var(--warning)]">
                <Zap className="w-4 h-4" />
                <span className="font-bold">{streak}</span>
              </div>
              <div className={`flex items-center gap-1 ${timeLeft <= 5 ? 'text-[var(--danger)] animate-pulse' : 'text-[var(--fg-muted)]'}`}>
                <Timer className="w-4 h-4" />
                <span className="font-mono font-bold">{timeLeft}s</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/30 mb-6">
            <p className="text-[var(--fg)] italic">"{m.description}"</p>
          </div>

          <h3 className="text-lg font-semibold text-[var(--fg)] mb-4">¿Que material es?</h3>

          <div className="grid gap-3">
            {m.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                disabled={answered}
                className={`
                  w-full p-4 rounded-lg border text-left transition-all
                  ${answered
                    ? idx === m.correct
                      ? 'bg-[var(--success-bg)] border-[var(--success)] text-[var(--success)]'
                      : idx === selectedAnswer
                        ? 'bg-[var(--danger-bg)] border-[var(--danger)] text-[var(--danger)]'
                        : 'bg-[var(--bg-soft)] border-[var(--border)] text-[var(--fg-muted)]'
                    : 'bg-[var(--bg-soft)] border-[var(--border)] text-[var(--fg)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/10'
                  }
                `}
              >
                <span className="font-medium">{opt}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Cuanto Cuesta
    if (activeGame === "price") {
      const m = priceMaterials[questionIndex];
      return (
        <div>
          <div className="flex items-center justify-between mb-6">
            <Badge variant="warning">Precio {questionIndex + 1} / {priceMaterials.length}</Badge>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-[var(--warning)]">
                <Zap className="w-4 h-4" />
                <span className="font-bold">{streak}</span>
              </div>
              <div className={`flex items-center gap-1 ${timeLeft <= 5 ? 'text-[var(--danger)] animate-pulse' : 'text-[var(--fg-muted)]'}`}>
                <Timer className="w-4 h-4" />
                <span className="font-mono font-bold">{timeLeft}s</span>
              </div>
            </div>
          </div>

          <div className="text-center mb-6">
            <DollarSign className="w-12 h-12 mx-auto mb-3 text-[var(--warning)]" />
            <h3 className="text-xl font-bold text-[var(--fg)]">{m.name}</h3>
            <p className="text-[var(--fg-muted)] mt-2">¿Cual es el precio aproximado?</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {m.options.map((price, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                disabled={answered}
                className={`
                  p-4 rounded-lg border text-center transition-all
                  ${answered
                    ? price === m.correctPrice
                      ? 'bg-[var(--success-bg)] border-[var(--success)]'
                      : idx === selectedAnswer
                        ? 'bg-[var(--danger-bg)] border-[var(--danger)]'
                        : 'bg-[var(--bg-soft)] border-[var(--border)]'
                    : 'bg-[var(--bg-soft)] border-[var(--border)] hover:border-[var(--warning)] hover:bg-[var(--warning)]/10'
                  }
                `}
              >
                <span className={`text-2xl font-bold ${answered && price === m.correctPrice ? 'text-[var(--success)]' : answered && idx === selectedAnswer ? 'text-[var(--danger)]' : 'text-[var(--fg)]'}`}>
                  ${price.toLocaleString()}
                </span>
                <p className="text-xs text-[var(--fg-muted)] mt-1">USD</p>
              </button>
            ))}
          </div>

          {answered && (
            <div className="mt-4 text-center">
              <p className="text-sm text-[var(--fg-muted)]">
                Precio correcto: <strong className="text-[var(--success)]">${m.correctPrice.toLocaleString()} USD</strong>
              </p>
            </div>
          )}
        </div>
      );
    }

    // Categorias (Drag & Drop)
    if (activeGame === "category") {
      const round = categoryGame.rounds[categoryRound];
      const unassigned = round.materials.filter(m => !categoryAssignments[m.id]);

      return (
        <div>
          <div className="flex items-center justify-between mb-6">
            <Badge variant="info">Ronda {categoryRound + 1} / {categoryGame.rounds.length}</Badge>
            <div className="text-[var(--fg-muted)]">
              Puntaje: <span className="font-bold text-[var(--primary)]">{score}</span>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-[var(--fg)] mb-2">Arrastra cada material a su categoria</h3>
          <p className="text-sm text-[var(--fg-muted)] mb-6">Clasifica los 3 materiales correctamente</p>

          {/* Materiales sin asignar */}
          <div className="mb-6 p-4 rounded-lg bg-[var(--bg-soft)] border border-dashed border-[var(--border)] min-h-[80px]">
            <p className="text-xs text-[var(--fg-muted)] uppercase tracking-wider mb-3">Materiales:</p>
            <div className="flex flex-wrap gap-2">
              {unassigned.map(m => (
                <div
                  key={m.id}
                  draggable
                  onDragStart={() => handleDragStart(m)}
                  className="px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] cursor-grab active:cursor-grabbing hover:border-[var(--primary)] transition-all"
                >
                  <span className="text-sm font-medium text-[var(--fg)]">{m.name}</span>
                </div>
              ))}
              {unassigned.length === 0 && (
                <p className="text-sm text-[var(--fg-subtle)] italic">Todos los materiales asignados</p>
              )}
            </div>
          </div>

          {/* Categorias */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {categoryGame.categories.map(cat => {
              const assigned = round.materials.filter(m => categoryAssignments[m.id] === cat.id);
              return (
                <div
                  key={cat.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(cat.id)}
                  className="p-4 rounded-lg border-2 border-dashed transition-all min-h-[120px]"
                  style={{ borderColor: `${cat.color}50`, backgroundColor: `${cat.color}10` }}
                >
                  <p className="text-sm font-semibold mb-3" style={{ color: cat.color }}>{cat.name}</p>
                  <div className="space-y-2">
                    {assigned.map(m => (
                      <div
                        key={m.id}
                        className="px-3 py-2 rounded bg-[var(--card)] border text-sm"
                        style={{ borderColor: cat.color }}
                      >
                        {m.name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center">
            <Button
              onClick={checkCategoryAnswers}
              disabled={unassigned.length > 0}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Verificar Respuestas
            </Button>
          </div>
        </div>
      );
    }

    return null;
  };

  // Menu principal de juegos
  if (!activeGame) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--fg)] flex items-center gap-2">
              <Trophy className="w-7 h-7 text-[var(--warning)]" />
              Trivias SPM
            </h1>
            <p className="text-sm text-[var(--fg-muted)] mt-1">Aprende y compite, tienes una oportunidad al mes!! Suerte!! <span className="text-[var(--success)]">🍀</span></p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[var(--fg-muted)]">Tu puntaje total</p>
            <p className="text-2xl font-bold text-[var(--primary)]">{myStats.total_score.toLocaleString()}</p>
          </div>
        </div>

        {/* Grid de juegos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Quiz SPM */}
          <Card className="hover:border-[var(--primary)] transition-all cursor-pointer group" onClick={startQuiz}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-[var(--primary)]/20 grid place-items-center flex-shrink-0 group-hover:bg-[var(--primary)]/30 transition-all">
                  <BookOpen className="w-7 h-7 text-[var(--primary)]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[var(--fg)] text-lg">Quiz SPM</h3>
                  <p className="text-sm text-[var(--fg-muted)] mt-1">Responde preguntas sobre el sistema y sus procesos</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="neutral">{quizQuestions.length} preguntas</Badge>
                    <Badge variant="info">15s por pregunta</Badge>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-[var(--fg-muted)] group-hover:text-[var(--primary)] transition-all" />
              </div>
            </CardContent>
          </Card>

          {/* Adivina el Material */}
          <Card className="hover:border-[var(--success)] transition-all cursor-pointer group" onClick={startGuessMaterial}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-[var(--success)]/20 grid place-items-center flex-shrink-0 group-hover:bg-[var(--success)]/30 transition-all">
                  <HelpCircle className="w-7 h-7 text-[var(--success)]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[var(--fg)] text-lg">Adivina el Material</h3>
                  <p className="text-sm text-[var(--fg-muted)] mt-1">Lee la descripcion y elige el material correcto</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="neutral">{guessMaterials.length} materiales</Badge>
                    <Badge variant="success">20s por pregunta</Badge>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-[var(--fg-muted)] group-hover:text-[var(--success)] transition-all" />
              </div>
            </CardContent>
          </Card>

          {/* Cuanto Cuesta */}
          <Card className="hover:border-[var(--warning)] transition-all cursor-pointer group" onClick={startPriceGame}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-[var(--warning)]/20 grid place-items-center flex-shrink-0 group-hover:bg-[var(--warning)]/30 transition-all">
                  <DollarSign className="w-7 h-7 text-[var(--warning)]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[var(--fg)] text-lg">¿Cuanto Cuesta?</h3>
                  <p className="text-sm text-[var(--fg-muted)] mt-1">Adivina el precio correcto del material</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="neutral">{priceMaterials.length} materiales</Badge>
                    <Badge variant="warning">12s por pregunta</Badge>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-[var(--fg-muted)] group-hover:text-[var(--warning)] transition-all" />
              </div>
            </CardContent>
          </Card>

          {/* Categorias */}
          <Card className="hover:border-[var(--accent)] transition-all cursor-pointer group" onClick={startCategoryGame}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-[var(--accent)]/20 grid place-items-center flex-shrink-0 group-hover:bg-[var(--accent)]/30 transition-all">
                  <Layers className="w-7 h-7 text-[var(--accent)]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[var(--fg)] text-lg">Categorias</h3>
                  <p className="text-sm text-[var(--fg-muted)] mt-1">Arrastra cada material a su grupo correcto</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="neutral">{categoryGame.rounds.length} rondas</Badge>
                    <Badge variant="info">Drag & Drop</Badge>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-[var(--fg-muted)] group-hover:text-[var(--accent)] transition-all" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ranking */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Medal className="w-5 h-5 text-[var(--warning)]" />
              <CardTitle className="text-base">Ranking de Jugadores</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loadingRankings ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)] mx-auto"></div>
              </div>
            ) : rankings.length === 0 ? (
              <div className="text-center py-8 text-[var(--fg-muted)]">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Aun no hay puntuaciones. Se el primero en jugar!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rankings.slice(0, 10).map((r, idx) => (
                  <div
                    key={r.user_id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      r.user_id === user?.id
                        ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/30'
                        : 'bg-[var(--bg-soft)]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full grid place-items-center flex-shrink-0">
                      {idx === 0 ? (
                        <Crown className="w-5 h-5 text-[var(--warning)]" />
                      ) : idx === 1 ? (
                        <Medal className="w-5 h-5 text-[var(--fg-muted)]" />
                      ) : idx === 2 ? (
                        <Medal className="w-5 h-5 text-amber-600" />
                      ) : (
                        <span className="text-sm font-bold text-[var(--fg-muted)]">{idx + 1}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[var(--fg)]">{r.user_name}</p>
                      <p className="text-xs text-[var(--fg-muted)]">{r.games_played} partidas</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[var(--primary)]">{r.total_score.toLocaleString()}</p>
                      <p className="text-xs text-[var(--fg-muted)]">puntos</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pantalla de juego activo
  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              {activeGame === "quiz" && <><BookOpen className="w-5 h-5 text-[var(--primary)]" /> Quiz SPM</>}
              {activeGame === "guess" && <><HelpCircle className="w-5 h-5 text-[var(--success)]" /> Adivina el Material</>}
              {activeGame === "price" && <><DollarSign className="w-5 h-5 text-[var(--warning)]" /> ¿Cuanto Cuesta?</>}
              {activeGame === "category" && <><Layers className="w-5 h-5 text-[var(--accent)]" /> Categorias</>}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-[var(--warning)]" />
              <span className="font-bold text-[var(--fg)]">{score}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {renderGameContent()}
        </CardContent>
      </Card>

      {!gameOver && (
        <div className="mt-4 text-center">
          <Button variant="ghost" onClick={exitGame}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Salir del juego
          </Button>
        </div>
      )}
    </div>
  );
}
