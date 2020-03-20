import {mean} from "mathjs";

export const GVF = function () {

    function GVF(params) {

        this.maxIteration = params.maxIteration || 250;
        this.minlen = params.minlen || Math.pow(.1, 2); //not used
        this.maxlen = params.maxlen || Math.pow(5, 2);

        this.alpha = params.alpha || 1.1;
        this.beta = params.beta || 1.2;
        this.gamma = params.gamma || 1.5;
        //delta

        this.w = params.width;
        this.h = params.height;
        const threshold = params.threshold || mean(params.image);


        this.gradient = countChannelGradient(params.image, this.w, this.h, threshold);

        const mu = 0.2;
        const result = countGVF(params.image, this.w, this.h, threshold, mu); //strange param thresh, when need iterations
        this.gflow_u = result[0];
        this.gflow_v = result[1];


        this.length = 0;
        this.snake = params.dots;

        //binding the scope for animationFrameRequests
        this.update = this.update.bind(this);
        this.render = params.render;
        this.stopped = false;

    }

    // compute -> update -> loop, _render ->
    function compute(_onComplete) {

        this.onComplete = _onComplete;

        this.it = 0;
        this.length = 0;
        this.last = this.getsnakelength();
        cancelAnimationFrame(this.interval);

        this.update();
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
        this.length = this.getsnakelength();
        if (++this.it >= this.maxIteration) {
            cancelAnimationFrame(this.interval);
            this._render(true);
        } else {
            this.last = this.length;
            setTimeout(this.update, 0)

        }
    }

    function loop() {

        var wSize = 2;

        var e_uniformity = init2DArray(wSize + 1, wSize + 1);
        var e_curvature = init2DArray(wSize + 1, wSize + 1);
        var e_flow = init2DArray(wSize + 1, wSize + 1);


        let p = [];
        this.length = this.getsnakelength();


        var newsnake = [];

        for (let i = 0; i < this.snake.length; i++) {
            let prev = this.snake[(i + this.snake.length - 1) % this.snake.length];
            let cur = this.snake[i];
            let next = this.snake[(i + 1) % this.snake.length];

            for (let dy = (wSize / 2) * -1; dy <= (wSize / 2); dy++) {
                for (let dx = (wSize / 2) * -1; dx <= (wSize / 2); dx++) {
                    p[0] = cur[0] + dx;
                    p[1] = cur[1] + dy;

                    e_uniformity[1 + dx][1 + dy] = f_uniformity(prev, this.length, p, this.snake.length);
                    e_curvature[(wSize / 2) + dx][(wSize / 2) + dy] = f_curvature(prev, p, next);
                    e_flow[(wSize / 2) + dx][(wSize / 2) + dy] = f_ext(cur, p, dx, dy, this.gflow_u, this.gflow_v, this.w, this.h);

                }
            }

            normalize(e_uniformity);
            normalize(e_curvature);
            normalize(e_flow);

            let emin = Number.MAX_VALUE;
            let e = 0;
            let x = 0, y = 0;

            for (let dy = (wSize / 2) * -1; dy <= (wSize / 2); dy++) {
                for (let dx = (wSize / 2) * -1; dx <= (wSize / 2); dx++) {
                    e = 0;
                    e += this.alpha * e_uniformity[1 + dx][1 + dy]; // internal energy
                    e += this.beta * e_curvature[(wSize / 2) + dx][(wSize / 2) + dy];  // internal energy
                    e += this.gamma * e_flow[(wSize / 2) + dx][(wSize / 2) + dy];  // external energy
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

            newsnake.push([Math.floor(x), Math.floor(y)]);
        }

        this.snake = rebuild(newsnake, this.maxlen);

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
        let sum = 0;
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

    function f_uniformity(prev, snakelength, p, snakesize) {

        // length of previous segment
        let un = distance(prev, p);

        // mesure of uniformity
        let avg = snakelength / snakesize;
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

    function f_ext(cur, p, dx, dy, gflow_u, gflow_v, w, h) {

        if (p[0] >= w || p[0] <= 0)
            return 999;

        if (p[1] >= h || p[1] <= 0)
            return 999;

        // gradient vector flow
        let dp_u = gflow_u[p[0]][p[1]] * dx * -1;
        let dp_v = gflow_v[p[0]][p[1]] * dy * -1;

        let d = dp_u + dp_v;
        return d;
    }

    function countChannelGradient(data, columns, rows, threshold) {

        //Sobel
        let channelGradient = init2DArray(rows, columns);

        let maxgradient = 0;
        for (let y = 0; y < rows - 2; y++) {
            for (let x = 0; x < columns - 2; x++) {
                let p00 = data[y][x];
                let p10 = data[y + 1][x];
                let p20 = data[y + 2][x];
                let p01 = data[y][x + 1];
                let p21 = data[y + 2][x + 1];
                let p02 = data[y][x + 2];
                let p12 = data[y + 1][x + 2];
                let p22 = data[y + 2][x + 2];
                let sx = (p20 + 2 * p21 + p22) - (p00 + 2 * p01 + p02);
                let sy = (p02 + 2 * p12 + p22) - (p00 + 2 * p10 + p10);
                let snorm = Math.floor(Math.sqrt(sx * sx + sy * sy));

                if (snorm > threshold) {
                    channelGradient[y + 1][x + 1] = snorm;
                } else {
                    channelGradient[y + 1][x + 1] = 0;
                }
                maxgradient = Math.max(maxgradient, snorm);
            }
        }

        return channelGradient;

    }

    function countGVF(image, w, h, threshold, mu) { //thresh == iter?

        //why 0..1, when thresh not norm?
        let f = init2DArray(h, w);//
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                f[i][j] = image[i][j] / 255;
            }
        }


        // create empty arrays
        let u = init2DArray(h, w);
        let v = init2DArray(h, w);
        let fx = init2DArray(h, w);
        let fy = init2DArray(h, w);
        let Lu = init2DArray(h, w);
        let Lv = init2DArray(h, w);
        let gvf_v = init2DArray(h, w);
        let gvf_u = init2DArray(h, w);

        // precompute edge-map (gradient)
        for (let y = 1; y < (h - 1); y++) {
            for (let x = 1; x < (w - 1); x++) {
                fx[x][y] = (f[x + 1][y] - f[x - 1][y]) / 2;
                fy[x][y] = (f[x][y + 1] - f[x][y - 1]) / 2;
                u[x][y] = fx[x][y];
                v[x][y] = fy[x][y];
            }
        }

        // iterative diffusion
        for (let loop = 0; loop < threshold; loop++) {

            // compute laplacian of U and V
            for (let x = 1; x < w - 1; x++) {
                for (let y = 1; y < h - 1; y++) {

                    if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
                        Lu[x][y] = ((u[x - 1][y] + u[x + 1][y] + u[x][y - 1] + u[x][y + 1]) - 4 * u[x][y]) / 4;
                        Lv[x][y] = ((v[x - 1][y] + v[x + 1][y] + v[x][y - 1] + v[x][y + 1]) - 4 * v[x][y]) / 4;
                    }
                }
            }


            // Laplace
            del2(w, h, u, v, Lu, Lv);

            // update U and V
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {

                    let gnorm2 = fx[x][y] * fx[x][y] + fy[x][y] * fy[x][y];

                    u[x][y] += mu * 4 * Lu[x][y] - gnorm2 * (u[x][y] - fx[x][y]);
                    v[x][y] += mu * 4 * Lv[x][y] - gnorm2 * (v[x][y] - fy[x][y]);

                    let mag = Math.sqrt(u[x][y] * u[x][y] + v[x][y] * v[x][y]);
                    gvf_u[x][y] = -1 * (u[x][y] / (mag + 1e-10));
                    gvf_v[x][y] = -1 * (v[x][y] / (mag + 1e-10));

                }
            }
        }

        return [gvf_u, gvf_v];
    }

    /**
     * Discrete Laplacian Operator - same del2 function from Matlab
     *
     * @param w width
     * @param h height
     * @param u gradient x
     * @param v gradient y
     * @param Lu Laplace over u
     * @param Lv Laplace over v
     */
    function del2(w, h, u, v, Lu, Lv) {

        for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y++) {

                if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
                } else {
                    if (x === 0 && y === 0) {
                    } else if (y === 0 && x < w - 1) {
                        Lu[x][y] = (-5 * u[x][y + 1] + 4 * u[x][y + 2] - u[x][y + 3] + 2 * u[x][y] + u[x + 1][y] + u[x - 1][y] - 2 * u[x][y]) / 4;
                        Lv[x][y] = (-5 * v[x][y + 1] + 4 * v[x][y + 2] - v[x][y + 3] + 2 * v[x][y] + v[x + 1][y] + v[x - 1][y] - 2 * v[x][y]) / 4;
                    } else if (x === 0 && y < h - 1) {
                        Lu[x][y] = (-5 * u[x + 1][y] + 4 * u[x + 2][y] - u[x + 3][y] + 2 * u[x][y] + u[x][y + 1] + u[x][y - 1] - 2 * u[x][y]) / 4;
                        Lv[x][y] = (-5 * v[x + 1][y] + 4 * v[x + 2][y] - v[x + 3][y] + 2 * v[x][y] + v[x][y + 1] + v[x][y - 1] - 2 * v[x][y]) / 4;
                    } else if (y === h - 1 && x > 0 && x < w - 1) {
                        Lu[x][y] = (-5 * u[x][y - 1] + 4 * u[x][y - 2] - u[x][y - 3] + 2 * u[x][y] + u[x + 1][y] + u[x - 1][y] - 2 * u[x][y]) / 4;
                        Lv[x][y] = (-5 * v[x][y - 1] + 4 * v[x][y - 2] - v[x][y - 3] + 2 * v[x][y] + v[x + 1][y] + v[x - 1][y] - 2 * v[x][y]) / 4;
                    } else if (x === w - 1 && y > 0 && y < h - 1) {
                        Lu[x][y] = (-5 * u[x - 1][y] + 4 * u[x - 2][y] - u[x - 3][y] + 2 * u[x][y] + u[x][y + 1] + u[x][y - 1] - 2 * u[x][y]) / 4;
                        Lv[x][y] = (-5 * v[x - 1][y] + 4 * v[x - 2][y] - v[x - 3][y] + 2 * v[x][y] + v[x][y + 1] + v[x][y - 1] - 2 * v[x][y]) / 4;
                    }
                }
            }
        }

        //ul
        let x = 0;
        let y = 0;
        Lu[x][y] = (-5 * u[x][y + 1] + 4 * u[x][y + 2] - u[x][y + 3] + 2 * u[x][y] - 5 * u[x + 1][y] + 4 * u[x + 2][y] - u[x + 3][y] + 2 * u[x][y]) / 4;
        Lv[x][y] = (-5 * v[x][y + 1] + 4 * v[x][y + 2] - v[x][y + 3] + 2 * v[x][y] - 5 * v[x + 1][y] + 4 * v[x + 2][y] - v[x + 3][y] + 2 * v[x][y]) / 4;

        //br
        x = w - 1;
        y = h - 1;
        Lu[x][y] = (-5 * u[x][y - 1] + 4 * u[x][y - 2] - u[x][y - 3] + 2 * u[x][y] - 5 * u[x - 1][y] + 4 * u[x - 2][y] - u[x - 3][y] + 2 * u[x][y]) / 4;
        Lv[x][y] = (-5 * v[x][y - 1] + 4 * v[x][y - 2] - v[x][y - 3] + 2 * v[x][y] - 5 * v[x - 1][y] + 4 * v[x - 2][y] - v[x - 3][y] + 2 * v[x][y]) / 4;

        //bl
        x = 0;
        y = h - 1;
        Lu[x][y] = (-5 * u[x][y - 1] + 4 * u[x][y - 2] - u[x][y - 3] + 2 * u[x][y] - 5 * u[x + 1][y] + 4 * u[x + 2][y] - u[x + 3][y] + 2 * u[x][y]) / 4;
        Lv[x][y] = (-5 * v[x][y - 1] + 4 * v[x][y - 2] - v[x][y - 3] + 2 * v[x][y] - 5 * v[x + 1][y] + 4 * v[x + 2][y] - v[x + 3][y] + 2 * v[x][y]) / 4;

        //ur
        x = w - 1;
        y = 0;
        Lu[x][y] = (-5 * u[x][y + 1] + 4 * u[x][y + 2] - u[x][y + 3] + 2 * u[x][y] - 5 * u[x - 1][y] + 4 * u[x - 2][y] - u[x - 3][y] + 2 * u[x][y]) / 4;
        Lv[x][y] = (-5 * v[x][y + 1] + 4 * v[x][y + 2] - v[x][y + 3] + 2 * v[x][y] - 5 * v[x - 1][y] + 4 * v[x - 2][y] - v[x - 3][y] + 2 * v[x][y]) / 4;

    }

    function rebuild(snake, maxlen) {

        let tmp = [];

        // precompute length(i) = length of the snake from start to point #i
        let clength = new Array(snake.length + 1);
        clength[0] = 0;
        for (let i = 0; i < snake.length; i++) {
            let cur = snake[i];
            let next = snake[(i + 1) % snake.length];
            clength[i + 1] = clength[i] + distance(cur, next);

        }

        // compute number of points in the new snake
        let total = clength[snake.length];
        let nmb = Math.floor(0.5 + total / maxlen);

        // build a new snake
        for (let i = 0, j = 0; j < nmb; j++) {
            let dist = (j * total) / nmb;
            while (!(clength[i] <= dist && dist < clength[i + 1])) {
                i++;
            }
            // get points (P-1,P,P+1,P+2) in the original snake
            let prev = snake[(i + snake.length - 1) % snake.length];
            let cur = snake[i];
            let next = snake[(i + 1) % snake.length];
            let next2 = snake[(i + 2) % snake.length];

            // do cubic spline interpolation
            let t = (dist - clength[i]) / (clength[i + 1] - clength[i]);
            let t2 = t * t;
            let t3 = t2 * t;
            let c0 = t3;
            let c1 = -3 * t3 + 3 * t2 + 3 * t + 1;
            let c2 = 3 * t3 - 6 * t2 + 4;
            let c3 = -1 * t3 + 3 * t2 - 3 * t + 1;
            let x = prev[0] * c3 + cur[0] * c2 + next[0] * c1 + next2[0] * c0;
            let y = prev[1] * c3 + cur[1] * c2 + next[1] * c1 + next2[1] * c0;

            // add computed point to the new snake
            tmp.push([Math.floor(0.5 + x / 6), Math.floor(0.5 + y / 6)]);
        }
        return tmp;
    }

    // total length of snake
    function getsnakelength() {
        var length = 0;
        for (var i = 0; i < this.snake.length; i++) {
            var cur = this.snake[i];
            var next = this.snake[(i + 1) % this.snake.length];
            length += distance(cur, next);
        }
        return length;
    }

    function distance(a, b) {
        var dx = a[0] - b[0];
        var dy = a[1] - b[1];
        return Math.sqrt(dx * dx + dy * dy);
    }


    var p = GVF.prototype;
    p.constructor = GVF;
    p.compute = compute;
    p.update = update;
    p.loop = loop;
    p._render = _render;
    p.getsnakelength = getsnakelength;
    return GVF;
}();


