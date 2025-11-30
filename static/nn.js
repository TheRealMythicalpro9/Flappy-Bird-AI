// nn.js
// Simple feed-forward neural net and genetic operations.
// Small matrix helpers are implemented inline for simplicity.

class Matrix {
  constructor(rows, cols, data) {
    this.rows = rows; this.cols = cols;
    this.data = data || Array(rows).fill().map(()=>Array(cols).fill(0));
  }
  static fromArray(arr){
    return new Matrix(arr.length, 1, arr.map(v=>[v]));
  }
  toArray(){
    return this.data.map(r=>r[0]);
  }
  static random(rows, cols, scale=1){
    const m = new Matrix(rows, cols);
    for(let i=0;i<rows;i++) for(let j=0;j<cols;j++) m.data[i][j] = (Math.random()*2-1)*scale;
    return m;
  }
  static multiply(a, b){
    if(a.cols !== b.rows) throw "Cols of A must match rows of B.";
    const res = new Matrix(a.rows, b.cols);
    for(let i=0;i<res.rows;i++){
      for(let j=0;j<res.cols;j++){
        let sum = 0;
        for(let k=0;k<a.cols;k++) sum += a.data[i][k] * b.data[k][j];
        res.data[i][j] = sum;
      }
    }
    return res;
  }
  static add(a, b){
    const res = new Matrix(a.rows, a.cols);
    for(let i=0;i<a.rows;i++) for(let j=0;j<a.cols;j++) res.data[i][j] = a.data[i][j] + b.data[i][j];
    return res;
  }
  static map(m, fn){
    const res = new Matrix(m.rows, m.cols);
    for(let i=0;i<m.rows;i++) for(let j=0;j<m.cols;j++) res.data[i][j] = fn(m.data[i][j], i, j);
    return res;
  }
  static crossover(a,b){
    // single point crossover on flattened weights
    const flatA = a.data.flat();
    const flatB = b.data.flat();
    const cut = Math.floor(Math.random()*flatA.length);
    const flatC = flatA.slice(0,cut).concat(flatB.slice(cut));
    const m = new Matrix(a.rows, a.cols);
    for(let i=0;i<m.rows;i++){
      for(let j=0;j<m.cols;j++){
        m.data[i][j] = flatC[i*m.cols+j];
      }
    }
    return m;
  }
  mutate(rate, scale=0.5){
    for(let i=0;i<this.rows;i++) for(let j=0;j<this.cols;j++){
      if(Math.random()<rate) this.data[i][j] += (Math.random()*2-1)*scale;
    }
  }
  static clone(m){
    return new Matrix(m.rows, m.cols, m.data.map(r=>r.slice()));
  }
}

// Activation
function sigmoid(x){ return 1/(1+Math.exp(-x)); }

// Neural network class
class NeuralNetwork {
  constructor(inputNodes, hiddenNodes, outputNodes){
    this.i = inputNodes; this.h = hiddenNodes; this.o = outputNodes;
    this.weights_ih = Matrix.random(this.h, this.i, 1);
    this.weights_ho = Matrix.random(this.o, this.h, 1);
    this.bias_h = Matrix.random(this.h, 1, 1);
    this.bias_o = Matrix.random(this.o, 1, 1);
  }
  predict(inputArr){
    const inputs = Matrix.fromArray(inputArr);
    const hidden = Matrix.add(Matrix.multiply(this.weights_ih, inputs), this.bias_h);
    const hiddenA = Matrix.map(hidden, x=>sigmoid(x));
    const output = Matrix.add(Matrix.multiply(this.weights_ho, hiddenA), this.bias_o);
    const outputs = Matrix.map(output, x=>sigmoid(x));
    return outputs.toArray();
  }
  static crossover(a,b){
    const child = new NeuralNetwork(a.i, a.h, a.o);
    child.weights_ih = Matrix.crossover(a.weights_ih, b.weights_ih);
    child.weights_ho = Matrix.crossover(a.weights_ho, b.weights_ho);
    child.bias_h = Matrix.crossover(a.bias_h, b.bias_h);
    child.bias_o = Matrix.crossover(a.bias_o, b.bias_o);
    return child;
  }
  mutate(rate){
    this.weights_ih.mutate(rate);
    this.weights_ho.mutate(rate);
    this.bias_h.mutate(rate);
    this.bias_o.mutate(rate);
  }
  clone(){
    const c = new NeuralNetwork(this.i, this.h, this.o);
    c.weights_ih = Matrix.clone(this.weights_ih);
    c.weights_ho = Matrix.clone(this.weights_ho);
    c.bias_h = Matrix.clone(this.bias_h);
    c.bias_o = Matrix.clone(this.bias_o);
    return c;
  }
}

export { NeuralNetwork };
