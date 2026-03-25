"use client";

import { useEffect, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Trophy, Gamepad2, AlertCircle, ArrowLeft, Volume2, VolumeX } from 'lucide-react';

type GameType = 'menu' | 'snake' | 'racing' | 'breakout' | 'invaders' | 'tetris';

const GAMES = [
  { id: 'snake', name: 'SNAKE', emoji: '🐍' },
  { id: 'racing', name: 'RACING', emoji: '🏎️' },
  { id: 'breakout', name: 'BREAKOUT', emoji: '🧱' },
  { id: 'invaders', name: 'ASTRO', emoji: '🚀' },
  { id: 'tetris', name: 'TETRIS', emoji: '🧩' },
];

export default function SnakeGame({ viewerUser }: { viewerUser: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [activeScreen, setActiveScreen] = useState<GameType>('menu');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const [topScores, setTopScores] = useState<any[]>([]);
  const [leaderboardGame, setLeaderboardGame] = useState<string>('snake');
  
  const selectedMenuIndex = useRef(0);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const BG_COLOR = '#879e86'; // Classic Nokia green/grey 
  const FG_COLOR = '#000000'; // Black LCD
  
  const GRID_SIZE = 16;
  const TILE_COUNT = 20; 
  const CANVAS_SIZE = GRID_SIZE * TILE_COUNT;

  const gameState = useRef<any>({
    activeGame: 'menu',
    score: 0,
    speed: 120, // Millisekunder per frame
    lastRender: 0,
    animationFrameId: 0,
    frameCount: 0,
    blinkOn: true,
    isMuted: false,
    
    // Generella tangenter (continuous)
    keys: { up: false, down: false, left: false, right: false, action: false, lastAction: false },

    // Game states
    snake: { body: [{x:10, y:10}], food: {x:5,y:5}, dx:0, dy:-1, nextDx:0, nextDy:-1 },
    racing: { playerX: 8, enemies: [], roadOffset: 0, speedMult: 1 },
    breakout: { paddleX: 8, ballX: 10, ballY: 10, ballDx: 1, ballDy: -1, bricks: [] },
    invaders: { playerX: 9, bullets: [], enemies: [], stars: [], fireCooldown: 0, level: 1 },
    tetris: { board: Array.from({length: 20}, () => Array(10).fill(0)), piece: {shape:[], x:4, y:0}, dropSpeed: 10, dropCounter: 0 }
  });

  // ========== LJUDMOTOR (Web Audio API) ==========
  const getAudioCtx = () => {
    if (!(window as any).gameAudioCtx) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return null;
        (window as any).gameAudioCtx = new AudioContext();
    }
    if ((window as any).gameAudioCtx.state === 'suspended') {
        (window as any).gameAudioCtx.resume();
    }
    return (window as any).gameAudioCtx;
  };

  const playSound = (type: 'blip' | 'blop' | 'crash' | 'score' | 'jump' | 'shoot') => {
    try {
        if (gameState.current.isMuted) return;
        const ctx = getAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime;
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (type === 'blip') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'blop') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'jump') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        } else if (type === 'shoot') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'score') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.setValueAtTime(800, now + 0.05);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'crash') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(10, now + 0.3);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        }
    } catch(e) {}
  };

  // ========== DATABASE HIGHSCORE ==========
  const fetchHighScores = async (gameId: string) => {
    setLeaderboardGame(gameId);
    // För säkerhets skull dubbelkollar vi ifall kolumnen finns (fallback till snake)
    const { data: scores, error } = await supabase
      .from('snake_scores')
      .select(`id, score, created_at, user_id, game_id, profiles ( username, avatar_url )`)
      .eq('game_id', gameId)
      .order('score', { ascending: false })
      .limit(5);

    if (!error && scores) {
      setTopScores(scores);
    } else {
       // KANSKE saknas kolumnen? Felhantering om SQL inte körts:
       if (error?.message?.includes("game_id")) {
           // Fallback för gamla databasen! (Visar enbart generiska Snake scores)
           const { data: oldScores } = await supabase
               .from('snake_scores')
               .select(`id, score, created_at, user_id, profiles ( username, avatar_url )`)
               .order('score', { ascending: false })
               .limit(5);
           if (oldScores) setTopScores(oldScores);
       }
    }
  };

  useEffect(() => {
    fetchHighScores('snake');
    gameState.current.animationFrameId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(gameState.current.animationFrameId);
  }, []);

  // Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keys = gameState.current.keys;
      const s = gameState.current.snake;
      
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd', 'Enter', 'Backspace', 'Escape'].includes(e.key)) {
         // Prevent default only if it's not inside an input field
         if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
            e.preventDefault();
         }
      }
      
      if (e.key === 'ArrowUp' || e.key === 'w') { keys.up = true; if(s.dy === 0){ s.nextDx = 0; s.nextDy = -1;} }
      if (e.key === 'ArrowDown' || e.key === 's') { keys.down = true; if(s.dy === 0){ s.nextDx = 0; s.nextDy = 1;} }
      if (e.key === 'ArrowLeft' || e.key === 'a') { keys.left = true; if(s.dx === 0){ s.nextDx = -1; s.nextDy = 0;} }
      if (e.key === 'ArrowRight' || e.key === 'd') { keys.right = true; if(s.dx === 0){ s.nextDx = 1; s.nextDy = 0;} }
      if (e.key === ' ' || e.key === 'Enter') { keys.action = true; }
      
      // TILLBAKA KNAPP (Sudd-knappen eller Esc)
      if (e.key === 'Backspace' || e.key === 'Escape') {
         setIsPlaying(false);
         setIsGameOver(false);
         setActiveScreen('menu');
         gameState.current.activeGame = 'menu';
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keys = gameState.current.keys;
      if (e.key === 'ArrowUp' || e.key === 'w') keys.up = false;
      if (e.key === 'ArrowDown' || e.key === 's') keys.down = false;
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
      if (e.key === ' ' || e.key === 'Enter') keys.action = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, []);

  // Push Controller
  const handleDirBtn = (dir: string, press: boolean) => {
     const keys = gameState.current.keys;
     const s = gameState.current.snake;
     if (dir === 'UP') { keys.up = press; if(press && s.dy === 0){ s.nextDx = 0; s.nextDy = -1; } }
     if (dir === 'DOWN') { keys.down = press; if(press && s.dy === 0){ s.nextDx = 0; s.nextDy = 1; } }
     if (dir === 'LEFT') { keys.left = press; if(press && s.dx === 0){ s.nextDx = -1; s.nextDy = 0; } }
     if (dir === 'RIGHT') { keys.right = press; if(press && s.dx === 0){ s.nextDx = 1; s.nextDy = 0; } }
     if (dir === 'ACTION') keys.action = press;
  };

  const initGame = (gameType: GameType) => {
      gameState.current.activeGame = gameType;
      gameState.current.score = 0;
      gameState.current.lastRender = window.performance ? window.performance.now() : 0;
      setScore(0);
      setIsGameOver(false);
      setIsPlaying(true);
      setActiveScreen(gameType);
      
      // Request focus
      if (canvasRef.current) canvasRef.current.focus();
      
      if (gameType === 'snake') {
          gameState.current.speed = 120;
          gameState.current.snake = { body: [{x:10, y:10}, {x:10,y:11}, {x:10,y:12}], food: {x:5,y:5}, dx:0, dy:-1, nextDx:0, nextDy:-1 };
      } else if (gameType === 'racing') {
          gameState.current.speed = 60; 
          gameState.current.racing = { playerX: 8, enemies: [], roadOffset: 0, speedMult: 1 };
      } else if (gameType === 'breakout') {
          gameState.current.speed = 70;
          let bricks = [];
          for(let i=1; i<19; i+=2) {
             bricks.push({x: i, y: 2});
             bricks.push({x: i, y: 4});
             bricks.push({x: i, y: 6});
          }
          gameState.current.breakout = { paddleX: 8, ballX: 10, ballY: 15, ballDx: 1, ballDy: -1, bricks };
      } else if (gameType === 'invaders') {
          gameState.current.speed = 40; // High speed scroller
          let stars = Array.from({length: 30}, () => ({x: Math.random()*20, y: Math.random()*20, s: Math.random()*0.5 + 0.1}));
          gameState.current.invaders = { playerX: 9, bullets: [], enemies: [], stars, fireCooldown: 0, level: 1 };
      } else if (gameType === 'tetris') {
          gameState.current.speed = 50; 
          gameState.current.tetris = { board: Array.from({length: 20}, () => Array(10).fill(0)), piece: getNewTetrisPiece(), dropSpeed: 10, dropCounter: 0 };
      }
  };

  const getNewTetrisPiece = () => {
     const shapes = [
        [{x:0,y:0}, {x:1,y:0}, {x:0,y:1}, {x:1,y:1}], // O
        [{x:-1,y:0}, {x:0,y:0}, {x:1,y:0}, {x:2,y:0}], // I
        [{x:-1,y:0}, {x:0,y:0}, {x:1,y:0}, {x:0,y:1}], // T
        [{x:-1,y:0}, {x:0,y:0}, {x:1,y:0}, {x:1,y:-1}], // L
        [{x:-1,y:0}, {x:0,y:0}, {x:1,y:0}, {x:-1,y:-1}], // J
        [{x:-1,y:0}, {x:0,y:0}, {x:0,y:-1}, {x:1,y:-1}], // S
        [{x:-1,y:-1}, {x:0,y:-1}, {x:0,y:0}, {x:1,y:0}] // Z
     ];
     return { shape: shapes[Math.floor(Math.random() * shapes.length)], x: 4, y: 1 };
  };

  const submitScoreAndCheckNotifications = async (finalScore: number, gameIdOverwrite?: string) => {
    setIsSubmitting(true);
    if (!viewerUser || finalScore <= 0) { setIsSubmitting(false); return; }

    const oldTopScores = [...topScores];
    const targetGame = gameIdOverwrite || gameState.current.activeGame;

    // Spara i DB. (Om kolumnen game_id inte finns kastar den fel, men vi försöker.)
    const { error } = await supabase.from('snake_scores').insert({
        user_id: viewerUser.id,
        score: finalScore,
        game_id: targetGame // Endast de som kör SQL-scriptet har denna!
    });

    if (!error) {
       await fetchHighScores(targetGame);
       // Hitta vems plats vi stal (samma logik)
       let rankStolen = -1;
       for (let i = 0; i < oldTopScores.length; i++) {
          if (finalScore > oldTopScores[i].score) { rankStolen = i; break; }
       }
       
       if (rankStolen !== -1) {
          const stolenFrom = oldTopScores[rankStolen];
          if (stolenFrom.user_id !== viewerUser.id) {
             const gameName = GAMES.find(g => g.id === targetGame)?.name || targetGame.toUpperCase();
             const message = rankStolen === 0 
                 ? `Game over! @${viewerUser.username} krossade just ditt rekord i ${gameName} och snodde 1:a platsen!`
                 : `Gissa vem som precis snodde din plats i ${gameName}? @${viewerUser.username}! In och ta tillbaka den!`;
             
             await supabase.from('notifications').insert({ receiver_id: stolenFrom.user_id, actor_id: viewerUser.id, type: 'high_score', content: message, link: '/krypin?spela=true' });
             await fetch('/api/send-push', { method: 'POST', body: JSON.stringify({ userId: stolenFrom.user_id, title: "🏆 Ny Arkad-Kung!", message: message, url: '/krypin?spela=true' }) });
          }
       }
    }
    setIsSubmitting(false);
  };

  const triggerGameOver = () => {
     playSound('crash');
     setIsPlaying(false);
     setIsGameOver(true);
     setScore(gameState.current.score); // MUST SYNCRONIZE REACT STATE!
     const endedGame = gameState.current.activeGame;
     setLeaderboardGame(endedGame);
     fetchHighScores(endedGame);
     gameState.current.activeGame = 'menu';
     submitScoreAndCheckNotifications(gameState.current.score, endedGame);
  };

  // ========== MAIN GAME LOOP ==========
  const gameLoop = (timestamp: number) => {
    // Menu Logic (Handles selection smoothly)
    if (gameState.current.activeGame === 'menu') {
        const stateKeys = gameState.current.keys;
        if (stateKeys.down && !stateKeys.lastAction) { selectedMenuIndex.current = (selectedMenuIndex.current + 1) % GAMES.length; playSound('blip'); }
        if (stateKeys.up && !stateKeys.lastAction) { selectedMenuIndex.current = (selectedMenuIndex.current - 1 + GAMES.length) % GAMES.length; playSound('blip'); }
        if (stateKeys.action && !stateKeys.lastAction) {
           playSound('score');
           initGame(GAMES[selectedMenuIndex.current].id as GameType);
        }
        
        // Spara key-state så att menyn inte skrollar tusen steg per sekund
        stateKeys.lastAction = stateKeys.down || stateKeys.up || stateKeys.action;

        // Render Menu
        drawMenu(timestamp);
        gameState.current.animationFrameId = requestAnimationFrame(gameLoop);
        return;
    }

    // GAME IN PROGRESS
    if (timestamp - gameState.current.lastRender >= gameState.current.speed) {
        gameState.current.lastRender = timestamp;
        gameState.current.frameCount++;
        if (gameState.current.frameCount % 5 === 0) gameState.current.blinkOn = !gameState.current.blinkOn;
        
        updateGameObjects();
        drawGameEngine();
    }
    gameState.current.animationFrameId = requestAnimationFrame(gameLoop);
  };

  // ----- UPDATE LOGIC -----
  const updateGameObjects = () => {
      const st = gameState.current;
      const keys = st.keys;

      if (st.activeGame === 'snake') {
          // SNAKE
          st.snake.dx = st.snake.nextDx;
          st.snake.dy = st.snake.nextDy;
          const head = { x: st.snake.body[0].x + st.snake.dx, y: st.snake.body[0].y + st.snake.dy };
          
          if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) { triggerGameOver(); return; }
          if (st.snake.body.some((segment:any) => segment.x === head.x && segment.y === head.y)) { triggerGameOver(); return; }
          
          st.snake.body.unshift(head);
          
          if (head.x === st.snake.food.x && head.y === st.snake.food.y) {
              playSound('score');
              st.score += 10;
              st.snake.food = { x: Math.floor(Math.random() * TILE_COUNT), y: Math.floor(Math.random() * TILE_COUNT) };
              st.speed = Math.max(50, st.speed - 2); 
          } else {
              st.snake.body.pop();
          }

      } else if (st.activeGame === 'racing') {
          // RACING (Retro Top-Down)
          if (keys.left && st.racing.playerX > 2) st.racing.playerX -= 1;
          if (keys.right && st.racing.playerX < TILE_COUNT - 5) st.racing.playerX += 1;
          
          st.racing.roadOffset = (st.racing.roadOffset + 1) % 4;
          
          if (st.frameCount % Math.max(5, Math.floor(20 / st.racing.speedMult)) === 0) {
              const rX = Math.floor(Math.random() * (TILE_COUNT - 7)) + 3;
              st.racing.enemies.push({ x: rX, y: -4, type: Math.random() > 0.5 ? 1 : 2 });
          }
          
          for (let i = st.racing.enemies.length - 1; i >= 0; i--) {
              const e = st.racing.enemies[i];
              e.y += 1 * st.racing.speedMult;
              if (e.y > TILE_COUNT) {
                  st.racing.enemies.splice(i, 1);
                  st.score += 10;
                  if (st.score % 100 === 0) { st.racing.speedMult += 0.2; playSound('score'); }
              } else if (
                  e.y + 3 > 15 && e.y < 18 &&
                  e.x + 2 > st.racing.playerX && e.x < st.racing.playerX + 2
              ) {
                  triggerGameOver(); return;
              }
          }
      
      } else if (st.activeGame === 'breakout') {
          // BREAKOUT
          if (keys.left && st.breakout.paddleX > 0) st.breakout.paddleX--;
          if (keys.right && st.breakout.paddleX < TILE_COUNT - 4) st.breakout.paddleX++;
          
          st.breakout.ballX += st.breakout.ballDx;
          st.breakout.ballY += st.breakout.ballDy;

          // Väggar
          if (st.breakout.ballX <= 0 || st.breakout.ballX >= TILE_COUNT - 1) { st.breakout.ballDx *= -1; playSound('blip'); }
          if (st.breakout.ballY <= 0) { st.breakout.ballDy *= -1; playSound('blip'); }

          // Paddle (Y=18)
          if (st.breakout.ballY === 18 && st.breakout.ballX >= st.breakout.paddleX && st.breakout.ballX <= st.breakout.paddleX + 4) {
             st.breakout.ballDy = -1; playSound('blop');
          }

          // Krossa stenar
          for(let i=0; i<st.breakout.bricks.length; i++) {
             const b = st.breakout.bricks[i];
             if (st.breakout.ballX === b.x || st.breakout.ballX === b.x + 1) { // width 2
                if (st.breakout.ballY === b.y) {
                    st.breakout.bricks.splice(i, 1);
                    st.breakout.ballDy *= -1;
                    playSound('score');
                    st.score += 10;
                    break;
                }
             }
          }

          if (st.breakout.bricks.length === 0) {
              // NÄSTA NIVÅ!
              playSound('score');
              st.speed = Math.max(30, st.speed - 5);
              st.breakout.ballX = 10;
              st.breakout.ballY = 15;
              st.breakout.ballDy = -1;
              st.breakout.paddleX = 8;
              
              const level = Math.floor(st.score / 180) + 1;
              const rows = Math.min(8, 3 + level);
              for(let i=1; i<19; i+=2) {
                 for(let r=0; r<rows; r++) {
                     st.breakout.bricks.push({x: i, y: 1 + r*2});
                 }
              }
              return;
          }
          if (st.breakout.ballY >= TILE_COUNT) { triggerGameOver(); return; }

      } else if (st.activeGame === 'invaders') {
          // ASTRO SCROLLING SHOOTER
          if (keys.left && st.invaders.playerX > 0) st.invaders.playerX -= 0.5;
          if (keys.right && st.invaders.playerX < TILE_COUNT - 3) st.invaders.playerX += 0.5;
          if (keys.up && st.invaders.playerY > 0) st.invaders.playerY -= 0.5; // Optional up/down if wanted, but left/right is fine for Astro
          
          if (keys.action && st.invaders.fireCooldown <= 0) {
             st.invaders.bullets.push({x: st.invaders.playerX + 1, y: 17});
             if (st.invaders.level > 1) { st.invaders.bullets.push({x: st.invaders.playerX, y: 17}); st.invaders.bullets.push({x: st.invaders.playerX + 2, y: 17}); }
             st.invaders.fireCooldown = Math.max(2, 6 - st.invaders.level); 
             playSound('shoot');
          }
          if(st.invaders.fireCooldown > 0) st.invaders.fireCooldown--;

          // Stars Background Parallax
          st.invaders.stars.forEach((s:any) => { s.y += s.s; if(s.y > TILE_COUNT) s.y = 0; });

          // Spawn Enemies / Walls (Måste flyga igenom!)
// Snabbare astro-spawns
          if (st.frameCount % Math.max(10, 80 - Math.floor(st.score/100)) === 0) {
             const randType = Math.random();
             if (randType > 0.4) {
                 const gapWidth = Math.max(3, 8 - Math.floor(st.score/1000));
                 const gapX = Math.floor(Math.random() * (TILE_COUNT - gapWidth));
                 for (let x = 0; x < TILE_COUNT; x+=2) {
                     if (x < gapX || x > gapX + gapWidth) {
                         st.invaders.enemies.push({x, y: -2, type: 1, hp: 5, dx: 0, dy: 0.15 + (st.score/10000)});
                     }
                 }
                 if (Math.random() > 0.4) {
                     st.invaders.enemies.push({x: gapX + gapWidth/2 - 0.5, y: -2, type: 3, hp: 1, dx: 0, dy: 0.2});
                 }
             } else {
                 const type = 2;
                 st.invaders.enemies.push({x: Math.random() * (TILE_COUNT-2), y: -2, type, hp: 1, dx: Math.random()>0.5?0.2:-0.2, dy: 0.2 + (st.score/10000)});
                 st.invaders.enemies.push({x: Math.random() * (TILE_COUNT-2), y: -4, type, hp: 1, dx: Math.random()>0.5?0.2:-0.2, dy: 0.2 + (st.score/10000)});
                 if (st.score > 200) st.invaders.enemies.push({x: Math.random() * (TILE_COUNT-2), y: -6, type, hp: 1, dx: Math.random()>0.5?0.3:-0.3, dy: 0.3});
             }
          }

          // Move Bullets
          for(let i=st.invaders.bullets.length-1; i>=0; i--) {
             const b = st.invaders.bullets[i];
             b.y -= 1;
              if (b.y < 0) { st.invaders.bullets.splice(i, 1); continue; }
              for(let j=0; j<st.invaders.enemies.length; j++) {
                  const e = st.invaders.enemies[j];
                  if (b.x >= e.x - 0.5 && b.x <= e.x+2 && b.y <= e.y+1 && b.y >= e.y-1) {
                     st.invaders.bullets.splice(i, 1);
                     
                     if (e.type !== 3) e.hp--; // Powerups är odödliga för skott! Blev förstörda förut
                     
                     if (e.hp <= 0 && e.type !== 3) {
                         st.invaders.enemies.splice(j, 1);
                         playSound('blop');
                         st.score += e.type * 10;
                     }
                     break;
                  }
              }
          }

          // Move Enemies
          for(let i=st.invaders.enemies.length-1; i>=0; i--) {
             const e = st.invaders.enemies[i];
             e.y += e.dy;
             e.x += e.dx;
             if (e.x < 0 || e.x > TILE_COUNT-2) e.dx *= -1; // Bounce walls
             
             if (e.y > TILE_COUNT) { 
                 st.invaders.enemies.splice(i, 1); 
                 if (e.type === 1) { st.score += 2; } // Överlevde asteroid
                 continue; 
             }
             
             // Hit player?
             if (e.y >= 17 && e.y <= 19 && e.x >= st.invaders.playerX - 1 && e.x <= st.invaders.playerX + 2) {
                 if (e.type === 3) {
                     // Fångade Powerup! Extra Eldkraft!
                     st.invaders.enemies.splice(i, 1);
                     playSound('score');
                     st.score += 50;
                     st.invaders.level++; // Snabbare skott
                 } else {
                     triggerGameOver(); return;
                 }
             }
          }
      
      } else if (st.activeGame === 'tetris') {
          // TETRIS
          const p = st.tetris.piece;
          const collides = (dx: number, dy: number, shape: any[]) => {
              return shape.some(cell => {
                 const nx = p.x + cell.x + dx;
                 const ny = p.y + cell.y + dy;
                 if (nx < 0 || nx >= 10 || ny >= 20) return true;
                 if (ny >= 0 && st.tetris.board[ny][nx] !== 0) return true;
                 return false;
              });
          };

          if (keys.left && !st.keys.lastLeft) { if (!collides(-1, 0, p.shape)) { p.x--; playSound('blip'); } }
          if (keys.right && !st.keys.lastRight) { if (!collides(1, 0, p.shape)) { p.x++; playSound('blip'); } }
          if (keys.down) { if (!collides(0, 1, p.shape)) p.y++; }
          if (keys.action && !st.keys.lastAction) {
             const newShape = p.shape.map((c:any) => ({x: -c.y, y: c.x})); // Rotate CW
             if (!collides(0, 0, newShape)) { p.shape = newShape; playSound('jump'); }
          }
          
          st.keys.lastLeft = keys.left;
          st.keys.lastRight = keys.right;
          st.keys.lastAction = keys.action;

          st.tetris.dropCounter++;
          if (st.tetris.dropCounter >= st.tetris.dropSpeed) {
             st.tetris.dropCounter = 0;
             if (!collides(0, 1, p.shape)) {
                 p.y++;
             } else {
                 if (p.y <= 1) { triggerGameOver(); return; } // Spawn lock = game over
                 
                 p.shape.forEach((c:any) => {
                     const ny = p.y + c.y;
                     const nx = p.x + c.x;
                     if (ny >= 0 && ny < 20) st.tetris.board[ny][nx] = 1;
                 });
                 
                 let lines = 0;
                 for(let y=19; y>=0; y--) {
                     if (st.tetris.board[y].every((cell:number) => cell !== 0)) {
                         st.tetris.board.splice(y, 1);
                         st.tetris.board.unshift(new Array(10).fill(0));
                         lines++;
                         y++; // line shifted down
                     }
                 }
                 if (lines > 0) {
                     st.score += lines * 100;
                     playSound('score');
                     st.tetris.dropSpeed = Math.max(2, st.tetris.dropSpeed - 1);
                 } else {
                     playSound('crash');
                 }
                 st.tetris.piece = getNewTetrisPiece();
             }
          }
      }

      // Update Live Score UI bypassing React!
      const liveScoreEl = document.getElementById('arcade-live-score');
      if (liveScoreEl) liveScoreEl.innerText = st.score.toString();
  };


  // ----- DRAW LOGIC -----
  const drawMenu = (ts: number) => {
      const cvt = canvasRef.current?.getContext('2d');
      if (!cvt) return;
      
      cvt.fillStyle = BG_COLOR;
      cvt.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      
      cvt.fillStyle = FG_COLOR;
      cvt.font = 'bold 20px "Courier New", monospace';
      cvt.textAlign = 'center';
      cvt.fillText("FACECHAT ARCADE", CANVAS_SIZE/2, 40);

      cvt.font = '14px "Courier New", monospace';
      cvt.textAlign = 'left';
      
      GAMES.forEach((game, index) => {
         const isSelected = selectedMenuIndex.current === index;
         const y = 80 + (index * 25);
         if (isSelected) {
            cvt.fillRect(20, y - 12, CANVAS_SIZE - 40, 18);
            cvt.fillStyle = BG_COLOR;
         } else {
            cvt.fillStyle = FG_COLOR;
         }
         cvt.fillText(`${isSelected ? '▶ ' : '  '}${game.name} ${game.emoji}`, 30, y);
      });
  };

  const drawGameEngine = () => {
      const cvt = canvasRef.current?.getContext('2d');
      if (!cvt) return;
      
      cvt.fillStyle = BG_COLOR;
      cvt.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      cvt.fillStyle = FG_COLOR;
      
      const st = gameState.current;

      const drawRect = (x: number, y: number, w: number, h: number) => {
          cvt.fillRect(x * GRID_SIZE, y * GRID_SIZE, w * GRID_SIZE, h * GRID_SIZE);
      };

      if (st.activeGame === 'snake') {
          drawRect(st.snake.food.x, st.snake.food.y, 1, 1); // Solida fyrkants-äpplen
          st.snake.body.forEach((s:any) => drawRect(s.x, s.y, 1, 1));
      } 
      else if (st.activeGame === 'racing') {
          // Rita vägkanter som rör sig
          for(let i=0; i<TILE_COUNT+4; i+=4) {
             drawRect(1, i - st.racing.roadOffset, 1, 2);
             drawRect(TILE_COUNT - 2, i - st.racing.roadOffset, 1, 2);
          }
          // Player car
          drawRect(st.racing.playerX, 16, 2, 3);
          if (st.blinkOn) drawRect(st.racing.playerX + 0.5, 17, 1, 1);
          
          // Enemy cars
          st.racing.enemies.forEach((e:any) => {
              drawRect(e.x, e.y, 2, 3);
              if (e.type === 2) drawRect(e.x, e.y+1, 2, 1);
          });
      }
      else if (st.activeGame === 'breakout') {
          drawRect(st.breakout.paddleX, 18, 4, 1);
          drawRect(st.breakout.ballX, st.breakout.ballY, 1, 1);
          st.breakout.bricks.forEach((b:any) => drawRect(b.x, b.y, 1.8, 1));
      }
      else if (st.activeGame === 'invaders') {
          // Stars BG
          st.invaders.stars.forEach((s:any) => drawRect(s.x, s.y, 0.1, 0.1));
          
          // Player ship (arrow shape)
          drawRect(st.invaders.playerX + 1, 17, 1, 1);
          drawRect(st.invaders.playerX, 18, 3, 1);
          drawRect(st.invaders.playerX - 0.5, 19, 4, 0.5);
          
          st.invaders.bullets.forEach((b:any) => drawRect(b.x, b.y, 0.5, 1));
          
          st.invaders.enemies.forEach((e:any) => {
              if (e.type === 1) {
                  // Asteroid (Square, solid)
                  drawRect(e.x, e.y, 2, 2);
                  if(!st.blinkOn) drawRect(e.x+0.5, e.y+0.5, 1, 1);
              } else if (e.type === 2) {
                  // Fighter Ship
                  drawRect(e.x+0.5, e.y, 1, 1.5);
                  drawRect(e.x-0.5, e.y+0.5, 3, 0.5);
              } else if (e.type === 3) {
                  // Powerup/Star (blinking diamond shape)
                  if (!st.blinkOn) {
                      drawRect(e.x+0.5, e.y, 1, 2);
                      drawRect(e.x, e.y+0.5, 2, 1);
                  }
              }
          });
      }
      else if (st.activeGame === 'tetris') {
          // Rita Spelplan (Mitten, offset 5 tiles, bredd 10)
          const ox = 5;
          // Bordets kanter
          cvt.strokeStyle = FG_COLOR;
          cvt.lineWidth = 1;
          cvt.strokeRect(ox * GRID_SIZE - 2, 0, 10 * GRID_SIZE + 4, 20 * GRID_SIZE + 2);
          
          // Frysta block
          for (let y = 0; y < 20; y++) {
             for (let x = 0; x < 10; x++) {
                if (st.tetris.board[y][x] !== 0) {
                   drawRect(ox + x, y, 1, 1);
                }
             }
          }
          // Nuvarande pjäs
          st.tetris.piece.shape.forEach((c:any) => {
              const ny = st.tetris.piece.y + c.y;
              const nx = st.tetris.piece.x + c.x;
              if (ny >= 0) drawRect(ox + nx, ny, 1, 1);
          });
      }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
       
       <div style={{ textAlign: 'center', position: 'relative' }}>
          
          <button 
             onClick={() => {
                const newMute = !isMuted;
                setIsMuted(newMute);
                gameState.current.isMuted = newMute;
             }} 
             style={{ position: 'absolute', top: '-10px', right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '50%', color: isMuted ? '#ef4444' : 'var(--text-muted)', cursor: 'pointer', padding: '0.6rem', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}
          >
             {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>

          <h2 style={{ fontSize: '1.75rem', color: '#10b981', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontFamily: 'Impact, sans-serif', letterSpacing: '1px', textShadow: '2px 2px 0 #0f172a' }}>
             <Gamepad2 size={24} /> FACECHAT ARCADE
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem', fontWeight: 'bold' }}>DATOR: ESC/SUDD (MENY) | SPACE (SKJUT/OK)</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', fontWeight: 'bold', color: '#10b981' }}>MOBIL: B (TILLBAKA/MENY) | A (OK/SKJUT)</p>
       </div>

       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'center' }}>
          
          {/* VÄNSTER: ARCADE KONSOL (Kompakt) */}
          <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '380px', width: '100%', boxSizing: 'border-box' }}>
             
             {/* TOP SKAL (Skärmdelen) */}
             <div style={{ 
                backgroundColor: '#1e293b', 
                padding: '1.5rem', 
                borderRadius: '16px 16px 0 0', 
                border: '1px solid #0f172a',
                borderBottom: 'none',
                boxShadow: 'inset 0 2px 10px rgba(255,255,255,0.05), 0 10px 15px -5px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                boxSizing: 'border-box'
             }}>
                 {/* SKÄRMEN (CANVAS) */}
                 <div style={{ 
                    backgroundColor: '#cbd5e1', 
                    padding: '10px', 
                    borderRadius: '12px',
                    width: '100%',
                    boxSizing: 'border-box',
                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
                 }}>
                     <div 
                        style={{ position: 'relative', width: '100%', aspectRatio: '1/1', outline: 'none', backgroundColor: BG_COLOR, border: '4px inset #64748b', borderRadius: '4px', overflow: 'hidden' }} 
                        tabIndex={0}
                     >
                        <canvas 
                            ref={canvasRef}
                            width={CANVAS_SIZE} 
                            height={CANVAS_SIZE}
                            style={{ 
                                display: 'block',
                                imageRendering: 'pixelated',
                                width: '100%',
                                height: '100%',
                                touchAction: 'none' 
                            }}
                        />

                        {isPlaying && (
                             <div style={{ position: 'absolute', bottom: '10px', right: '15px', color: 'rgba(255,255,255,0.85)', fontFamily: '"Courier New", monospace', fontWeight: 'bold', fontSize: '1.25rem', textShadow: '1px 1px 0 #000', pointerEvents: 'none', zIndex: 10 }}>
                                SCORE: <span id="arcade-live-score">{score}</span>
                             </div>
                        )}

                        {isGameOver && (
                           <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(135, 158, 134, 0.9)'}}>
                              <h3 style={{ margin: 0, color: FG_COLOR, fontFamily: '"Courier New", monospace', fontSize: '1.5rem', fontWeight: '900', textAlign: 'center' }}>GAME OVER</h3>
                              <p style={{ margin: '0.5rem 0 1rem 0', color: FG_COLOR, fontFamily: '"Courier New", monospace', fontSize: '1.2rem', fontWeight: 'bold' }}>Points: {score}</p>
                              <button onClick={() => { setActiveScreen('menu'); gameState.current.activeGame = 'menu'; setIsGameOver(false); setIsPlaying(false); }} style={{ backgroundColor: FG_COLOR, color: BG_COLOR, fontSize: '0.9rem', fontFamily: '"Courier New", monospace', fontWeight: 'bold', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>MAIN MENU</button>
                           </div>
                        )}
                     </div>
                 </div>
             </div>

             {/* UNDERDEL (KNAPPSATS MODERN KONTROLL) */}
             <div style={{ 
                backgroundColor: '#1e293b', 
                width: '100%', 
                padding: '2rem 1.5rem', 
                borderRadius: '0 0 24px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                position: 'relative',
                border: '1px solid #0f172a',
                borderTop: '1px solid #334155',
                boxShadow: 'inset 0 -5px 15px rgba(0,0,0,0.3), 0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                touchAction: 'none',
                boxSizing: 'border-box'
             }}>
                 {/* Vänster: D-PAD */}
                 <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
                     <button 
                        onPointerDown={(e) => { handleDirBtn('UP', true); e.preventDefault(); }} 
                        onPointerUp={(e) => { handleDirBtn('UP', false); e.preventDefault(); }}
                        onPointerLeave={() => handleDirBtn('UP', false)}
                        style={{ position: 'absolute', top: 0, left: '40px', width: '40px', height: '40px', borderRadius: '8px 8px 0 0', border: 'none', backgroundColor: '#334155', boxShadow: 'inset 0 2px 2px rgba(255,255,255,0.1), 0 4px 0 #0f172a', cursor: 'pointer', touchAction: 'none' }}
                     />
                     <button 
                        onPointerDown={(e) => { handleDirBtn('LEFT', true); e.preventDefault(); }} 
                        onPointerUp={(e) => { handleDirBtn('LEFT', false); e.preventDefault(); }}
                        onPointerLeave={() => handleDirBtn('LEFT', false)}
                        style={{ position: 'absolute', top: '40px', left: 0, width: '40px', height: '40px', borderRadius: '8px 0 0 8px', border: 'none', backgroundColor: '#334155', boxShadow: 'inset 2px 0 2px rgba(255,255,255,0.1), 0 4px 0 #0f172a', cursor: 'pointer', touchAction: 'none' }}
                     />
                     <div style={{ position: 'absolute', top: '40px', left: '40px', width: '40px', height: '40px', backgroundColor: '#334155', zIndex: 0 }} />
                     <button 
                        onPointerDown={(e) => { handleDirBtn('RIGHT', true); e.preventDefault(); }} 
                        onPointerUp={(e) => { handleDirBtn('RIGHT', false); e.preventDefault(); }}
                        onPointerLeave={() => handleDirBtn('RIGHT', false)}
                        style={{ position: 'absolute', top: '40px', right: 0, width: '40px', height: '40px', borderRadius: '0 8px 8px 0', border: 'none', backgroundColor: '#334155', boxShadow: 'inset -2px 0 2px rgba(0,0,0,0.2), 0 4px 0 #0f172a', cursor: 'pointer', touchAction: 'none' }}
                     />
                     <button 
                        onPointerDown={(e) => { handleDirBtn('DOWN', true); e.preventDefault(); }} 
                        onPointerUp={(e) => { handleDirBtn('DOWN', false); e.preventDefault(); }}
                        onPointerLeave={() => handleDirBtn('DOWN', false)}
                        style={{ position: 'absolute', bottom: 0, left: '40px', width: '40px', height: '40px', borderRadius: '0 0 8px 8px', border: 'none', backgroundColor: '#334155', boxShadow: 'inset 0 -2px 2px rgba(0,0,0,0.2), 0 4px 0 #0f172a', cursor: 'pointer', touchAction: 'none' }}
                     />
                 </div>
                 
                 {/* Mitten: Tömmer utrymmet så vi slipper råka klicka fel! */}
                 <div style={{ flex: 1 }} />

                 {/* Höger: Action Buttons */}
                 <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', transform: 'rotate(-10deg)', marginRight: '5px', flexShrink: 0 }}>
                     
                     {/* B-KNAPP = TILLBAKA/MENY */}
                     <button 
                        onClick={(e) => { 
                           setIsPlaying(false);
                           setIsGameOver(false);
                           setActiveScreen('menu');
                           gameState.current.activeGame = 'menu';
                           e.preventDefault(); 
                        }} 
                        style={{ width: '55px', height: '55px', borderRadius: '50%', border: 'none', backgroundColor: '#ef4444', boxShadow: 'inset -2px -2px 5px rgba(0,0,0,0.3), 0 6px 0 #991b1b', color: 'rgba(255,255,255,0.9)', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer', touchAction: 'none', marginTop: '30px' }}
                     >B</button>
                     
                     {/* A-KNAPP = ACTION/OK */}
                     <button 
                        onPointerDown={(e) => { handleDirBtn('ACTION', true); e.preventDefault(); }} 
                        onPointerUp={(e) => { handleDirBtn('ACTION', false); e.preventDefault(); }}
                        onPointerLeave={() => handleDirBtn('ACTION', false)}
                        style={{ width: '55px', height: '55px', borderRadius: '50%', border: 'none', backgroundColor: '#10b981', boxShadow: 'inset -2px -2px 5px rgba(0,0,0,0.3), 0 6px 0 #065f46', color: 'rgba(255,255,255,0.9)', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer', touchAction: 'none', marginBottom: '20px' }}
                     >A</button>
                 </div>
             </div>
          </div>

          {/* HÖGER: LEADERBOARD TOpp 5 */}
          <div style={{ flex: '1 1 300px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', alignSelf: 'stretch', width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
             
             <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem', position: 'relative' }}>
                <select 
                   value={leaderboardGame}
                   onChange={(e) => fetchHighScores(e.target.value)}
                   style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid var(--theme-krypin)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', outline: 'none', appearance: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}
                >
                   {GAMES.map(g => (
                      <option key={g.id} value={g.id}>{g.emoji} Topplista för {g.name}</option>
                   ))}
                </select>
                <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>▼</div>
             </div>

             <h3 style={{ color: '#f59e0b', fontSize: '1.25rem', marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trophy size={20} /> TOPP 5 KRYPIN-LEGENDER
             </h3>
             
             {isSubmitting && <div style={{ color: 'var(--text-muted)' }}>Synkar poäng till stordatorn...</div>}

             {!isSubmitting && topScores.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>Mysteriskt tomt här... Bli den FÖRSTA mästaren i {GAMES.find(g=>g.id===leaderboardGame)?.name}! 👑</p>
             ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                   {topScores.map((ts, index) => {
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

             <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', display: 'flex', gap: '0.75rem', color: '#2563eb' }}>
                <AlertCircle size={20} style={{ flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4' }}>
                   Dator eller Mobil? Du kan nu spela båda med piltangenterna, space för "action" eller klicka på knappsatsen på skärmen!
                </p>
             </div>
          </div>
       </div>

    </div>
  );
}
