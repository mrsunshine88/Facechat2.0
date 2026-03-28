"use client";

import { useEffect, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Trophy, Gamepad2, AlertCircle } from 'lucide-react';

export default function SnakeGame({ viewerUser }: { viewerUser: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Spel-states
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Leaderboard-states
  const [topScores, setTopScores] = useState<any[]>([]);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Nokias klassiska färger
  const BG_COLOR = '#c7f0d8'; 
  const FG_COLOR = '#43523d';

  // Spel-konstanter
  const GRID_SIZE = 13; // Lite mindre för mobilen (13 * 20 = 260px)
  const TILE_COUNT = 20; // 20x20 spelyta. Bredd: 20*13 = 260px.
  
  // Mutable game state för loopen (slippa re-renders mitt i frame)
  const gameState = useRef({
    isPlaying: false,
    score: 0,
    snake: [{ x: 10, y: 10 }],
    food: { x: 5, y: 5 },
    dx: 0,
    dy: -1,
    nextDx: 0,
    nextDy: -1,
    speed: 120, // millisekunder per frame
    lastRender: 0,
    animationFrameId: 0
  });

  const fetchHighScores = async () => {
    const { data: scores, error } = await supabase
      .from('snake_scores')
      .select(`
        id,
        score,
        created_at,
        user_id,
        profiles ( username, avatar_url )
      `)
      .order('score', { ascending: false })
      .limit(5);

    if (!error && scores) {
      setTopScores(scores);
    }
  };

  useEffect(() => {
    fetchHighScores();
    return () => stopGame();
  }, []);

  const spawnFood = (snakeBody: any[]) => {
    let newFood: { x: number, y: number };
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * TILE_COUNT),
        y: Math.floor(Math.random() * TILE_COUNT)
      };
      // Se till att äpplet inte spawnar inuti ormen
      const isInsideSnake = snakeBody.some(segment => segment.x === newFood.x && segment.y === newFood.y);
      if (!isInsideSnake) break;
    }
    return newFood;
  };

  const startGame = () => {
    if (!viewerUser) return; // Måste vara inloggad för att spela the real deal
    
    setIsPlaying(true);
    setIsGameOver(false);
    setScore(0);
    
    gameState.current = {
      isPlaying: true,
      score: 0,
      snake: [
        { x: 10, y: 10 },
        { x: 10, y: 11 },
        { x: 10, y: 12 }
      ],
      food: spawnFood([{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }]),
      dx: 0,
      dy: -1,
      nextDx: 0,
      nextDy: -1,
      speed: 120,
      lastRender: performance.now(),
      animationFrameId: 0
    };

    if (canvasRef.current) {
        // Fix focus for keyboard
        canvasRef.current.focus();
    }

    gameState.current.animationFrameId = requestAnimationFrame(gameLoop);
  };

  const stopGame = () => {
    if (gameState.current.animationFrameId) {
      cancelAnimationFrame(gameState.current.animationFrameId);
    }
  };

  const sendNotification = async (targetUserId: string, message: string) => {
    // Spara notisen i databasen
    const { error: notifError } = await supabase.from('notifications').insert({
        receiver_id: targetUserId,
        actor_id: viewerUser.id,
        type: 'high_score',
        content: message,
        link: '/krypin?spela=true'
    });

    if (notifError) console.error("Could not send db notification:", notifError);

    // Kalla på push (om de har PWA)
    await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           userId: targetUserId, 
           title: "🏆 Ny Snake-Härskare!", 
           message: message,
           url: '/krypin?spela=true'
        })
    });
  };

  const checkHighscoreKnockout = async (finalScore: number) => {
    setIsSubmitting(true);
    
    // Vem var på plats 1, 2, etc? (Vi vet detta från topScores state:n som vi hämtade innan)
    const oldTopScores = [...topScores];

    // Spara nya scoret i databasen
    const { error } = await supabase.from('snake_scores').insert({
        user_id: viewerUser.id,
        score: finalScore
    });

    if (!error) {
       // Hämta den UPPDATERADE leaderboarden
       await fetchHighScores();

       // Låt oss göra lite snabb notis-magi om man slog någon!
       // Kolla vem som var nummer 1 innan, om det var någon annan, och nu är VI nummer 1!
       // Hittar vilken plats vi STJÄL på listan
       let rankStolen = -1;
       for (let i = 0; i < oldTopScores.length; i++) {
          if (finalScore > oldTopScores[i].score) {
             rankStolen = i;
             break;
          }
       }
       
       if (rankStolen !== -1) {
          const stolenFrom = oldTopScores[rankStolen];
          
          if (stolenFrom.user_id !== viewerUser.id) {
             const rankName = rankStolen + 1;
             const message = rankStolen === 0 
                 ? `Game over dunderklumpen! @${viewerUser.username} krossade just ditt rekord i Snake och snodde 1:a platsen!`
                 : `Gissa vem som precis snodde din ${rankName}:e plats i Snake? @${viewerUser.username}! In och ta tillbaka den!`;
             
             await sendNotification(stolenFrom.user_id, message);
          }
          
          // Om listan var full (osv), den gamla 5:an åker ut oavsett vems plats vi tog, SÅ LÄNGE vi inte tog 5:e platsen själv.
          if (oldTopScores.length >= 5 && rankStolen < 4) {
             const gamlaFemman = oldTopScores[4];
             if (gamlaFemman.user_id !== viewerUser.id && gamlaFemman.user_id !== stolenFrom.user_id) {
                await sendNotification(
                   gamlaFemman.user_id,
                   `Ajtajtaj... @${viewerUser.username} har tyvärr puttat ner dig från Topp-5 listan i Snake! Spela direkt för att ta tillbaka din plats!`
                );
             }
          }
       }
    }
    
    setIsSubmitting(false);
  };

  const gameLoop = (timestamp: number) => {
    if (!gameState.current.isPlaying) return;
    
    const state = gameState.current;
    
    // Styra hastigheten
    if (timestamp - state.lastRender < state.speed) {
      state.animationFrameId = requestAnimationFrame(gameLoop);
      return;
    }
    
    state.lastRender = timestamp;
    
    // Updatera direction baserat fr buffer
    state.dx = state.nextDx;
    state.dy = state.nextDy;
    
    // Flytta huvudet
    const head = { x: state.snake[0].x + state.dx, y: state.snake[0].y + state.dy };
    
    // Krock med väggarna
    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
      gameOver();
      return;
    }
    
    // Krock med sig själv
    if (state.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
      gameOver();
      return;
    }
    
    state.snake.unshift(head);
    
    // Kolla om vi åt äpplet
    if (head.x === state.food.x && head.y === state.food.y) {
      state.score += 10;
      setScore(state.score);
      state.food = spawnFood(state.snake);
      // Lite snabbare för varje äpple
      state.speed = Math.max(50, state.speed - 2); 
    } else {
      state.snake.pop(); // Ta bort svansen om vi inte åt mat
    }
    
    draw();
    
    if (gameState.current.isPlaying) {
      state.animationFrameId = requestAnimationFrame(gameLoop);
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const state = gameState.current;
    
    // Fyll grön Nokia-bakgrund
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Rita "Pixel"-rutnät (supersvagt, för retrokänslan)
    ctx.strokeStyle = "rgba(67, 82, 61, 0.1)"; 
    for(let i=0; i<TILE_COUNT; i++) {
        for(let j=0; j<TILE_COUNT; j++) {
            ctx.strokeRect(i*GRID_SIZE, j*GRID_SIZE, GRID_SIZE, GRID_SIZE);
        }
    }

    // Rita maten (Blinkande fyrkant istället för äpple!)
    ctx.fillStyle = FG_COLOR;
    const padding = 2; // Ge det lite marginal
    ctx.fillRect(state.food.x * GRID_SIZE + padding, state.food.y * GRID_SIZE + padding, GRID_SIZE - padding*2, GRID_SIZE - padding*2);
    
    // Rita ormen
    state.snake.forEach((segment, index) => {
      // Huvudet lite större, svansen mindre
      const isHead = index === 0;
      ctx.fillStyle = FG_COLOR;
      
      if (isHead) {
          ctx.fillRect(segment.x * GRID_SIZE + 1, segment.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
      } else {
          // Svansen har en liten gap mellan blocken för retro effekt
          ctx.fillRect(segment.x * GRID_SIZE + 2, segment.y * GRID_SIZE + 2, GRID_SIZE - 4, GRID_SIZE - 4);
      }
    });
  };

  const gameOver = () => {
    setIsPlaying(false);
    setIsGameOver(true);
    gameState.current.isPlaying = false;
    
    const finalScore = gameState.current.score;
    // Kolla Highscore, men kom ihåg React state uppdateras asynkront.
    setScore(finalScore); 
    
    if (finalScore > 0) {
        checkHighscoreKnockout(finalScore);
    }
  };

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Förhindra att webbläsaren scrollar när vi styr med piltangenterna
      if (gameState.current.isPlaying && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (!isPlaying) return;
      
      const state = gameState.current;
      
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          if (state.dy === 0) { state.nextDx = 0; state.nextDy = -1; e.preventDefault(); }
          break;
        case 'ArrowDown':
        case 's':
          if (state.dy === 0) { state.nextDx = 0; state.nextDy = 1; e.preventDefault(); }
          break;
        case 'ArrowLeft':
        case 'a':
          if (state.dx === 0) { state.nextDx = -1; state.nextDy = 0; e.preventDefault(); }
          break;
        case 'ArrowRight':
        case 'd':
          if (state.dx === 0) { state.nextDx = 1; state.nextDy = 0; e.preventDefault(); }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  // Touch/D-pad Handlers
  const handleDir = (newDx: number, newDy: number) => {
      const state = gameState.current;
      // Förhindra svängning över 180 grader
      if (state.dx !== 0 && newDx !== 0) return;
      if (state.dy !== 0 && newDy !== 0) return;
      
      state.nextDx = newDx;
      state.nextDy = newDy;
  };

  // För drag-swipe på mobilen
  const touchStart = useRef({ x: 0, y: 0 });
  const handleTouchStart = (e: React.TouchEvent) => {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
      const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      const dx = touchEnd.x - touchStart.current.x;
      const dy = touchEnd.y - touchStart.current.y;
      
      if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal swipe
          if (Math.abs(dx) > 30) handleDir(dx > 0 ? 1 : -1, 0);
      } else {
          // Vertical swipe
          if (Math.abs(dy) > 30) handleDir(0, dy > 0 ? 1 : -1);
      }
  };


  return (
    <div className="card inner-box" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
       
       <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '2rem', color: '#10b981', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
             <Gamepad2 size={32} /> R3TR0 SNAKE
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>En hyllning till gamla goda Nokia-tiderna. Tävla om legend-status på Krypinet!</p>
       </div>

       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'center' }}>
          
          {/* VÄNSTER: SPELSKÄRMEN */}
          <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '350px' }}>
             
             {/* Den Klassiska "Telefonens" Skärmram */}
             <div style={{ 
                backgroundColor: '#1a1d18', 
                padding: '1rem', 
                borderRadius: '16px 16px 4px 4px', 
                border: '4px solid #334155',
                borderBottomWidth: '10px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
             }}>
                 {/* Själva Canvas-ytan */}
                 <div 
                    style={{ position: 'relative', outline: 'none' }} 
                    tabIndex={0}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                 >
                    <canvas 
                        ref={canvasRef}
                        width={TILE_COUNT * GRID_SIZE} 
                        height={TILE_COUNT * GRID_SIZE}
                        style={{ 
                            backgroundColor: BG_COLOR, 
                            border: `4px solid ${FG_COLOR}`,
                            borderRadius: '4px',
                            display: 'block',
                            imageRendering: 'pixelated', // Krispiga pixlar!
                            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
                            touchAction: 'none' // Förhindrar swipe/scroll över själva canvasen på mobil
                        }}
                    />

                    {/* OVERLAYS för spelet (Start, Game Over) */}
                    {!isPlaying && !isGameOver && (
                       <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(199, 240, 216, 0.85)'}}>
                          <button onClick={startGame} className="hover-lift" style={{ backgroundColor: FG_COLOR, color: BG_COLOR, fontSize: '1.25rem', fontFamily: '"Courier New", monospace', fontWeight: 'bold', padding: '0.75rem 1.5rem', border: 'none', borderRadius: '4px', cursor: 'pointer', boxShadow: '4px 4px 0px rgba(0,0,0,0.3)' }}>STARTA (Svep / Piltangenter)</button>
                       </div>
                    )}

                    {isGameOver && (
                       <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(199, 240, 216, 0.95)'}}>
                          {score > 0 && (topScores.length === 0 || score > (topScores[0]?.score || 0)) ? (
                            <h3 style={{ margin: 0, color: '#ef4444', fontFamily: '"Courier New", monospace', fontSize: '1.5rem', fontWeight: '900', textAlign: 'center', animation: 'blinkEffect 0.5s infinite alternate' }}>🏆 NYTT REKORD!</h3>
                          ) : (
                            <h3 style={{ margin: 0, color: FG_COLOR, fontFamily: '"Courier New", monospace', fontSize: '1.5rem', fontWeight: '900', textAlign: 'center' }}>GAME OVER</h3>
                          )}
                          <p style={{ margin: '0.5rem 0 1.5rem 0', color: FG_COLOR, fontFamily: '"Courier New", monospace', fontSize: '1.2rem', fontWeight: 'bold' }}>Poäng: {score}</p>
                          <button onClick={startGame} className="hover-lift" style={{ backgroundColor: FG_COLOR, color: BG_COLOR, fontSize: '1rem', fontFamily: '"Courier New", monospace', fontWeight: 'bold', padding: '0.75rem 1.25rem', border: 'none', borderRadius: '4px', cursor: 'pointer', boxShadow: '2px 2px 0px rgba(0,0,0,0.3)' }}>SPELA IGEN</button>
                       </div>
                    )}
                 </div>

                 <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontFamily: '"Courier New", monospace', fontWeight: 'bold', color: '#c7f0d8' }}>
                    <span>SNAKE //</span>
                    <span>SCORE: {score}</span>
                 </div>
             </div>

             {/* MOBIL D-PAD ("Knappsatsen") Renderas alltid för retrokänslan */}
             <div style={{ 
                backgroundColor: '#334155', 
                width: '100%', 
                padding: '1rem', 
                borderRadius: '0 0 24px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
                borderTop: '2px solid #0f172a',
                touchAction: 'none' // Lås scroll och zoom även här när man smattrar knapparna
             }}>
                 <button onClick={(e) => { handleDir(0, -1); e.preventDefault(); }} disabled={!isPlaying} style={{ width: '60px', height: '45px', borderRadius: '8px', border: 'none', backgroundColor: '#94a3b8', boxShadow: '0 4px 0 #475569', opacity: isPlaying ? 1 : 0.5, cursor: isPlaying ? 'pointer' : 'default' }}>▲</button>
                 <div style={{ display: 'flex', gap: '2.5rem' }}>
                    <button onClick={(e) => { handleDir(-1, 0); e.preventDefault(); }} disabled={!isPlaying} style={{ width: '60px', height: '45px', borderRadius: '8px', border: 'none', backgroundColor: '#94a3b8', boxShadow: '0 4px 0 #475569', opacity: isPlaying ? 1 : 0.5, cursor: isPlaying ? 'pointer' : 'default' }}>◀</button>
                    <button onClick={(e) => { handleDir(1, 0); e.preventDefault(); }} disabled={!isPlaying} style={{ width: '60px', height: '45px', borderRadius: '8px', border: 'none', backgroundColor: '#94a3b8', boxShadow: '0 4px 0 #475569', opacity: isPlaying ? 1 : 0.5, cursor: isPlaying ? 'pointer' : 'default' }}>▶</button>
                 </div>
                 <button onClick={(e) => { handleDir(0, 1); e.preventDefault(); }} disabled={!isPlaying} style={{ width: '60px', height: '45px', borderRadius: '8px', border: 'none', backgroundColor: '#94a3b8', boxShadow: '0 4px 0 #475569', opacity: isPlaying ? 1 : 0.5, cursor: isPlaying ? 'pointer' : 'default' }}>▼</button>
             </div>
          </div>

          {/* HÖGER: LEADERBOARD TOpp 5 */}
          <div style={{ flex: '1 1 300px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', alignSelf: 'flex-start' }}>
             <h3 style={{ color: '#f59e0b', fontSize: '1.25rem', marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <Trophy size={20} /> TOPP 5 KRYPIN-LEGENDER
             </h3>
             
             {topScores.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>Mysteriskt tomt här... Bli den FÖRSTA mästaren! 👑</p>
             ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                   {topScores.map((ts, index) => {
                      // Guld, Silver, Brons, resten standard
                      let rankColor = 'var(--text-main)';
                      let medalg = '';
                      if (index === 0) { rankColor = '#fbbf24'; medalg = '🥇'; }
                      if (index === 1) { rankColor = '#94a3b8'; medalg = '🥈'; }
                      if (index === 2) { rankColor = '#b45309'; medalg = '🥉'; }
                      
                      return (
                          <div key={ts.id} style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-body)', padding: '0.75rem', borderRadius: '8px', gap: '1rem' }}>
                              <span style={{ fontSize: '1.25rem', fontWeight: 'bold', minWidth: '30px', color: rankColor }}>
                                 {medalg || `#${index + 1}`}
                              </span>
                              
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--theme-krypin)', overflow: 'hidden', flexShrink: 0 }}>
                                  {ts.profiles?.avatar_url ? (
                                     <img src={ts.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                     <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>?</div>
                                  )}
                              </div>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                 <a href={`/krypin?u=${ts.profiles?.username}`} style={{ color: 'var(--text-main)', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.95rem' }}>@{ts.profiles?.username}</a>
                                 <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(ts.created_at).toLocaleDateString()}</span>
                              </div>
                              
                              <span style={{ fontWeight: '900', color: '#10b981', fontSize: '1.1rem' }}>{ts.score}</span>
                          </div>
                      );
                   })}
                </div>
             )}

             <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', display: 'flex', gap: '0.75rem', color: '#d97706' }}>
                <AlertCircle size={20} style={{ flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4' }}>
                   Visste du att? Om du slår ut någon från Topp 5, skickar vi en <strong>automatisk snabb-notis</strong> direkt till dem så att de vet att de blivit av med titeln! Vässa tummarna.
                </p>
             </div>
          </div>
       </div>

    </div>
  );
}
