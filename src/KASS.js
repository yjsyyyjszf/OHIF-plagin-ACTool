export const KASS = function () {

    function KASS(params) {

        this.maxIteration = params.maxIteration || 250;
        this.minlen = params.minlen || Math.pow(.1, 2);
        this.maxlen = params.maxlen || Math.pow(5, 2);
        this.params = params;
        this.w = params.width;
        this.h = params.height;
        this.gradient = params.gradient;
        this.flow = params.flow;
        this.dots = params.dots;
        //this.snake = [];

        this.snakelength = 0;//

        //binding the scope for animationFrameRequests
        this.update = this.update.bind(this);
        this.render = params.render;
        this.stopped = false;

    }

    // compute -> update -> loop, _render ->
    function compute(_onComplete) {

        this.onComplete = _onComplete;
        //this.snake = this.dots;
        this.snake = this.dots;

       // console.log(this.snake);

        this.it = 0;
        this.length = 0;
        this.last = getsnakelength(this.snake);//this.getsnakelength(this.snake);
        //console.log(this.last);
        cancelAnimationFrame(this.interval);

        // update вызывается рекурсивно
        this.update();
        // _render и так вызывается в update
        // this._render();
    }

    function update() {
        if (this.stopped) {
            this.stopped = false;

            cancelAnimationFrame(this.interval);
            this._render(true);

            return
        }
        this.loop();
        this._render();
        this.length = getsnakelength(this.snake);//this.getsnakelength(this.snake);
        if (++this.it >= this.maxIteration) {
            //console.log("points:", this.snake.length, 'iteration:', this.it);
            cancelAnimationFrame(this.interval);
            this._render(true);
        } else {
            this.last = this.length;
            setTimeout(this.update, 0)

        }
    }

    function loop() {
        var scope = this;

        var alpha = 1.1, beta = 1.2, gamma = 1.5, delta = 3.0;

        var wSize = 2;

        var e_uniformity = init2DArray(wSize + 1, wSize + 1);
        var e_curvature = init2DArray(wSize + 1, wSize + 1);
        //var e_flow = init2DArray(wSize + 1, wSize + 1);

        //var e_inertia = init2DArray(wSize + 1, wSize + 1);
        //var scope = this;

        let p = [];
        this.snakelength = getsnakelength(this.snake);

        var newsnake = [];

        for (let i = 0; i < this.snake.length(); i++) {
            let prev = this.snake[(i + this.snake.length - 1) % this.snake.length];
            let cur = this.snake[i];
            let next = this.snake[(i + 1) % this.snake.length];

            for (let dy = (wSize / 2) * -1; dy <= (wSize / 2); dy++) {
                for (let dx = (wSize / 2) * -1; dx <= (wSize / 2); dx++) {
                    p[0] = cur[0] + dx;
                    p[1] = cur[1] + dy;

                    e_uniformity[1 + dx][1 + dy] = f_uniformity(prev, next, p);
                    e_curvature[(wSize / 2) + dx][(wSize / 2) + dy] = f_curvature(prev, p, next);
                }
            }

            normalize(e_uniformity);
            normalize(e_curvature);

            let emin = Number.MAX_VALUE;
            let e = 0;
            let x = 0, y = 0;

            for (let dy = (wSize / 2) * -1; dy <= (wSize / 2); dy++) {
                for (let dx = (wSize / 2) * -1; dx <= (wSize / 2); dx++) {
                    e = 0;
                    e += alpha * e_uniformity[1 + dx][1 + dy]; // internal energy
                    e += beta * e_curvature[(wSize / 2) + dx][(wSize / 2) + dy];  // internal energy
                    //e += gamma * e_flow[(wSize / 2) + dx][(wSize / 2) + dy];       // external energy 0
                    if (e < emin) {
                        emin = e;
                        x = cur[0] + dx;
                        y = cur[1] + dy;
                    }
                }
            }

            if (x < 1) x = 1;
            if (x >= (this.width - 1)) x = this.width - 2;
            if (y < 1) y = 1;
            if (y >= (this.height - 1)) y = this.height - 2;

            newsnake.push([x, y]);
        }
        this.snake = newsnake;

        //add / remove splain (TODO change on cubic + energy + refactor)
        var tmp = [];
        for (var i = 0; i < this.snake.length; i++) {

            var prev = this.snake[(i - 1 < 0 ? this.snake.length - 1 : (i - 1))];
            var cur = this.snake[i];
            var next = this.snake[(i + 1) % this.snake.length];

            var dist = distance(prev, cur) + distance(cur, next);

            //if the length is too short, don't use this point anymore
            if (dist > this.minlen) {

                //if it is below the max length
                if (dist < this.maxlen) {
                    //store the point
                    tmp.push(cur);

                } else {
                    //otherwise split the previous and the next edges
                    var pp = [lerp(.5, prev[0], cur[0]), lerp(.5, prev[1], cur[1])];
                    var np = [lerp(.5, cur[0], next[0]), lerp(.5, cur[1], next[1])];

                    // and add the midpoints to the snake
                    tmp.push(pp, np);
                }
            }
        }
        this.snake = tmp;

        return this.snake;
    }

    function _render(finished) {
        this.render(this.snake, this.it, this.last, finished);
    }

    function init2DArray(rows, columns) {
        let arr = [];
        for (let i = 0; i < rows; i++) {
            arr[i] = [];
            for (let j = 0; j < columns; j++) {
                arr[i][j] = 0;
            }
        }
        return arr;
    }

    function normalize(array3x3) {
        sum = 0;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                sum += Math.abs(array3x3[i][j]);
            }
        }

        if (sum === 0) return;

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                array3x3[i][j] /= sum;
            }
        }
    }

    function f_uniformity(prev, next, p) { //next?

        // length of previous segment
        let un = distance(prev, p);

        // mesure of uniformity
        let avg = this.snakelength / this.snake.length;
        let dun = Math.abs(un - avg);

        // elasticity energy
        return dun * dun;
    }

    function f_curvature(prev, p, next) {
        let ux = p[0] - prev[0];
        let uy = p[1] - prev[1];
        let un = Math.sqrt(ux * ux + uy * uy);

        let vx = p[0] - next[0];
        let vy = p[1] - next[1];
        let vn = Math.sqrt(vx * vx + vy * vy);

        if (un === 0 || vn === 0) return 0;

        let cx = (vx + ux) / (un * vn);
        let cy = (vy + uy) / (un * vn);

        // curvature energy
        let cn = cx * cx + cy * cy;
        return cn;
    }

    // total length of snake
    function getsnakelength(snake) {
        var length = 0;
        for (var i = 0; i < snake.length; i++) {
            var cur = snake[i];
            var next = snake[(i + 1) % snake.length];
            length += distance(cur, next);
        }
        return length;
    }

    function distance(a, b) {
        var dx = a[0] - b[0];
        var dy = a[1] - b[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    function lerp(t, a, b) {
        return a + t * (b - a);
    }

    var p = KASS.prototype;
    p.constructor = KASS;
    p.compute = compute;
    p.update = update;
    p.loop = loop;
    p._render = _render;
    p.getsnakelength = getsnakelength;
    return KASS;
}();