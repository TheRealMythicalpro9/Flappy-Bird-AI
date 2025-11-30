// game.js
import { NeuralNetwork } from './nn.js';

// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = 900, H = 600;
function resizeCanvas(){ canvas.width = W; canvas.height = H; }
resizeCanvas();

// UI elements
const startBtn = document.getElementById('startBtn');
const toggleAI = document.getElementById('toggleAI');
const popSizeInput = document.getElementById('popSize');
const simSpeedInput = document.getElementById('simSpeed');
const statsSpan = document.getElementById('stats');

let AI_ON = true;
toggleAI.onclick = () => { AI_ON = !AI_ON; toggleAI.textContent = `Toggle AI (${AI_ON?'on':'off'})`; };

// Physics constants
const GRAVITY = 0.7;
const JUMP = -9;
const PIPE_WIDTH = 80;
const GAP = 160;
const PIPE_SPACING = 220;
const PIPE_VEL = 3;

// Bird class
class Bird {
  constructor(brain){
    this.x = 150; this.y = H/2;
    this.radius = 12;
    this.vel = 0;
    this.alive = true;
    this.score = 0;
    this.fitness = 0;
    this.color = `hsl(${Math.random()*360} 70% 50%)`;
    this.brain = brain ? brain.clone() : new NeuralNetwork(5, 8, 1);
  }
  copy(){
    const b = new Bird(this.brain.clone());
    return b;
  }
  jump(){
    this.vel = JUMP;
  }
  update(){
    this.vel += GRAVITY;
    this.y += this.vel;
    this.score++;
    if(this.y - this.radius < 0) { this.y = this.radius; this.vel = 0; }
    if(this.y + this.radius > H) { this.alive = false; }
  }
  think(pipes){
    // find closest pipe ahead
    let closest = null, record = Infinity;
    for(const p of pipes){
      const d = (p.x + PIPE_WIDTH) - this.x;
      if(d > -50 && d < record){
        record = d;
        closest = p;
      }
    }
    if(!closest) return;
    // inputs: y, vel, pipe top y, pipe bottom y, dist to pipe
    const inputs = [
      this.y / H,
      (this.vel + 15) / 30, // normalized
      (closest.top) / H,
      (closest.bottom) / H,
      (closest.x - this.x) / W
    ];
    const out = this.brain.predict(inputs);
    if(out[0] > 0.5) this.jump();
  }
  show(isBest=false){
    ctx.beginPath();
    ctx.fillStyle = isBest ? '#FF0' : this.color;
    ctx.ellipse(this.x, this.y, this.radius, this.radius, 0, 0, Math.PI*2);
    ctx.fill();
    // eye
    ctx.beginPath();
    ctx.fillStyle = '#000';
    ctx.arc(this.x+5, this.y-4, 3, 0, Math.PI*2);
    ctx.fill();
  }
}

// Pipe class
class Pipe {
  constructor(x){
    this.x = x || W;
    this.w = PIPE_WIDTH;
    const center = Math.random()*(H - GAP - 80) + 40 + GAP/2;
    this.top = center - GAP/2 - 1000;  // store top as top of opening? we'll use differently
    this.bottom = center + GAP/2;
    // actually we'll draw from 0 to topOpening and bottom to H
    this.topOpening = center - GAP/2;
    this.bottomOpening = center + GAP/2;
    this.passed = false;
  }
  update(){
    this.x -= PIPE_VEL;
  }
  offscreen(){ return this.x + this.w < 0; }
  show(){
    ctx.fillStyle = '#228B22';
    // top rect
    ctx.fillRect(this.x, 0, this.w, this.topOpening);
    // bottom rect
    ctx.fillRect(this.x, this.bottomOpening, this.w, H - this.bottomOpening);
    // pipe cap shading
    ctx.fillStyle = '#2e8b57';
    ctx.fillRect(this.x, this.topOpening - 10, this.w, 10);
    ctx.fillRect(this.x, this.bottomOpening, this.w, 10);
  }
  hits(bird){
    // circle-rect collision (approx)
    const bx = bird.x, by = bird.y, r = bird.radius;
    // top pipe rectangle
    if(bx + r > this.x && bx - r < this.x + this.w){
      if(by - r < this.topOpening || by + r > this.bottomOpening) return true;
    }
    return false;
  }
}

// Population & GA
let population = [];
let saved = [];
let pipes = [];
let frameCount = 0;
let generation = 1;
let highScore = 0;
let running = false;
let bestBird = null;

function initPopulation(n){
  population = [];
  for(let i=0;i<n;i++) population.push(new Bird());
  saved = [];
  generation = 1;
  highScore = 0;
}

function nextGeneration(){
  calculateFitness();
  const newPop = [];
  // Elitism: keep best brain
  population.sort((a,b)=>b.fitness - a.fitness);
  const elite = population[0].brain.clone();
  newPop.push(new Bird(elite));
  // Fill rest via selection, crossover, mutate
  while(newPop.length < population.length){
    const parentA = poolSelection();
    const parentB = poolSelection();
    const childBrain = NeuralNetwork.crossover(parentA.brain, parentB.brain);
    childBrain.mutate(0.12);
    newPop.push(new Bird(childBrain));
  }
  population = newPop;
  saved = [];
  pipes = [];
  frameCount = 0;
  generation++;
}

function poolSelection(){
  // roulette wheel selection
  let index = 0;
  let r = Math.random();
  while(r > 0){
    r -= population[index].fitness;
    index++;
    if(index >= population.length) index = population.length - 1;
  }
  index--;
  return population[index].clone ? population[index].clone() : population[index];
}

function calculateFitness(){
  // simple: fitness = score^2
  let sum = 0;
  for(const b of population){
    b.fitness = Math.pow(b.score, 2);
    sum += b.fitness;
  }
  for(const b of population) b.fitness = b.fitness / sum || 0;
}

// Game loop and drawing
function resetGame(){
  pipes = [];
  frameCount = 0;
  highScore = Math.max(highScore, ...population.map(b=>b.score));
  for(const b of population){ b.y = H/2; b.vel = 0; b.alive = true; b.score = 0; }
  running = true;
}

function spawnPipe(){
  const lastX = pipes.length ? pipes[pipes.length-1].x : W+20;
  pipes.push(new Pipe(W + 20));
}

function update(){
  const speed = parseInt(simSpeedInput.value, 10);
  for(let s=0; s<speed; s++){
    frameCount++;
    if(frameCount % Math.floor(PIPE_SPACING/PIPE_VEL) === 0) spawnPipe();
    for(const p of pipes) p.update();
    // check pipes offscreen
    pipes = pipes.filter(p => !p.offscreen());
    // update birds
    let allDead = true;
    for(const b of population){
      if(!b.alive) continue;
      allDead = false;
      if(AI_ON) b.think(pipes);
      b.update();
      // collisions
      for(const p of pipes){
        if(p.hits(b)) { b.alive = false; break; }
        // scoring when pass pipe
        if(!p.passed && p.x + PIPE_WIDTH < b.x){
          p.passed = true;
          // don't increment here; birds each have own score updated by check? We'll just keep their incremental score in update()
        }
      }
    }
    if(allDead){
      // move to saved (already in population), create next generation
      // compute highScore
      const best = population.reduce((a,b)=> a.score>b.score?a:b, population[0]);
      highScore = Math.max(highScore, best.score);
      // save brains for GA
      // we keep population as is and call nextGeneration
      nextGeneration();
    }
  }
}

function draw(){
  // background gradient
  ctx.clearRect(0,0,W,H);
  // sky gradient
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#87CEEB'); g.addColorStop(1,'#b6e0ff');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);

  // ground
  ctx.fillStyle = '#DEB887';
  ctx.fillRect(0, H - 60, W, 60);
  ctx.fillStyle = '#8B5A2B';
  ctx.fillRect(0, H - 60, W, 6);

  // pipes
  for(const p of pipes) p.show();

  // birds (alive first)
  const best = population.reduce((a,b)=> (a.score||0) > (b.score||0) ? a : b, population[0]);
  bestBird = best;
  for(const b of population){
    if(!b.alive) continue;
    b.show(b === best);
  }
  // dead birds faded
  for(const b of population){
    if(b.alive) continue;
    ctx.globalAlpha = 0.12;
    b.show(false);
    ctx.globalAlpha = 1;
  }

  // HUD
  ctx.fillStyle = '#034';
  ctx.font = '16px Arial';
  ctx.fillText(`Generation: ${generation}`, 12, 22);
  ctx.fillText(`Population: ${population.length}`, 12, 42);
  ctx.fillText(`Alive: ${population.filter(b=>b.alive).length}`, 12, 62);
  ctx.fillText(`Best score (this run): ${best.score || 0}`, 12, 82);
  ctx.fillText(`All-time high score: ${highScore}`, 12, 102);

  // draw a simple legend and controls reminder
  ctx.fillStyle = '#00000088';
  ctx.fillRect(12, 110, 200, 60);
  ctx.fillStyle = '#fff';
  ctx.font = '12px Arial';
  ctx.fillText('Click canvas to flap when AI is off', 20, 130);
  ctx.fillText('Best bird is yellow', 20, 150);
}

function loop(){
  if(running) update();
  draw();
  // update stats UI
  statsSpan.textContent = `Gen ${generation} | Alive ${population.filter(b=>b.alive).length} | High ${highScore}`;
  requestAnimationFrame(loop);
}

// Manual control when AI off
canvas.addEventListener('click', (e)=>{
  if(!AI_ON){
    // flap the first alive bird (single-player)
    const bird = population.find(b=>b.alive);
    if(bird) bird.jump();
  }
});

startBtn.addEventListener('click', () => {
  const pop = parseInt(popSizeInput.value,10) || 120;
  initPopulation(pop);
  resetGame();
});

canvas.addEventListener('mousedown', ()=>{
  // speed up simulation while pressing canvas? optional
});

// initialize default
initPopulation(parseInt(popSizeInput.value,10));
resetGame();
loop();
